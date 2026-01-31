import { describe, it, expect, beforeEach } from 'bun:test'
import { generateMagicLinkToken } from '../lib/auth-tokens'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

// Test patient IDs from dummy data
const PATIENT_2_ID = 'patient-2' // Maria Weber, birthDate: 1972-08-22
const PATIENT_2_BIRTHDATE = '1972-08-22'
const PATIENT_2_POSTAL = '20099'
const PATIENT_2_CITY = 'Hamburg'

/**
 * Helper to inject a test token into the running server.
 * This allows tests to work with the in-memory token store.
 */
async function injectToken(rawToken: string, patientId: string, method: string): Promise<void> {
  const res = await fetch(`${BASE}/api/auth-test/inject-token?rawToken=${rawToken}&patientId=${patientId}&method=${method}`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(`Failed to inject token: ${res.status}`)
  }
}

// Clear auth state before each test to ensure isolation
beforeEach(async () => {
  await fetch(`${BASE}/api/auth-test/clear`, { method: 'POST' })
})

describe('Auth API - POST /api/auth/initiate', () => {
  describe('Magic Link authentication', () => {
    it('returns success for valid email format', async () => {
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'magic_link',
          identifier: 'test@example.com',
        }),
      })

      expect(res.ok).toBe(true)
      const data = await res.json() as {
        success: boolean
        expiresIn: number
        maskedIdentifier: string
      }

      expect(data.success).toBe(true)
      expect(data.expiresIn).toBe(900) // 15 minutes
      expect(data.maskedIdentifier).toBe('t***@example.com')
    })

    it('returns success with masked email for known patient', async () => {
      // patient-2 (Maria Weber) has email maria.weber@example.com in test data
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'magic_link',
          identifier: 'maria.weber@example.com',
        }),
      })

      expect(res.ok).toBe(true)
      const data = await res.json() as {
        success: boolean
        expiresIn: number
        maskedIdentifier: string
      }

      expect(data.success).toBe(true)
      expect(data.expiresIn).toBe(900)
      expect(data.maskedIdentifier).toBe('m***@example.com')
    })

    it('rejects invalid email format', async () => {
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'magic_link',
          identifier: 'not-an-email',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json() as { error: string; message: string }
      expect(data.error).toBe('validation_failed')
      expect(data.message).toContain('Invalid email')
    })
  })

  describe('SMS OTP authentication', () => {
    it('returns success for valid E.164 phone number', async () => {
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'sms_otp',
          identifier: '+491719876543',
        }),
      })

      expect(res.ok).toBe(true)
      const data = await res.json() as {
        success: boolean
        expiresIn: number
        maskedIdentifier: string
      }

      expect(data.success).toBe(true)
      expect(data.expiresIn).toBe(600) // 10 minutes
      expect(data.maskedIdentifier).toMatch(/^\+\d{2} \*{4}\d{3}$/)
    })

    it('returns success for known patient phone number', async () => {
      // patient-2 (Maria Weber) has phone +49 171 9876543 in test data
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'sms_otp',
          identifier: '+491719876543',
        }),
      })

      expect(res.ok).toBe(true)
      const data = await res.json() as {
        success: boolean
        expiresIn: number
        maskedIdentifier: string
      }

      expect(data.success).toBe(true)
      expect(data.expiresIn).toBe(600)
    })

    it('rejects invalid phone format', async () => {
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'sms_otp',
          identifier: '12345',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json() as { error: string; message: string }
      expect(data.error).toBe('validation_failed')
      expect(data.message).toContain('Invalid phone')
    })
  })

  describe('Rate limiting', () => {
    it('allows 3 requests per hour per identifier', async () => {
      const identifier = 'ratelimit-test@example.com'

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${BASE}/api/auth/initiate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'magic_link',
            identifier,
          }),
        })
        expect(res.ok).toBe(true)
      }

      // 4th request should be rate limited
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'magic_link',
          identifier,
        }),
      })

      expect(res.status).toBe(429)
      const data = await res.json() as {
        error: string
        message: string
        retryAfterSeconds?: number
      }
      expect(data.error).toBe('rate_limited')
      expect(typeof data.retryAfterSeconds).toBe('number')
      expect(data.retryAfterSeconds).toBeGreaterThan(0)
    })

    it('rate limits are per-identifier', async () => {
      const identifier1 = 'user1-ratelimit@example.com'
      const identifier2 = 'user2-ratelimit@example.com'

      // Exhaust rate limit for identifier1
      for (let i = 0; i < 3; i++) {
        await fetch(`${BASE}/api/auth/initiate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'magic_link',
            identifier: identifier1,
          }),
        })
      }

      // identifier2 should still be allowed
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'magic_link',
          identifier: identifier2,
        }),
      })

      expect(res.ok).toBe(true)
    })
  })

  describe('Validation', () => {
    it('rejects missing method', async () => {
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'test@example.com',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('rejects invalid method', async () => {
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'invalid_method',
          identifier: 'test@example.com',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('rejects missing identifier', async () => {
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'magic_link',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('rejects empty identifier', async () => {
      const res = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'magic_link',
          identifier: '',
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('Patient enumeration prevention', () => {
    it('returns same response for existing and non-existing patients (email)', async () => {
      // Known patient email
      const res1 = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'magic_link',
          identifier: 'maria.weber@example.com',
        }),
      })

      // Unknown email
      const res2 = await fetch(`${BASE}/api/auth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'magic_link',
          identifier: 'nonexistent@example.com',
        }),
      })

      // Both should succeed with same structure
      expect(res1.ok).toBe(true)
      expect(res2.ok).toBe(true)

      const data1 = await res1.json() as { success: boolean; expiresIn: number }
      const data2 = await res2.json() as { success: boolean; expiresIn: number }

      expect(data1.success).toBe(true)
      expect(data2.success).toBe(true)
      expect(data1.expiresIn).toBe(data2.expiresIn)
    })
  })
})

