import { describe, it, expect, beforeEach } from 'bun:test'
import { clearAllAuthData } from '../lib/auth-tokens'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

// Clear auth state before each test to ensure isolation
beforeEach(() => {
  clearAllAuthData()
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
