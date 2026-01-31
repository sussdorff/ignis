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
import {
  cancelAppointment,
  createAppointment,
  getAvailableSlots,
  getSlotWithPractitioner,
  updateSlotStatus,
} from '../lib/aidbox-appointments'

const appointments = new Hono()

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

  const { date, urgency, practitionerId, limit } = parsed.data

  // For urgent requests, only return slots for today
  if (urgency === 'urgent' && date !== todayBerlin()) {
    return c.json({ slots: [] }, 200)
  }

  try {
    // Query real slots from Aidbox
    const availableSlots = await getAvailableSlots({
      date,
      practitionerId,
      limit,
    })

    // Map to API response format
    const slots: Slot[] = availableSlots.map((s) => ({
      slotId: s.slotId,
      start: s.start,
      end: s.end,
      practitionerId: s.practitionerId,
      practitionerDisplay: s.practitionerDisplay,
    }))

    const response: SlotsResponse = { slots }
    return c.json(response, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[appointments/slots] Error fetching slots:', message)
    return c.json(
      { error: 'internal', message: 'Failed to fetch available slots' },
      502
    )
  }
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

  // Get real slot data from Aidbox
  const slotInfo = await getSlotWithPractitioner(slotId)
  if (!slotInfo) {
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

  // Use practitioner from slot, or override if provided in request
  const pracId = practitionerId ?? slotInfo.practitionerId ?? 'unknown'
  const pracDisplay = slotInfo.practitionerDisplay

  const result = await createAppointment({
    start: slotInfo.start,
    end: slotInfo.end,
    patientId,
    practitionerId: pracId,
    practitionerDisplay: pracDisplay,
    type: type ?? 'routine',
    reason,
  })

  if (result.ok === false && result.code === 'slot_unavailable') {
    return c.json({ error: 'slot_unavailable' }, 409)
  }

  // Mark the slot as busy after successful booking
  try {
    await updateSlotStatus(slotId, 'busy')
  } catch (err) {
    console.error('[appointments/book] Failed to update slot status:', err)
    // Continue anyway - appointment is booked, slot status is non-critical
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
    start: slotInfo.start,
    end: slotInfo.end,
    confirmationMessage: `Ihr Termin wurde für ${slotInfo.start} bestätigt.`,
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
