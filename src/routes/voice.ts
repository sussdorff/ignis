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
// Action to Level mapping (from AUTHENTICATION-POLICY.md)
// =============================================================================

const ACTION_LEVEL_MAP: Record<string, number> = {
  // Level 0: Public information
  'greeting': 0,
  'practice_info': 0,
  
  // Level 1: View-only, moderately sensitive
  'view_appointment': 1,
  'confirm_reminder': 1,
  
  // Level 2: Modifications, contact changes
  'cancel_appointment': 2,
  'reschedule_appointment': 2,
  'book_appointment': 2,
  'change_phone': 2,
  'change_address': 2,
  
  // Level 3: Medical/legal significance
  'request_prescription': 3,
  'request_referral': 3,
  'sick_note': 3,
  'query_test_results': 3,
  
  // Level 4: Highly sensitive (requires out-of-band)
  'view_test_results': 4,
  'change_email': 4,
}

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

const AuthorizeActionRequestSchema = z.object({
  authLevel: z.number().int().min(0).max(3),
  action: z.string().min(1),
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

// =============================================================================
// POST /api/voice/authorize-action
// Check if auth level permits action
// =============================================================================
voice.post(
  '/authorize-action',
  zValidator('json', AuthorizeActionRequestSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues
      const message = issues.map((e) => e.message).join('; ')
      return c.json({ error: 'validation_failed', message }, 400)
    }
  }),
  async (c) => {
    const { authLevel, action } = c.req.valid('json')
    
    // Get required level for this action
    const requiredLevel = ACTION_LEVEL_MAP[action]
    
    if (requiredLevel === undefined) {
      // Unknown action - be conservative, require Level 2
      console.warn(`[Voice] Unknown action requested: ${action}, defaulting to Level 2`)
      const authorized = authLevel >= 2
      
      return c.json({
        authorized,
        requiredLevel: 2,
        currentLevel: authLevel,
        missingFactors: authorized ? undefined : getMissingFactors(authLevel, 2),
      })
    }
    
    // Check if current level is sufficient
    const authorized = authLevel >= requiredLevel
    
    // Level 4 actions cannot be authorized via voice (require out-of-band)
    if (requiredLevel === 4) {
      return c.json({
        authorized: false,
        requiredLevel: 4,
        currentLevel: authLevel,
        cannotAuthorize: true,
        reason: 'This action requires human verification for security. Please call during office hours.',
      })
    }
    
    const response: any = {
      authorized,
      requiredLevel,
      currentLevel: authLevel,
    }
    
    // If not authorized, tell them what factors are missing
    if (!authorized) {
      response.missingFactors = getMissingFactors(authLevel, requiredLevel)
    }
    
    return c.json(response)
  }
)

/**
 * Determine which authentication factors are missing to reach target level.
 */
function getMissingFactors(currentLevel: number, targetLevel: number): string[] {
  const factors: string[] = []
  
  if (currentLevel < 1 && targetLevel >= 1) {
    factors.push('birthDate')
  }
  
  if (currentLevel < 2 && targetLevel >= 2) {
    factors.push('postalCode', 'city')  // Either postal code OR city
  }
  
  if (currentLevel < 3 && targetLevel >= 3) {
    factors.push('streetName')
  }
  
  return factors
}

export default voice
