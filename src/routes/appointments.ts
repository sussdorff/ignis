import { Hono } from 'hono'
import {
  SlotsQuerySchema,
  SlotsNextQuerySchema,
  BookAppointmentRequestSchema,
  type SlotsResponse,
  type BookAppointmentResponse,
  type CancelAppointmentResponse,
} from '../lib/schemas'
import {
  cancelAppointment,
  createAppointment,
  getTodayAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
} from '../lib/aidbox-appointments'
import { addSSEClient, removeSSEClient, getSSEClientCount } from '../lib/sse-broadcaster'
import { getSlotsForDate, getNextSlots, getSlotById } from '../lib/aidbox-slots'
import { getPatientById } from '../lib/aidbox-patients'

const appointments = new Hono()

// =============================================================================
// GET /api/appointments/events - SSE endpoint for real-time updates
// IMPORTANT: This must come before any /:appointmentId routes
// =============================================================================
appointments.get('/events', (c) => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      addSSEClient(controller)

      // Send initial connection message
      const encoder = new TextEncoder()
      const connectMsg = encoder.encode(`data: ${JSON.stringify({ type: 'connected', clients: getSSEClientCount() })}\n\n`)
      controller.enqueue(connectMsg)
    },
    cancel(controller) {
      removeSSEClient(controller)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
})

/** Today's date in Europe/Berlin (YYYY-MM-DD). */
function todayBerlin(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

/** Minimum slot start time (30 minutes from now). */
function getMinSlotTime(): Date {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 30)
  return now
}

// =============================================================================
// GET /api/appointments/slots/next - next N available slots from now (ig-afr)
// =============================================================================
appointments.get('/slots/next', async (c) => {
  const parsed = SlotsNextQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    return c.json({ error: 'validation_failed', message }, 400)
  }
  const { limit } = parsed.data
  const slots = await getNextSlots(limit)
  return c.json({ slots } satisfies SlotsResponse, 200)
})

// =============================================================================
// GET /api/appointments/slots - get_available_slots (FHIR Slot query)
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

  const today = todayBerlin()
  const minStart = date === today ? getMinSlotTime() : undefined
  const slots = await getSlotsForDate(date, limit, { minStartTime: minStart })
  return c.json({ slots } satisfies SlotsResponse, 200)
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

  const { slotId, patientId } = parsed.data

  const slot = await getSlotById(slotId)
  if (!slot) {
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

  try {
    const appt = await createAppointment({
      start: slot.start,
      end: slot.end,
      patientId,
      slotId,
      practitionerId: slot.practitionerId,
      practitionerDisplay: slot.practitionerDisplay,
    })
    const response: BookAppointmentResponse = {
      appointment: {
        resourceType: 'Appointment',
        id: appt.id ?? `apt-${Date.now()}`,
        status: 'booked',
        start: slot.start,
        end: slot.end,
        participant: [
          { actor: { reference: `Patient/${patientId}` }, status: 'accepted' },
          { actor: { reference: `Practitioner/${slot.practitionerId}` }, status: 'accepted' },
        ],
      },
      start: slot.start,
      end: slot.end,
      confirmationMessage: `Ihre Termin wurde für ${slot.start} bestätigt.`,
    }
    return c.json(response, 201)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('409') || msg.includes('conflict')) {
      return c.json({ error: 'slot_unavailable', message: 'Slot is no longer available' }, 409)
    }
    throw err
  }
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

// =============================================================================
// GET /api/appointments/today - get today's appointments
// =============================================================================
appointments.get('/today', async (c) => {
  const todayAppointments = await getTodayAppointments()
  return c.json({ appointments: todayAppointments }, 200)
})

