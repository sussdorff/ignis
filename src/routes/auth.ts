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
} from '../lib/auth-tokens'
import { findPatientByEmail, findPatientByPhone } from '../lib/aidbox-auth'

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

export type AuthInitiateRequest = z.infer<typeof AuthInitiateRequestSchema>
export type AuthInitiateResponse = z.infer<typeof AuthInitiateResponseSchema>

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

export default auth
