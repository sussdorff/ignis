import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  generateMagicLinkToken,
  generateSmsOtp,
  storeAuthToken,
  checkRateLimit,
  recordRateLimitRequest,
  maskEmail,
  maskPhone,
  isValidEmail,
  isValidE164Phone,
  normalizePhoneToE164,
  MAGIC_LINK_EXPIRY_SECONDS,
  SMS_OTP_EXPIRY_SECONDS,
  findTokenByHash,
  hashToken,
  markTokenUsed,
  incrementTokenAttempts,
  deleteToken,
} from '../lib/auth-tokens'
import { findPatientByEmail, findPatientByPhone } from '../lib/aidbox-auth'
import { getPatientById } from '../lib/aidbox-voice'
import { createLevel2JWT, elevateJWT, verifyJWT, extractJWTFromHeader, type JWTPayload } from '../lib/jwt'

// =============================================================================
// Request/Response schemas
// =============================================================================

export const AuthInitiateRequestSchema = z.object({
  method: z.enum(['magic_link', 'sms_otp']),
  identifier: z.string().min(1, 'Identifier is required'),
})

export const AuthInitiateResponseSchema = z.object({
  success: z.boolean(),
  expiresIn: z.number(), // seconds until token expires
  maskedIdentifier: z.string(),
})

export const AuthVerifyTokenRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be in YYYY-MM-DD format'),
})

export const AuthElevateRequestSchema = z.object({
  postalCode: z.string().optional(),
  city: z.string().optional(),
  streetName: z.string().optional(),
}).refine(
  data => data.postalCode || data.city || data.streetName,
  'At least one elevation factor is required (postalCode, city, or streetName)'
)

export type AuthInitiateRequest = z.infer<typeof AuthInitiateRequestSchema>
export type AuthInitiateResponse = z.infer<typeof AuthInitiateResponseSchema>
export type AuthVerifyTokenRequest = z.infer<typeof AuthVerifyTokenRequestSchema>
export type AuthElevateRequest = z.infer<typeof AuthElevateRequestSchema>

// =============================================================================
// Route definition
// =============================================================================

const auth = new Hono()

/**
 * POST /api/auth/initiate
 *
 * Initiate passwordless authentication via magic link (email) or SMS OTP.
 *
 * Security measures:
 * - Rate limiting: 3 requests per hour per identifier
 * - Returns generic success even if patient not found (prevent enumeration)
 * - Tokens are stored as hashes only
 */
auth.post(
  '/initiate',
  zValidator('json', AuthInitiateRequestSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues
      const message = issues.map((e) => e.message).join('; ')
      return c.json({ error: 'validation_failed', message }, 400)
    }
  }),
  async (c) => {
    const { method, identifier } = c.req.valid('json')

    // Validate identifier format based on method
    if (method === 'magic_link') {
      if (!isValidEmail(identifier)) {
        return c.json(
          {
            error: 'validation_failed',
            message: 'Invalid email format',
          },
          400
        )
      }
    } else {
      // sms_otp
      if (!isValidE164Phone(identifier)) {
        return c.json(
          {
            error: 'validation_failed',
            message: 'Invalid phone number format. Use E.164 format (e.g., +491719876543)',
          },
          400
        )
      }
    }

    // Check rate limit
    const rateCheck = checkRateLimit(identifier)
    if (!rateCheck.allowed) {
      return c.json(
        {
          error: 'rate_limited',
          message: 'Too many requests. Please try again later.',
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        429
      )
    }

    // Record this request for rate limiting
    recordRateLimitRequest(identifier)

    // Determine expiry and masked identifier based on method
    const expiresIn = method === 'magic_link'
      ? MAGIC_LINK_EXPIRY_SECONDS
      : SMS_OTP_EXPIRY_SECONDS

    const maskedIdentifier = method === 'magic_link'
      ? maskEmail(identifier)
      : maskPhone(identifier)

    // Lookup patient by email or phone
    let patient = null
    try {
      if (method === 'magic_link') {
        patient = await findPatientByEmail(identifier)
      } else {
        const normalizedPhone = normalizePhoneToE164(identifier)
        patient = await findPatientByPhone(normalizedPhone)
      }
    } catch (err) {
      // Log error but don't expose to client (prevent enumeration)
      console.error('[Auth] Patient lookup error:', err)
    }

    // If patient not found, return generic success (prevent enumeration)
    // This is intentional security measure per AUTHENTICATION-POLICY.md
    if (!patient) {
      console.log(`[Auth] No patient found for ${method}: ${maskedIdentifier} (returning generic success)`)
      return c.json<AuthInitiateResponse>(
        {
          success: true,
          expiresIn,
          maskedIdentifier,
        },
        200
      )
    }

    // Generate token based on method
    const rawToken = method === 'magic_link'
      ? generateMagicLinkToken()
      : generateSmsOtp()

    // Store token (hash only)
    storeAuthToken(rawToken, patient.id!, method)

    // Send token via appropriate channel (stub for now)
    if (method === 'magic_link') {
      // TODO: Integrate with email provider (SendGrid, SES, etc.)
      console.log(`[Auth] Magic link for ${maskedIdentifier}: ${rawToken}`)
      console.log(`[Auth] Link: https://ignis.app/auth/verify?token=${rawToken}`)
    } else {
      // TODO: Integrate with SMS provider (Twilio, etc.)
      console.log(`[Auth] SMS OTP for ${maskedIdentifier}: ${rawToken}`)
    }

    return c.json<AuthInitiateResponse>(
      {
        success: true,
        expiresIn,
        maskedIdentifier,
      },
      200
    )
  }
)