// =============================================================================
// GET /api/appointments/intake-questions - get_intake_questions
// Returns follow-up questions to ask patient after booking, based on reason
// =============================================================================
appointments.get('/intake-questions', async (c) => {
  const { reason, type, patientId } = c.req.query()
  
  // Define questions based on appointment reason/type
  const baseQuestions = [
    {
      id: 'symptoms_duration',
      question: 'Wie lange haben Sie diese Beschwerden schon?',
      question_en: 'How long have you had these symptoms?',
      type: 'text',
      required: true,
    },
    {
      id: 'symptoms_severity',
      question: 'Auf einer Skala von 1 bis 10, wie stark sind Ihre Beschwerden?',
      question_en: 'On a scale of 1 to 10, how severe are your symptoms?',
      type: 'number',
      required: true,
    },
    {
      id: 'previous_treatment',
      question: 'Haben Sie bereits etwas dagegen unternommen oder Medikamente eingenommen?',
      question_en: 'Have you already tried any treatment or taken any medication?',
      type: 'text',
      required: false,
    },
  ]
  
  // Add type-specific questions
  const typeQuestions: Record<string, typeof baseQuestions> = {
    routine: [
      {
        id: 'last_checkup',
        question: 'Wann war Ihre letzte Vorsorgeuntersuchung?',
        question_en: 'When was your last check-up?',
        type: 'text',
        required: false,
      },
    ],
    urgent: [
      {
        id: 'symptoms_worsening',
        question: 'Haben sich die Beschwerden in den letzten Stunden verschlechtert?',
        question_en: 'Have your symptoms worsened in the last few hours?',
        type: 'boolean',
        required: true,
      },
      {
        id: 'pain_location',
        question: 'Wo genau haben Sie Schmerzen?',
        question_en: 'Where exactly do you have pain?',
        type: 'text',
        required: true,
      },
    ],
    followup: [
      {
        id: 'treatment_effect',
        question: 'Hat die bisherige Behandlung geholfen?',
        question_en: 'Has the previous treatment helped?',
        type: 'boolean',
        required: true,
      },
      {
        id: 'new_symptoms',
        question: 'Sind neue Beschwerden aufgetreten?',
        question_en: 'Have any new symptoms appeared?',
        type: 'text',
        required: false,
      },
    ],
  }
  
  // Reason-specific questions
  const reasonQuestions: Record<string, typeof baseQuestions> = {
    vaccination: [
      {
        id: 'allergies',
        question: 'Haben Sie Allergien, insbesondere gegen Impfstoffe oder deren Bestandteile?',
        question_en: 'Do you have any allergies, especially to vaccines or their components?',
        type: 'boolean',
        required: true,
      },
      {
        id: 'current_illness',
        question: 'Fühlen Sie sich heute gesund? Haben Sie Fieber oder eine Erkältung?',
        question_en: 'Do you feel healthy today? Do you have a fever or cold?',
        type: 'boolean',
        required: true,
      },
    ],
    checkup: [
      {
        id: 'concerns',
        question: 'Gibt es bestimmte Themen, die Sie bei der Untersuchung ansprechen möchten?',
        question_en: 'Are there specific topics you would like to discuss during the examination?',
        type: 'text',
        required: false,
      },
    ],
  }
  
  // Build response
  let questions = [...baseQuestions]
  
  if (type && typeQuestions[type]) {
    questions = [...questions, ...typeQuestions[type]]
  }
  
  // Check if reason matches any specific category
  const reasonLower = (reason || '').toLowerCase()
  if (reasonLower.includes('impf') || reasonLower.includes('vaccin')) {
    questions = [...questions, ...reasonQuestions.vaccination]
  } else if (reasonLower.includes('vorsorge') || reasonLower.includes('check')) {
    questions = [...questions, ...reasonQuestions.checkup]
  }
  
  return c.json({
    questions,
    totalQuestions: questions.length,
    patientId: patientId || null,
    appointmentType: type || 'routine',
    reason: reason || null,
  }, 200)
})

// =============================================================================
// PATCH /api/appointments/:appointmentId/status - update appointment status
// =============================================================================
appointments.patch('/:appointmentId/status', async (c) => {
  const appointmentId = c.req.param('appointmentId')
  
  let body: { status?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'validation_failed', message: 'Invalid JSON' }, 400)
  }
  
  const validStatuses = ['booked', 'arrived', 'fulfilled', 'cancelled', 'noshow']
  if (!body.status || !validStatuses.includes(body.status)) {
    return c.json({
      error: 'validation_failed',
      message: `status must be one of: ${validStatuses.join(', ')}`
    }, 400)
  }
  
  const result = await updateAppointmentStatus(
    appointmentId,
    body.status as 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow'
  )
  
  if (!result.ok) {
    return c.json({ error: result.error ?? 'not_found' }, 404)
  }
  
  return c.json({ ok: true, appointmentId, status: body.status }, 200)
})

// =============================================================================
// PATCH /api/appointments/:appointmentId/reschedule - reschedule appointment
// =============================================================================
appointments.patch('/:appointmentId/reschedule', async (c) => {
  const appointmentId = c.req.param('appointmentId')

  let body: { start?: string; end?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'validation_failed', message: 'Invalid JSON' }, 400)
  }

  if (!body.start || !body.end) {
    return c.json({
      error: 'validation_failed',
      message: 'start and end are required',
    }, 400)
  }

  // Validate ISO date strings
  const startDate = new Date(body.start)
  const endDate = new Date(body.end)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return c.json({
      error: 'validation_failed',
      message: 'start and end must be valid ISO date strings',
    }, 400)
  }

  const result = await rescheduleAppointment(appointmentId, {
    start: body.start,
    end: body.end,
  })

  if (!result.ok && result.code === 'not_found') {
    return c.json({ error: 'not_found' }, 404)
  }
  if (!result.ok && result.code === 'conflict') {
    return c.json({ error: 'conflict', reason: result.reason }, 409)
  }

  return c.json({
    ok: true,
    appointmentId: result.appointmentId,
    start: result.start,
    end: result.end,
  }, 200)
})

export default appointments
