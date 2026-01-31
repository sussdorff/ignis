import { Hono } from 'hono'
import {
  AddToUrgentQueueRequestSchema,
  RegisterEmergencyRequestSchema,
  type AddToUrgentQueueResponse,
  type RegisterEmergencyResponse,
} from '../lib/schemas'
import { getPatientById } from '../lib/aidbox-patients'

const queue = new Hono()

function randomId(): string {
  return crypto.randomUUID()
}

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

  const { patientId } = parsed.data

  const patient = await getPatientById(patientId)
  if (!patient) {
    return c.json({ error: 'not_found' }, 404)
  }

  const response: AddToUrgentQueueResponse = {
    queueEntryId: randomId(),
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
  const _data = parsed.success ? parsed.data : {}

  const response: RegisterEmergencyResponse = {
    transferId: randomId(),
    message: 'Notfall erfasst. Sie werden mit einem Mitarbeiter verbunden.',
  }
  return c.json(response, 201)
})

export default queue
