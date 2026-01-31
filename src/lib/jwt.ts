import { sign, verify } from 'hono/jwt'
import type { JWTPayload as HonoJWTPayload } from 'hono/jwt'

// =============================================================================
// Types
// =============================================================================

export type AuthLevel = 1 | 2 | 3 | 4
export type AuthMethod = 'magic_link' | 'sms_otp' | 'appointment_link' | 'qr_checkin'

/**
 * JWT payload structure for Ignis authentication.
 * Extends standard JWT claims with Ignis-specific fields.
 */
export interface JWTPayload extends HonoJWTPayload {
  /** Patient ID (FHIR Patient.id) */
  sub: string
  
  /** Issued at timestamp (Unix seconds) */
  iat: number
  
  /** Expires at timestamp (Unix seconds) */
  exp: number
  
  /** Current authentication level (1-4) */
  level: AuthLevel
  
  /** Authentication method used */
  method: AuthMethod
  
  /** ISO timestamp when level was elevated (optional) */
  elevatedAt?: string
  
  /** Action scope for Level 4 tokens (optional) */
  actionScope?: string
}

/**
 * Elevation hint returned when authentication level is insufficient.
 * Backend provides these hints so frontend knows what to ask for.
 */
export interface ElevationHint {
  /** Acceptable factors for elevation (e.g., ['postalCode', 'city']) */
  factors: string[]
  
  /** English prompt for user */
  prompt: string
  
  /** German prompt for user */
  promptDe: string
  
  /** If true, requires OTP flow instead of knowledge factor */
  requiresOtp?: boolean
}

// =============================================================================
// Configuration
// =============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production'
const JWT_ALGORITHM = 'HS256'

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'development-secret-change-in-production') {
  throw new Error('JWT_SECRET must be set in production!')
}

/** Standard session JWT expiry: 24 hours */
export const JWT_EXPIRY_SECONDS = 24 * 60 * 60

/** Level 4 action token expiry: 5 minutes */
export const LEVEL4_EXPIRY_SECONDS = 5 * 60

// =============================================================================
// Elevation hints for each level
// =============================================================================

/**
 * Elevation hints tell the frontend what to ask the user for.
 * Backend-driven: frontend has no knowledge of business rules.
 */
export const ELEVATION_HINTS: Record<AuthLevel, ElevationHint> = {
  1: {
    factors: ['birthDate'],
    prompt: 'Please enter your date of birth to continue',
    promptDe: 'Bitte geben Sie Ihr Geburtsdatum ein',
  },
  2: {
    factors: ['birthDate'],
    prompt: 'Please confirm your date of birth',
    promptDe: 'Bitte bestätigen Sie Ihr Geburtsdatum',
  },
  3: {
    factors: ['postalCode', 'city'],
    prompt: 'Please enter your postal code to continue',
    promptDe: 'Bitte geben Sie Ihre Postleitzahl ein',
  },
  4: {
    factors: ['otp'],
    prompt: 'We will send a verification code to your phone',
    promptDe: 'Wir senden einen Bestätigungscode an Ihr Telefon',
    requiresOtp: true,
  },
}

// =============================================================================
// JWT operations
// =============================================================================

/**
 * Sign a JWT with the given payload.
 */
export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'> & { exp?: number }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: payload.exp ?? now + JWT_EXPIRY_SECONDS,
  }
  
  return await sign(fullPayload, JWT_SECRET, JWT_ALGORITHM)
}

/**
 * Verify a JWT and return the payload.
 * Throws if invalid or expired.
 */
export async function verifyJWT(token: string): Promise<JWTPayload> {
  const payload = await verify(token, JWT_SECRET, JWT_ALGORITHM) as JWTPayload
  return payload
}

/**
 * Create a Level 2 JWT after successful token verification.
 */
export async function createLevel2JWT(
  patientId: string,
  method: AuthMethod
): Promise<{ jwt: string; payload: JWTPayload }> {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: patientId,
    level: 2,
    method,
  }
  
  const jwt = await signJWT(payload)
  const fullPayload = await verifyJWT(jwt) // Get the full payload with iat/exp
  
  return { jwt, payload: fullPayload }
}

/**
 * Elevate an existing JWT to a higher level.
 * Returns a NEW JWT with the same expiry but higher level.
 */
export async function elevateJWT(
  currentPayload: JWTPayload,
  newLevel: AuthLevel
): Promise<{ jwt: string; payload: JWTPayload }> {
  if (newLevel <= currentPayload.level) {
    throw new Error('New level must be higher than current level')
  }
  
  const payload: Omit<JWTPayload, 'iat' | 'exp'> & { exp: number } = {
    sub: currentPayload.sub,
    level: newLevel,
    method: currentPayload.method,
    elevatedAt: new Date().toISOString(),
    exp: currentPayload.exp, // Keep original expiry
  }
  
  const jwt = await signJWT(payload)
  const fullPayload = await verifyJWT(jwt)
  
  return { jwt, payload: fullPayload }
}

/**
 * Create a Level 4 action-scoped JWT (short expiry, single action).
 */
export async function createLevel4ActionJWT(
  currentPayload: JWTPayload,
  action: string
): Promise<{ jwt: string; payload: JWTPayload }> {
  const now = Math.floor(Date.now() / 1000)
  
  const payload: Omit<JWTPayload, 'iat' | 'exp'> & { exp: number } = {
    sub: currentPayload.sub,
    level: 4,
    method: currentPayload.method,
    actionScope: action,
    exp: now + LEVEL4_EXPIRY_SECONDS, // 5 minutes
  }
  
  const jwt = await signJWT(payload)
  const fullPayload = await verifyJWT(jwt)
  
  return { jwt, payload: fullPayload }
}

/**
 * Extract JWT from Authorization header.
 * Returns null if header is missing or invalid format.
 */
export function extractJWTFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}
