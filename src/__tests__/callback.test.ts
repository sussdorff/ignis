import { describe, it, expect } from 'bun:test'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

describe('Callback API', () => {
  it('POST /api/callback creates callback request', async () => {
    const res = await fetch(`${BASE}/api/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+49 170 1112233',
        reason: 'Test callback',
        category: 'general',
      }),
    })
    expect(res.status).toBe(201)

    const data = await res.json() as {
      callbackId: string
      estimatedTime?: string
      message?: string
    }
    expect(typeof data.callbackId).toBe('string')
    expect(data.callbackId.length).toBeGreaterThan(0)
  })

  it('POST /api/callback with invalid category returns 400', async () => {
    const res = await fetch(`${BASE}/api/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+49 111',
        reason: 'X',
        category: 'invalid_category',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/callback accepts all valid categories', async () => {
    const validCategories = [
      'prescription',
      'billing',
      'test_results',
      'insurance',
      'technical_issue',
      'general',
    ]

    for (const category of validCategories) {
      const res = await fetch(`${BASE}/api/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+49 170 0000000',
          reason: `Test ${category}`,
          category,
        }),
      })
      expect(res.status).toBe(201)
    }
  })
})
