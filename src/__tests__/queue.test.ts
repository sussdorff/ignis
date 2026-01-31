import { describe, it, expect } from 'bun:test'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

describe('Queue API', () => {
  it('POST /api/queue/urgent adds patient to urgent queue', async () => {
    const res = await fetch(`${BASE}/api/queue/urgent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'patient-1' }),
    })
    expect(res.status).toBe(201)

    const data = await res.json() as {
      queueEntryId: string
      position?: number
      message?: string
    }
    expect(typeof data.queueEntryId).toBe('string')
  })

  it('POST /api/queue/urgent with unknown patient returns 404', async () => {
    const res = await fetch(`${BASE}/api/queue/urgent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'nonexistent' }),
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/queue/emergency registers emergency transfer', async () => {
    const res = await fetch(`${BASE}/api/queue/emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(201)

    const data = await res.json() as {
      transferId: string
      message?: string
    }
    expect(typeof data.transferId).toBe('string')
  })
})