/**
 * POST /api/auth/verify-token
 * 
 * Verify magic link token or SMS OTP combined with birth date.
 * Issues initial Level 2 JWT upon successful verification.
 * 
 * Security measures:
 * - Token is single-use (marked as used after verification)
 * - Max 5 birth date attempts per token, then token invalidated
 * - Tokens expire after 10-15 minutes
 */
auth.post(
  '/verify-token',
  zValidator('json', AuthVerifyTokenRequestSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues
      const message = issues.map((e) => e.message).join('; ')
      return c.json({ error: 'validation_failed', message }, 400)
    }
  }),
  async (c) => {
    const { token, birthDate } = c.req.valid('json')
    
    // Lookup token by hash
    const tokenHash = hashToken(token)
    const authToken = findTokenByHash(tokenHash)
    
    if (!authToken) {
      return c.json(
        {
          error: 'invalid_token',
          message: 'Token not found or expired',
        },
        401
      )
    }
    
    // Check if token is expired
    if (authToken.expiresAt < new Date()) {
      deleteToken(tokenHash)
      return c.json(
        {
          error: 'invalid_token',
          message: 'Token has expired',
        },
        401
      )
    }
    
    // Check if token has already been used
    if (authToken.used) {
      return c.json(
        {
          error: 'invalid_token',
          message: 'Token has already been used',
        },
        401
      )
    }
    
    // Check max attempts
    if (authToken.attempts >= 5) {
      deleteToken(tokenHash)
      return c.json(
        {
          error: 'max_attempts',
          message: 'Too many failed attempts. Please request a new token.',
        },
        401
      )
    }
    
    // Get patient from FHIR
    const patient = await getPatientById(authToken.patientId)
    if (!patient) {
      console.error(`[Auth] Patient ${authToken.patientId} not found in FHIR`)
      return c.json(
        {
          error: 'invalid_token',
          message: 'Patient not found',
        },
        401
      )
    }
    
    // Verify birth date matches
    if (patient.birthDate !== birthDate) {
      incrementTokenAttempts(tokenHash)
      console.log(`[Auth] Birth date mismatch for patient ${authToken.patientId}`)
      
      return c.json(
        {
          error: 'invalid_birthdate',
          message: 'Birth date does not match our records',
          attemptsRemaining: 5 - (authToken.attempts + 1),
        },
        401
      )
    }
    
    // Success! Mark token as used
    markTokenUsed(tokenHash)
    
    // Issue Level 2 JWT (birth date verified)
    const { jwt, payload } = await createLevel2JWT(
      patient.id!,
      authToken.method
    )
    
    console.log(`[Auth] Issued Level 2 JWT for patient ${patient.id} via ${authToken.method}`)
    
    return c.json(
      {
        jwt,
        level: 2,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        patient: {
          id: patient.id,
          name: `${patient.name?.[0]?.given?.[0] ?? ''} ${patient.name?.[0]?.family ?? ''}`.trim(),
        },
      },
      200
    )
  }
)