describe('Auth API - POST /api/auth/verify-token', () => {
  it('issues Level 2 JWT for valid token + birth date', async () => {
    // Generate and inject a token for patient-2 (using SMS OTP method, phone-based)
    const rawToken = generateMagicLinkToken()
    await injectToken(rawToken, PATIENT_2_ID, 'sms_otp')
    
    const res = await fetch(`${BASE}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        birthDate: PATIENT_2_BIRTHDATE,
      }),
    })
    
    expect(res.ok).toBe(true)
    const data = await res.json() as {
      jwt: string
      level: number
      expiresAt: string
      patient: { id: string; name: string }
    }
    
    expect(data.level).toBe(2)
    expect(data.jwt).toBeDefined()
    expect(data.jwt.length).toBeGreaterThan(50)
    expect(data.patient.id).toBe(PATIENT_2_ID)
    expect(data.patient.name).toContain('Maria')
    
    // Verify JWT expiry is ~24 hours from now
    const expiresAt = new Date(data.expiresAt)
    const now = new Date()
    const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
    expect(hoursDiff).toBeGreaterThan(23)
    expect(hoursDiff).toBeLessThan(25)
  })
  
  it('rejects invalid token', async () => {
    const res = await fetch(`${BASE}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'invalid-token-12345',
        birthDate: PATIENT_2_BIRTHDATE,
      }),
    })
    
    expect(res.status).toBe(401)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('invalid_token')
  })
  
  it('rejects incorrect birth date', async () => {
    const rawToken = generateMagicLinkToken()
    await injectToken(rawToken, PATIENT_2_ID, 'sms_otp')
    
    const res = await fetch(`${BASE}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        birthDate: '1990-01-01', // Wrong date
      }),
    })
    
    expect(res.status).toBe(401)
    const data = await res.json() as { error: string; attemptsRemaining: number }
    expect(data.error).toBe('invalid_birthdate')
    // Note: attempts is incremented before returning, so remaining is 5 - (attempts after increment)
    expect(data.attemptsRemaining).toBeGreaterThan(0)
    expect(data.attemptsRemaining).toBeLessThanOrEqual(4)
  })
  
  it('invalidates token after 5 failed attempts', async () => {
    const rawToken = generateMagicLinkToken()
    await injectToken(rawToken, PATIENT_2_ID, 'sms_otp')
    
    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE}/api/auth/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          birthDate: '1990-01-01',
        }),
      })
    }
    
    // 6th attempt should fail with max_attempts
    const res = await fetch(`${BASE}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        birthDate: PATIENT_2_BIRTHDATE, // Even with correct date
      }),
    })
    
    expect(res.status).toBe(401)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('max_attempts')
  })
  
  it('marks token as used after successful verification', async () => {
    const rawToken = generateMagicLinkToken()
    await injectToken(rawToken, PATIENT_2_ID, 'sms_otp')
    
    // First verification - should succeed
    const res1 = await fetch(`${BASE}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        birthDate: PATIENT_2_BIRTHDATE,
      }),
    })
    expect(res1.ok).toBe(true)
    
    // Second verification with same token - should fail
    const res2 = await fetch(`${BASE}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        birthDate: PATIENT_2_BIRTHDATE,
      }),
    })
    
    expect(res2.status).toBe(401)
    const data = await res2.json() as { error: string }
    expect(data.error).toBe('invalid_token')
  })
})

