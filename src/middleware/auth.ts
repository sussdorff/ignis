import type { Context, Next } from 'hono'
import { verifyJWT, extractJWTFromHeader, ELEVATION_HINTS, type JWTPayload, type AuthLevel } from '../lib/jwt'

/**
 * Middleware to require a minimum authentication level.
 * 
 * Returns 403 with elevation hints if level is insufficient.
 * Returns 401 if no token or invalid token.
 * 
 * This is the core of the backend-driven elevation system:
 * - Frontend doesn't need to know which endpoints require which level
 * - Backend returns detailed instructions on how to elevate
 * - Frontend shows the elevation dialog and retries after success
 * 
 * @param minLevel - Minimum authentication level required (1-4)
 */
export function requireLevel(minLevel: AuthLevel) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization')
    const token = extractJWTFromHeader(authHeader)
    
    if (!token) {
      return c.json(
        {
          error: 'unauthorized',
          message: 'Authorization header missing or invalid',
        },
        401
      )
    }
    
    let payload: JWTPayload
    try {
      payload = await verifyJWT(token)
    } catch (error) {
      return c.json(
        {
          error: 'invalid_token',
          message: 'Token is invalid or expired',
        },
        401
      )
    }
    
    // Check if authentication level is sufficient
    if (payload.level < minLevel) {
      return c.json(
        {
          error: 'insufficient_level',
          currentLevel: payload.level,
          requiredLevel: minLevel,
          elevation: ELEVATION_HINTS[minLevel],
        },
        403
      )
    }
    
    // For Level 4 tokens, verify action scope if present
    if (payload.level === 4 && payload.actionScope) {
      // Action-scoped tokens can only be used for their specific action
      // The route handler should verify the action matches
      // We just pass it through here
    }
    
    // Store payload in context for route handler
    c.set('auth', payload)
    
    await next()
  }
}

/**
 * Optional middleware to extract JWT payload without enforcing a level.
 * Useful for endpoints that work differently based on auth status.
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  const token = extractJWTFromHeader(authHeader)
  
  if (token) {
    try {
      const payload = await verifyJWT(token)
      c.set('auth', payload)
    } catch (error) {
      // Invalid token, but we don't fail - just proceed without auth
      c.set('auth', null)
    }
  } else {
    c.set('auth', null)
  }
  
  await next()
}

/**
 * Helper to get auth payload from context (type-safe).
 * Assumes requireLevel middleware has already run.
 */
export function getAuthPayload(c: Context): JWTPayload {
  const auth = c.get('auth')
  if (!auth) {
    throw new Error('Auth payload not found in context. Did you forget requireLevel middleware?')
  }
  return auth as JWTPayload
}