/**
 * POST /api/auth/elevate
 * 
 * Elevate existing JWT to higher authentication level.
 * Returns a NEW JWT with the same expiry but elevated level.
 * 
 * Level progression:
 * - Level 2 → 3: Requires postalCode OR city OR streetName
 * - Level 3 → 4: Requires OTP (use /auth/request-otp and /auth/confirm-action)
 */
auth.post(
  '/elevate',
  zValidator('json', AuthElevateRequestSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues
      const message = issues.map((e) => e.message).join('; ')
      return c.json({ error: 'validation_failed', message }, 400)
    }
  }),
  async (c) => {
    // Extract and verify current JWT
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
    
    let currentPayload: JWTPayload
    try {
      currentPayload = await verifyJWT(token)
    } catch (error) {
      return c.json(
        {
          error: 'invalid_token',
          message: 'Token is invalid or expired',
        },
        401
      )
    }
    
    const { postalCode, city, streetName } = c.req.valid('json')
    
    // Get patient from FHIR
    const patient = await getPatientById(currentPayload.sub)
    if (!patient) {
      return c.json(
        {
          error: 'invalid_token',
          message: 'Patient not found',
        },
        401
      )
    }
    
    // Determine target level based on provided factors
    let newLevel = currentPayload.level
    let verifiedFactor: string | undefined
    
    // Level 2 → 3: Verify address factors
    if (currentPayload.level >= 2 && (postalCode || city || streetName)) {
      const patientAddress = patient.address?.[0]
      
      if (!patientAddress) {
        return c.json(
          {
            error: 'invalid_factor',
            message: 'No address on file for verification',
          },
          401
        )
      }
      
      // Try postal code
      if (postalCode) {
        if (patientAddress.postalCode === postalCode) {
          newLevel = 3
          verifiedFactor = 'postalCode'
        } else {
          return c.json(
            {
              error: 'invalid_factor',
              message: 'Postal code does not match our records',
              failedFactor: 'postalCode',
            },
            401
          )
        }
      }
      
      // Try city as alternative
      if (!verifiedFactor && city) {
        if (patientAddress.city?.toLowerCase() === city.toLowerCase()) {
          newLevel = 3
          verifiedFactor = 'city'
        } else {
          return c.json(
            {
              error: 'invalid_factor',
              message: 'City does not match our records',
              failedFactor: 'city',
            },
            401
          )
        }
      }
      
      // Try street name
      if (!verifiedFactor && streetName) {
        const addressLines = patientAddress.line || []
        const streetMatch = addressLines.some(line =>
          line.toLowerCase().includes(streetName.toLowerCase())
        )
        
        if (streetMatch) {
          newLevel = 3
          verifiedFactor = 'streetName'
        } else {
          return c.json(
            {
              error: 'invalid_factor',
              message: 'Street name does not match our records',
              failedFactor: 'streetName',
            },
            401
          )
        }
      }
    }
    
    // Check if elevation actually happened
    if (newLevel <= currentPayload.level) {
      return c.json(
        {
          error: 'already_at_level',
          message: `Already at level ${currentPayload.level} or higher`,
          currentLevel: currentPayload.level,
        },
        400
      )
    }
    
    // Issue new JWT with elevated level
    const { jwt, payload } = await elevateJWT(currentPayload, newLevel)
    
    console.log(
      `[Auth] Elevated patient ${patient.id} from Level ${currentPayload.level} to Level ${newLevel} via ${verifiedFactor}`
    )
    
    return c.json(
      {
        jwt,
        level: newLevel,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      },
      200
    )
  }
)

export default auth