describe('Auth API - POST /api/auth/elevate', () => {
  async function getLevel2JWT(): Promise<string> {
    // Use SMS OTP method (phone-based, aligns with voice auth)
    const rawToken = generateMagicLinkToken()
    await injectToken(rawToken, PATIENT_2_ID, 'sms_otp')
    
    const res = await fetch(`${BASE}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        birthDate: PATIENT_2_BIRTHDATE,
      }),
    })
    
    const data = await res.json() as { jwt: string }
    return data.jwt
  }
  
  it('elevates Level 2 to Level 3 with postal code', async () => {
    const jwt = await getLevel2JWT()
    
    const res = await fetch(`${BASE}/api/auth/elevate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        postalCode: PATIENT_2_POSTAL,
      }),
    })
    
    expect(res.ok).toBe(true)
    const data = await res.json() as { jwt: string; level: number }
    
    expect(data.level).toBe(3)
    expect(data.jwt).toBeDefined()
    expect(data.jwt).not.toBe(jwt) // New JWT issued
  })
  
  it('elevates Level 2 to Level 3 with city', async () => {
    const jwt = await getLevel2JWT()
    
    const res = await fetch(`${BASE}/api/auth/elevate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        city: PATIENT_2_CITY,
      }),
    })
    
    expect(res.ok).toBe(true)
    const data = await res.json() as { jwt: string; level: number }
    expect(data.level).toBe(3)
  })
  
  it('rejects incorrect postal code', async () => {
    const jwt = await getLevel2JWT()
    
    const res = await fetch(`${BASE}/api/auth/elevate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        postalCode: '99999', // Wrong postal code
      }),
    })
    
    expect(res.status).toBe(401)
    const data = await res.json() as { error: string; failedFactor: string }
    expect(data.error).toBe('invalid_factor')
    expect(data.failedFactor).toBe('postalCode')
  })
  
  it('requires Authorization header', async () => {
    const res = await fetch(`${BASE}/api/auth/elevate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postalCode: PATIENT_2_POSTAL,
      }),
    })
    
    expect(res.status).toBe(401)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('unauthorized')
  })
  
  it('rejects invalid JWT', async () => {
    const res = await fetch(`${BASE}/api/auth/elevate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-jwt-token',
      },
      body: JSON.stringify({
        postalCode: PATIENT_2_POSTAL,
      }),
    })
    
    expect(res.status).toBe(401)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('invalid_token')
  })
  
  it('returns already_at_level if no elevation occurs', async () => {
    const jwt = await getLevel2JWT()
    
    const res = await fetch(`${BASE}/api/auth/elevate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        // No valid elevation factors provided
      }),
    })
    
    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('validation_failed')
  })
})

describe('Auth middleware - requireLevel', () => {
  async function getLevel2JWT(): Promise<string> {
    // Use SMS OTP method (phone-based)
    const rawToken = generateMagicLinkToken()
    await injectToken(rawToken, PATIENT_2_ID, 'sms_otp')
    
    const res = await fetch(`${BASE}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        birthDate: PATIENT_2_BIRTHDATE,
      }),
    })
    
    const data = await res.json() as { jwt: string }
    return data.jwt
  }
  
  async function getLevel3JWT(): Promise<string> {
    const level2jwt = await getLevel2JWT()
    
    const res = await fetch(`${BASE}/api/auth/elevate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${level2jwt}`,
      },
      body: JSON.stringify({
        postalCode: PATIENT_2_POSTAL,
      }),
    })
    
    const data = await res.json() as { jwt: string }
    return data.jwt
  }
  
  it('returns 401 when no Authorization header provided', async () => {
    const res = await fetch(`${BASE}/api/auth-test/level2`)
    
    expect(res.status).toBe(401)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('unauthorized')
  })
  
  it('returns 401 when invalid JWT provided', async () => {
    const res = await fetch(`${BASE}/api/auth-test/level2`, {
      headers: {
        'Authorization': 'Bearer invalid-jwt-token',
      },
    })
    
    expect(res.status).toBe(401)
    const data = await res.json() as { error: string }
    expect(data.error).toBe('invalid_token')
  })
  
  it('returns 403 with elevation hints when level insufficient', async () => {
    const jwt = await getLevel2JWT() // Level 2 JWT
    
    const res = await fetch(`${BASE}/api/auth-test/level3`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
    })
    
    expect(res.status).toBe(403)
    const data = await res.json() as {
      error: string
      currentLevel: number
      requiredLevel: number
      elevation: {
        factors: string[]
        prompt: string
        promptDe: string
      }
    }
    
    expect(data.error).toBe('insufficient_level')
    expect(data.currentLevel).toBe(2)
    expect(data.requiredLevel).toBe(3)
    expect(data.elevation.factors).toContain('postalCode')
    expect(data.elevation.prompt).toBeDefined()
    expect(data.elevation.promptDe).toBeDefined()
  })
  
  it('allows access when level is sufficient', async () => {
    const jwt = await getLevel2JWT()
    
    const res = await fetch(`${BASE}/api/auth-test/level2`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
    })
    
    expect(res.ok).toBe(true)
    const data = await res.json() as {
      message: string
      level: number
      patientId: string
    }
    
    expect(data.level).toBe(2)
    expect(data.patientId).toBe(PATIENT_2_ID)
    expect(data.message).toContain('Level 2 access granted')
  })
  
  it('allows Level 3 JWT to access Level 2 endpoint', async () => {
    const jwt = await getLevel3JWT() // Higher level
    
    const res = await fetch(`${BASE}/api/auth-test/level2`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
    })
    
    expect(res.ok).toBe(true)
    const data = await res.json() as { level: number }
    expect(data.level).toBe(3)
  })
  
  it('full elevation flow: Level 2 → 3 with retry', async () => {
    const level2jwt = await getLevel2JWT()
    
    // First attempt: Try to access Level 3 endpoint with Level 2 JWT
    const res1 = await fetch(`${BASE}/api/auth-test/level3`, {
      headers: { 'Authorization': `Bearer ${level2jwt}` },
    })
    
    expect(res1.status).toBe(403)
    const insufficientData = await res1.json() as {
      error: string
      elevation: { factors: string[] }
    }
    expect(insufficientData.error).toBe('insufficient_level')
    
    // Elevate: Use the factor from elevation hints
    const elevateRes = await fetch(`${BASE}/api/auth/elevate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${level2jwt}`,
      },
      body: JSON.stringify({
        postalCode: PATIENT_2_POSTAL,
      }),
    })
    
    expect(elevateRes.ok).toBe(true)
    const { jwt: level3jwt } = await elevateRes.json() as { jwt: string }
    
    // Retry: Access Level 3 endpoint with new Level 3 JWT
    const res2 = await fetch(`${BASE}/api/auth-test/level3`, {
      headers: { 'Authorization': `Bearer ${level3jwt}` },
    })
    
    expect(res2.ok).toBe(true)
    const successData = await res2.json() as { message: string; level: number }
    expect(successData.level).toBe(3)
    expect(successData.message).toContain('Level 3 access granted')
  })
})
