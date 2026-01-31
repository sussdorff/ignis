import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  findPatientByPhone,
  getPatientById,
  buildPatientDisplayName,
  normalizePhone,
  validateBirthDate,
  validatePostalCode,
  validateCity,
  validateStreetName,
  isPatientBlocked,
  recordFailedAttempt,
  clearFailedAttempts,
  logVoiceAuthEvent,
} from '../lib/aidbox-voice'

const voice = new Hono()

// =============================================================================
// Schema definitions
// =============================================================================

const IdentifyRequestSchema = z.object({
  callerPhoneNumber: z.string().min(1, 'callerPhoneNumber is required'),
})

const AuthenticateRequestSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  factors: z.object({
    birthDate: z.string().optional(),      // Level 1+
    postalCode: z.string().optional(),     // Level 2+
    city: z.string().optional(),           // Level 2+ (alternative to postalCode)
    streetName: z.string().optional(),     // Level 3+
  }),
})

// Response types
interface IdentifyResponse {
  found: boolean
  patientId?: string
  patientName?: string
}

interface AuthenticateResponse {
  authenticated: boolean
  level: 0 | 1 | 2 | 3
  failedFactor?: string
  blocked?: boolean
}

// =============================================================================
// POST /api/voice/identify
// Look up patient by phone number (Caller-ID)
// =============================================================================
voice.post(
  '/identify',
  zValidator('json', IdentifyRequestSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues
      const message = issues.map((e) => e.message).join('; ')
      return c.json({ error: 'validation_failed', message }, 400)
    }
  }),
  async (c) => {
    const { callerPhoneNumber } = c.req.valid('json')

    // Normalize phone number
    const normalized = normalizePhone(callerPhoneNumber)

    // Search for patient by phone
    const patient = await findPatientByPhone(normalized)

    // Log lookup attempt (GDPR-compliant: no phone number logged)
    logVoiceAuthEvent({
      type: 'lookup',
      success: !!patient,
      patientId: patient?.id,
    })

    if (!patient) {
      const response: IdentifyResponse = { found: false }
      return c.json(response, 200)
    }

    const response: IdentifyResponse = {
      found: true,
      patientId: patient.id,
      patientName: buildPatientDisplayName(patient),
    }

    return c.json(response, 200)
  }
)

// =============================================================================
// POST /api/voice/authenticate
// Verify patient knowledge factors for Voice AI authentication
// =============================================================================
voice.post(
  '/authenticate',
  zValidator('json', AuthenticateRequestSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues
      const message = issues.map((e) => e.message).join('; ')
      return c.json({ error: 'validation_failed', message }, 400)
    }
  }),
  async (c) => {
    const { patientId, factors } = c.req.valid('json')

    // Check if patient is blocked due to too many failed attempts
    if (isPatientBlocked(patientId)) {
      logVoiceAuthEvent({
        type: 'authenticate',
        success: false,
        patientId,
        level: 0,
      })

      const response: AuthenticateResponse = {
        authenticated: false,
        level: 0,
        blocked: true,
      }
      return c.json(response, 403)
    }

    // Fetch patient from FHIR
    const patient = await getPatientById(patientId)
    if (!patient) {
      const response: AuthenticateResponse = {
        authenticated: false,
        level: 0,
        failedFactor: 'patientId',
      }
      return c.json(response, 404)
    }

    // Start at level 0 (identified by phone/caller-ID)
    let achievedLevel: 0 | 1 | 2 | 3 = 0
    let failedFactor: string | undefined

    // Level 1: Validate birth date (required for any authentication)
    if (factors.birthDate) {
      if (!validateBirthDate(patient, factors.birthDate)) {
        failedFactor = 'birthDate'
        const blocked = recordFailedAttempt(patientId)

        logVoiceAuthEvent({
          type: 'authenticate',
          success: false,
          patientId,
          level: 0,
          failedFactor,
        })

        const response: AuthenticateResponse = {
          authenticated: false,
          level: 0,
          failedFactor,
          blocked,
        }
        return c.json(response, 200)
      }
      achievedLevel = 1
    }

    // Level 2: Validate postal code OR city (if Level 1 passed)
    if (achievedLevel >= 1 && (factors.postalCode || factors.city)) {
      let level2Passed = false

      if (factors.postalCode) {
        if (validatePostalCode(patient, factors.postalCode)) {
          level2Passed = true
        } else {
          failedFactor = 'postalCode'
        }
      }

      // City as alternative if postal code not provided or failed
      if (!level2Passed && factors.city) {
        if (validateCity(patient, factors.city)) {
          level2Passed = true
          failedFactor = undefined // Clear if city succeeded
        } else if (!failedFactor) {
          failedFactor = 'city'
        }
      }

      if (!level2Passed && failedFactor) {
        const blocked = recordFailedAttempt(patientId)

        logVoiceAuthEvent({
          type: 'authenticate',
          success: false,
          patientId,
          level: 1,
          failedFactor,
        })

        const response: AuthenticateResponse = {
          authenticated: false,
          level: 1,
          failedFactor,
          blocked,
        }
        return c.json(response, 200)
      }

      if (level2Passed) {
        achievedLevel = 2
      }
    }

    // Level 3: Validate street name (if Level 2 passed)
    if (achievedLevel >= 2 && factors.streetName) {
      if (!validateStreetName(patient, factors.streetName)) {
        failedFactor = 'streetName'
        const blocked = recordFailedAttempt(patientId)

        logVoiceAuthEvent({
          type: 'authenticate',
          success: false,
          patientId,
          level: 2,
          failedFactor,
        })

        const response: AuthenticateResponse = {
          authenticated: false,
          level: 2,
          failedFactor,
          blocked,
        }
        return c.json(response, 200)
      }
      achievedLevel = 3
    }

    // Successful authentication - clear failed attempts
    if (achievedLevel > 0) {
      clearFailedAttempts(patientId)
    }

    logVoiceAuthEvent({
      type: 'authenticate',
      success: achievedLevel > 0,
      patientId,
      level: achievedLevel,
    })

    const response: AuthenticateResponse = {
      authenticated: achievedLevel > 0,
      level: achievedLevel,
    }
    return c.json(response, 200)
  }
)

export default voice
