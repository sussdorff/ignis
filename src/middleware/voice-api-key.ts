import type { Context, Next } from 'hono'

/**
 * API key for securing voice endpoints.
 * ElevenLabs will send this key in the Authorization header.
 * 
 * In production, this should be:
 * 1. Generated securely (openssl rand -base64 32)
 * 2. Stored in environment variables
 * 3. Shared securely with ElevenLabs team
 * 4. Rotated regularly
 */
const VOICE_API_KEY = process.env.VOICE_API_KEY || 'development-voice-key-change-in-production'

if (process.env.NODE_ENV === 'production' && VOICE_API_KEY === 'development-voice-key-change-in-production') {
  throw new Error('VOICE_API_KEY must be set in production!')
}

/**
 * Middleware to validate API key for voice endpoints.
 * 
 * Expected header format:
 *   Authorization: Bearer <api-key>
 * 
 * Usage:
 *   app.use('/api/voice/*', requireVoiceApiKey)
 * 
 * @returns 401 if API key is missing or invalid
 */
export async function requireVoiceApiKey(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Authorization header required',
      },
      401
    )
  }
  
  // Extract Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Authorization header must be in format: Bearer <api-key>',
      },
      401
    )
  }
  
  const providedKey = match[1]
  
  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(providedKey, VOICE_API_KEY)) {
    // Log failed attempt (for security monitoring)
    console.warn('[Security] Invalid voice API key attempt from', c.req.header('X-Forwarded-For') || 'unknown')
    
    return c.json(
      {
        error: 'unauthorized',
        message: 'Invalid API key',
      },
      401
    )
  }
  
  // API key is valid, proceed
  await next()
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Always compares full length even if strings differ early.
 */
function constantTimeCompare(a: string, b: string): boolean {
  // If lengths differ, still compare to prevent timing attack
  const maxLen = Math.max(a.length, b.length)
  const aBuffer = Buffer.from(a.padEnd(maxLen, '\0'))
  const bBuffer = Buffer.from(b.padEnd(maxLen, '\0'))
  
  let result = 0
  for (let i = 0; i < maxLen; i++) {
    result |= aBuffer[i] ^ bBuffer[i]
  }
  
  return result === 0 && a.length === b.length
}
