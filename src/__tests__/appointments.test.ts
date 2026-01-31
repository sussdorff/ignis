import { describe, it, expect } from 'bun:test'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

describe('Appointments API', () => {
  it('GET /api/appointments/slots returns available slots', async () => {
    const res = await fetch(`${BASE}/api/appointments/slots?date=2026-02-01&limit=5`)
    expect(res.ok).toBe(true)

    const data = await res.json() as {
      slots: Array<{ slotId: string; start: string; end: string }>
    }
    expect(Array.isArray(data.slots)).toBe(true)
    expect(data.slots.length).toBeGreaterThan(0)
    expect(data.slots[0].slotId).toMatch(/^stub-/)
    expect(data.slots[0].start).toContain('2026-02-01')
  })

  it('GET /api/appointments/slots with urgency=urgent on non-today returns empty', async () => {
    const res = await fetch(`${BASE}/api/appointments/slots?date=2030-01-15&urgency=urgent&limit=5`)
    expect(res.ok).toBe(true)

    const data = await res.json() as { slots: unknown[] }
    expect(Array.isArray(data.slots)).toBe(true)
    expect(data.slots.length).toBe(0)
  })

  it('POST /api/appointments books appointment with valid patient', async () => {
    const res = await fetch(`${BASE}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: 'stub-2026-02-01-0',
        patientId: 'patient-1',
      }),
    })
    expect(res.status).toBe(201)

    const data = await res.json() as {
      appointment: { resourceType?: string }
      start: string
      end: string
    }
    expect(data.appointment?.resourceType).toBe('Appointment')
    expect(data.start).toBeDefined()
    expect(data.end).toBeDefined()
  })

  it('POST /api/appointments with unknown patient returns 404', async () => {
    const res = await fetch(`${BASE}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: 'stub-2026-02-01-0',
        patientId: 'nonexistent-patient',
      }),
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/appointments/cancel/:id cancels or returns conflict', async () => {
    const res = await fetch(`${BASE}/api/appointments/cancel/appointment-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    // Either 200 (cancelled) or 409 (already cancelled)
    expect([200, 409]).toContain(res.status)

    const data = await res.json() as {
      cancelled?: boolean
      appointmentId?: string
      error?: string
    }

    if (res.status === 200) {
      expect(data.cancelled).toBe(true)
      expect(data.appointmentId).toBeDefined()
    } else {
      expect(data.error).toBe('appointment_conflict')
    }
  })

  it('POST /api/appointments/cancel with nonexistent id returns 404', async () => {
    const res = await fetch(`${BASE}/api/appointments/cancel/nonexistent-appointment-xyz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(404)
  })
})
