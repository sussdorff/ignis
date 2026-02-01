import { Hono } from 'hono'
import {
  AddToUrgentQueueRequestSchema,
  RegisterEmergencyRequestSchema,
  type AddToUrgentQueueResponse,
  type RegisterEmergencyResponse,
} from '../lib/schemas'
import { getPatientById } from '../lib/aidbox-patients'
import {
  addToQueue,
  getTodayQueue,
  getWaitingPatients,
  getUrgentPatients,
  updateQueueStatus,
  getQueueEntry,
  getQueueStats,
  finishQueueEntry,
  type QueueStatus,
  type Priority,
} from '../lib/aidbox-encounters'

const queue = new Hono()

// =============================================================================
// GET /api/queue - get today's waiting queue
// =============================================================================
queue.get('/', async (c) => {
  const entries = await getTodayQueue()
  return c.json({ queue: entries }, 200)
})

// =============================================================================
// GET /api/queue/waiting - get patients currently in waiting room
// =============================================================================
queue.get('/waiting', async (c) => {
  const entries = await getWaitingPatients()
  return c.json({ queue: entries }, 200)
})

// =============================================================================
// GET /api/queue/urgent - get urgent/emergency patients
// =============================================================================
queue.get('/urgent', async (c) => {
  const entries = await getUrgentPatients()
  return c.json({ queue: entries }, 200)
})

// =============================================================================
// GET /api/queue/stats - get queue statistics
// =============================================================================
queue.get('/stats', async (c) => {
  const stats = await getQueueStats()
  return c.json(stats, 200)
})

// =============================================================================
// POST /api/queue - add patient to queue
// =============================================================================
queue.post('/', async (c) => {
  let body: {
    patientId: string
    patientName?: string
    appointmentId?: string
    status?: QueueStatus
    priority?: Priority
    reason?: string
    doctor?: string
  }

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'validation_failed', message: 'Invalid JSON' }, 400)
  }

  if (!body.patientId) {
    return c.json({ error: 'validation_failed', message: 'patientId is required' }, 400)
  }

  // Try to get patient name from database if not provided
  let patientName = body.patientName
  if (!patientName) {
    const patient = await getPatientById(body.patientId)
    if (patient) {
      const name = patient.name?.[0]
      const firstName = name?.given?.join(' ') ?? ''
      const lastName = name?.family ?? ''
      patientName = [firstName, lastName].filter(Boolean).join(' ') || 'Unbekannt'
    }
  }

  const entry = await addToQueue({
    patientId: body.patientId,
    patientName: patientName ?? 'Unbekannt',
    appointmentId: body.appointmentId,
    status: body.status,
    priority: body.priority,
    reason: body.reason,
    doctor: body.doctor,
  })

  return c.json(entry, 201)
})

// =============================================================================
// PATCH /api/queue/:id - update queue entry
// =============================================================================
queue.patch('/:id', async (c) => {
  const id = c.req.param('id')

  let body: { status?: QueueStatus; priority?: Priority; room?: string; doctor?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'validation_failed', message: 'Invalid JSON' }, 400)
  }

  const entry = await updateQueueStatus(id, body)
  if (!entry) {
    return c.json({ error: 'not_found' }, 404)
  }

  return c.json(entry, 200)
})

// =============================================================================
// DELETE /api/queue/:id - remove from queue (mark as finished)
// =============================================================================
queue.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const success = await finishQueueEntry(id)

  if (!success) {
    return c.json({ error: 'not_found' }, 404)
  }

  return c.json({ ok: true }, 200)
})

// =============================================================================
// POST /api/queue/urgent - add_to_urgent_queue (legacy API)
// =============================================================================
queue.post('/urgent', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'validation_failed', message: 'Invalid JSON' }, 400)
  }

  const parsed = AddToUrgentQueueRequestSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    return c.json({ error: 'validation_failed', message }, 400)
  }

  const { patientId, reason } = parsed.data

  const patient = await getPatientById(patientId)
  if (!patient) {
    return c.json({ error: 'not_found' }, 404)
  }

  // Get patient name
  const name = patient.name?.[0]
  const firstName = name?.given?.join(' ') ?? ''
  const lastName = name?.family ?? ''
  const patientName = [firstName, lastName].filter(Boolean).join(' ') || 'Unbekannt'

  // Add to queue with urgent priority
  const entry = await addToQueue({
    patientId,
    patientName,
    status: 'wartend',
    priority: 'dringend',
    reason: reason ?? 'Dringender Fall',
  })

  const urgentPatients = await getUrgentPatients()
  const response: AddToUrgentQueueResponse = {
    queueEntryId: entry.id,
    position: urgentPatients.length,
    message: 'Sie wurden in die dringende Warteschlange eingetragen. Wir rufen Sie zurück.',
  }
  return c.json(response, 201)
})

// =============================================================================
// POST /api/queue/emergency - register_emergency_transfer
// =============================================================================
queue.post('/emergency', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }

  const parsed = RegisterEmergencyRequestSchema.safeParse(body)
  const data = parsed.success ? parsed.data : {}

  // If we have a patient ID, add to queue as emergency
  if (data.patientId) {
    const patient = await getPatientById(data.patientId)
    if (patient) {
      const name = patient.name?.[0]
      const firstName = name?.given?.join(' ') ?? ''
      const lastName = name?.family ?? ''
      const patientName = [firstName, lastName].filter(Boolean).join(' ') || 'Notfall'

      await addToQueue({
        patientId: data.patientId,
        patientName,
        status: 'wartend',
        priority: 'notfall',
        reason: data.reason ?? 'Notfall',
      })
    }
  }

  const response: RegisterEmergencyResponse = {
    transferId: crypto.randomUUID(),
    message: 'Notfall erfasst. Sie werden mit einem Mitarbeiter verbunden.',
  }
  return c.json(response, 201)
})

export default queue
