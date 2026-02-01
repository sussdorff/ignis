import { describe, it, expect } from 'bun:test'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

// Helper to get today's date in Berlin timezone (YYYY-MM-DD)
function todayBerlin(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

// Helper to get a random available slot for testing (default: today)
async function getRandomAvailableSlot(
  date?: string
): Promise<{ slotId: string; start: string; end: string } | null> {
  const d = date ?? todayBerlin()
  const res = await fetch(`${BASE}/api/appointments/slots?date=${d}&limit=20`)
  if (!res.ok) return null
  const data = await res.json() as { slots: Array<{ slotId: string; start: string; end: string }> }
  if (data.slots.length === 0) return null
  const randomIndex = Math.floor(Math.random() * data.slots.length)
  return data.slots[randomIndex]
}

// Tomorrow in Berlin (YYYY-MM-DD) so booked slots are never "in the past" for cancel tests
function tomorrowBerlin(): string {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  return t.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

describe('Appointments API', () => {
  it('GET /api/appointments/slots returns available slots from Aidbox', async () => {
    const today = todayBerlin()
    const res = await fetch(`${BASE}/api/appointments/slots?date=${today}&limit=5`)
    expect(res.ok).toBe(true)

    const data = await res.json() as {
      slots: Array<{ slotId: string; start: string; end: string; practitionerId?: string; practitionerDisplay?: string }>
    }
    expect(Array.isArray(data.slots)).toBe(true)
    expect(data.slots.length).toBeGreaterThan(0)
    // Slots from Aidbox have real IDs (not stub-)
    expect(data.slots[0].slotId).toBeDefined()
    expect(data.slots[0].start).toContain(today)
    // Should have practitioner info from Schedule
    expect(data.slots[0].practitionerId).toBeDefined()
  })

  it('GET /api/appointments/slots with urgency=urgent on non-today returns empty', async () => {
    const res = await fetch(`${BASE}/api/appointments/slots?date=2030-01-15&urgency=urgent&limit=5`)
    expect(res.ok).toBe(true)

    const data = await res.json() as { slots: unknown[] }
    expect(Array.isArray(data.slots)).toBe(true)
    expect(data.slots.length).toBe(0)
  })

  it('POST /api/appointments books appointment with valid slot and patient', async () => {
    const slot = await getRandomAvailableSlot()
    if (!slot) {
      console.warn('No available slots for booking test - skipping')
      return
    }

    const res = await fetch(`${BASE}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: slot.slotId,
        patientId: 'patient-1',
      }),
    })
    
    // Accept 201 (created) or 409 (slot already taken by another test)
    expect([201, 409]).toContain(res.status)

    if (res.status === 201) {
      const data = await res.json() as {
        appointment: { resourceType?: string }
        start: string
        end: string
      }
      expect(data.appointment?.resourceType).toBe('Appointment')
      expect(data.start).toBeDefined()
      expect(data.end).toBeDefined()
    }
  })

  it('POST /api/appointments with nonexistent slot returns 404', async () => {
    const res = await fetch(`${BASE}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: 'nonexistent-slot-xyz',
        patientId: 'patient-1',
      }),
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/appointments with unknown patient returns 404', async () => {
    const slot = await getRandomAvailableSlot()
    if (!slot) {
      console.warn('No available slots for patient test - skipping')
      return
    }

    const res = await fetch(`${BASE}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: slot.slotId,
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

  it(
    'cancel frees the slot so it appears in available slots again',
    async () => {
      const tomorrow = tomorrowBerlin()
      const slot = await getRandomAvailableSlot(tomorrow)
      if (!slot) {
        console.warn('No available slots for tomorrow - skipping cancel-frees-slot test')
        return
      }

      // Book the slot
      const bookRes = await fetch(`${BASE}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot.slotId,
          patientId: 'patient-1',
        }),
      })
      if (bookRes.status !== 201) {
        console.warn('Could not book slot (maybe taken) - skipping cancel-frees-slot test')
        return
      }
      const bookData = (await bookRes.json()) as { appointment?: { id?: string } }
      const appointmentId = bookData.appointment?.id
      expect(appointmentId).toBeDefined()

      // Cancel the appointment (should free the slot)
      const cancelRes = await fetch(`${BASE}/api/appointments/cancel/${appointmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(cancelRes.status).toBe(200)
      const cancelData = (await cancelRes.json()) as { cancelled?: boolean }
      expect(cancelData.cancelled).toBe(true)

      // Slot should be available again (freed on cancel)
      const slotsAfterCancel = await fetch(
        `${BASE}/api/appointments/slots?date=${tomorrow}&limit=50`
      )
      const afterCancelData = (await slotsAfterCancel.json()) as {
        slots: Array<{ slotId: string }>
      }
      const availableAfterCancel = afterCancelData.slots.some((s) => s.slotId === slot.slotId)
      expect(availableAfterCancel).toBe(true)
    },
    { timeout: 15_000 }
  )
})
