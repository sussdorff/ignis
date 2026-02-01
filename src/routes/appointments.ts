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
import { cancelAppointment, getTodayAppointments, updateAppointmentStatus } from '../lib/aidbox-appointments'

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

/** Get current time in Europe/Berlin as ISO string. */
function nowBerlin(): Date {
  // Create a date object representing "now" in Berlin timezone
  const now = new Date()
  return now
}

/** Get minimum allowed slot time (30 minutes from now). */
function getMinSlotTime(): Date {
  const now = nowBerlin()
  now.setMinutes(now.getMinutes() + 30)
  return now
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
  
  // Generate slots and filter out past times (must be at least 30 min from now)
  const allSlots = generateStubSlots(date, limit * 2) // Generate extra to account for filtering
  const minTime = getMinSlotTime()
  const today = todayBerlin()
  
  // Only filter by time if the requested date is today
  const filteredSlots = date === today
    ? allSlots.filter(slot => new Date(slot.start) >= minTime)
    : allSlots
  
  // Limit to requested amount
  const slots = filteredSlots.slice(0, limit)
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

  const { slotId, patientId } = parsed.data

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

  const response: BookAppointmentResponse = {
    appointment: {
      resourceType: 'Appointment',
      id: `stub-${Date.now()}`,
      status: 'booked',
      start: times.start,
      end: times.end,
      participant: [
        { actor: { reference: `Patient/${patientId}` }, status: 'accepted' },
        { actor: { reference: `Practitioner/${STUB_PRACTITIONER_ID}` }, status: 'accepted' },
      ],
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

export default appointments
