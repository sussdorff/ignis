import { Hono } from 'hono'
import {
  AddToUrgentQueueRequestSchema,
  RegisterEmergencyRequestSchema,
  type AddToUrgentQueueResponse,
  type RegisterEmergencyResponse,
} from '../lib/schemas'
import { getPatientById } from '../lib/aidbox-patients'
import { createUrgentQueueEntry, createEmergencyTransfer } from '../lib/aidbox-tasks'

const queue = new Hono()

// =============================================================================
// POST /api/queue/urgent - add_to_urgent_queue
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

  const { patientId, reason, phone } = parsed.data

  const patient = await getPatientById(patientId)
  if (!patient) {
    return c.json({ error: 'not_found' }, 404)
  }

  const task = await createUrgentQueueEntry({ patientId, reason, phone })
  const response: AddToUrgentQueueResponse = {
    queueEntryId: task.id ?? '',
    position: 1,
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

  const task = await createEmergencyTransfer({
    patientId: data.patientId,
    phone: data.phone,
    reason: data.reason,
  })
  const response: RegisterEmergencyResponse = {
    transferId: task.id ?? '',
    message: 'Notfall erfasst. Sie werden mit einem Mitarbeiter verbunden.',
  }
  return c.json(response, 201)
})

export default queue
