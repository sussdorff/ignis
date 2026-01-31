import { Hono } from 'hono'
import {
  RequestCallbackRequestSchema,
  type RequestCallbackResponse,
} from '../lib/schemas'
import { createCallbackRequest } from '../lib/aidbox-tasks'

const callback = new Hono()

// =============================================================================
// POST /api/callback - request_callback
// =============================================================================
callback.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'validation_failed', message: 'Invalid JSON' }, 400)
  }

  const parsed = RequestCallbackRequestSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    return c.json({ error: 'validation_failed', message }, 400)
  }

  const { phone, reason, category, patientId, patientName } = parsed.data
  const task = await createCallbackRequest({
    phone,
    reason,
    category,
    patientId,
    patientName,
  })
  const response: RequestCallbackResponse = {
    callbackId: task.id ?? '',
    estimatedTime: 'within 2 hours',
    message: 'Wir rufen Sie innerhalb von 2 Stunden zurück.',
  }
  return c.json(response, 201)
})

export default callback
