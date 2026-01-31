import { Hono } from 'hono'
import {
  SlotsQuerySchema,
  BookAppointmentRequestSchema,
  type Slot,
  type SlotsResponse,
  type BookAppointmentResponse,
  type CancelAppointmentResponse,
} from '../lib/schemas'
import { getPatientById } from '../lib/aidbox-patients'
import { cancelAppointment, createAppointment } from '../lib/aidbox-appointments'

const appointments = new Hono()

const STUB_PRACTITIONER_ID = 'practitioner-1'
const STUB_PRACTITIONER_DISPLAY = 'Dr. Anna Schmidt'
const SLOT_DURATION_MINUTES = 30
const STUB_START_HOUR = 9
const STUB_START_MINUTE = 0
const STUB_END_HOUR = 11
const STUB_END_MINUTE = 30

/** Generate stub slots for a given date (Europe/Berlin). */
function generateStubSlots(date: string, limit: number): Slot[] {
  const slots: Slot[] = []
  let hour = STUB_START_HOUR
  let minute = STUB_START_MINUTE
  for (let i = 0; i < limit; i++) {
    const start = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+01:00`
    minute += SLOT_DURATION_MINUTES
    if (minute >= 60) {
      minute = 0
      hour += 1
    }
    if (hour > STUB_END_HOUR || (hour === STUB_END_HOUR && minute > STUB_END_MINUTE)) break
    const end = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+01:00`
    slots.push({
      slotId: `stub-${date}-${i}`,
      start,
      end,
      practitionerId: STUB_PRACTITIONER_ID,
      practitionerDisplay: STUB_PRACTITIONER_DISPLAY,
    })
  }
  return slots
}

/** Derive start/end from stub slotId (stub-YYYY-MM-DD-index). */
function stubSlotTimes(slotId: string): { start: string; end: string } | null {
  const match = /^stub-(\d{4}-\d{2}-\d{2})-(\d+)$/.exec(slotId)
  if (!match) return null
  const [, date, indexStr] = match
  const index = parseInt(indexStr, 10)
  const slots = generateStubSlots(date, index + 1)
  const slot = slots[index]
  return slot ? { start: slot.start, end: slot.end } : null
}

/** Today's date in Europe/Berlin (YYYY-MM-DD). */
function todayBerlin(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

// =============================================================================
// GET /api/appointments/slots - get_available_slots
// =============================================================================
appointments.get('/slots', async (c) => {
  const parsed = SlotsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    return c.json({ error: 'validation_failed', message }, 400)
  }

  const { date, urgency, limit } = parsed.data
  if (urgency === 'urgent' && date !== todayBerlin()) {
    return c.json({ slots: [] }, 200)
  }
  const slots = generateStubSlots(date, limit)
  const response: SlotsResponse = { slots }
  return c.json(response, 200)
})

// =============================================================================
// POST /api/appointments - book_appointment
// =============================================================================
appointments.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'validation_failed', message: 'Invalid JSON' }, 400)
  }

  const parsed = BookAppointmentRequestSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    return c.json({ error: 'validation_failed', message }, 400)
  }

  const { slotId, patientId, practitionerId, type, reason } = parsed.data

  const times = stubSlotTimes(slotId)
  if (!times) {
    return c.json(
      { error: 'not_found', resource: 'slot', slotId },
      404
    )
  }

  const patient = await getPatientById(patientId)
  if (!patient) {
    return c.json(
      { error: 'not_found', resource: 'patient', patientId },
      404
    )
  }

  const pracId = practitionerId ?? STUB_PRACTITIONER_ID
  const result = await createAppointment({
    start: times.start,
    end: times.end,
    patientId,
    practitionerId: pracId,
    practitionerDisplay: STUB_PRACTITIONER_DISPLAY,
    type: type ?? 'routine',
    reason,
  })

  if (result.ok === false && result.code === 'slot_unavailable') {
    return c.json({ error: 'slot_unavailable' }, 409)
  }

  const appt = result.appointment
  const response: BookAppointmentResponse = {
    appointment: {
      resourceType: appt.resourceType,
      id: appt.id,
      status: appt.status,
      start: appt.start,
      end: appt.end,
      participant: appt.participant,
      description: appt.description,
      appointmentType: appt.appointmentType,
    },
    start: times.start,
    end: times.end,
    confirmationMessage: `Ihre Termin wurde für ${times.start} bestätigt.`,
  }
  return c.json(response, 201)
})

// =============================================================================
// POST /api/appointments/cancel/:appointmentId - cancel_appointment
// =============================================================================
appointments.post('/cancel/:appointmentId', async (c) => {
  const appointmentId = c.req.param('appointmentId')
  if (!appointmentId) {
    return c.json({ error: 'validation_failed', message: 'appointmentId is required' }, 400)
  }

  const result = await cancelAppointment(appointmentId)

  if (result.ok === false && result.code === 'not_found') {
    return c.json({ error: 'not_found' }, 404)
  }
  if (result.ok === false && result.code === 'conflict') {
    return c.json({ error: 'appointment_conflict', reason: result.reason }, 409)
  }

  const response: CancelAppointmentResponse = {
    cancelled: true,
    appointmentId: result.appointmentId,
    message: 'Der Termin wurde storniert.',
  }
  return c.json(response, 200)
})

export default appointments
