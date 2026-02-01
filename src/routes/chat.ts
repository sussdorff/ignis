import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  createChatSession,
  sendMessage,
  getSession,
  endSession,
  getActiveSessions,
} from '../lib/chat-session'

const chat = new Hono()

// =============================================================================
// Schema definitions
// =============================================================================

const CreateSessionSchema = z.object({
  patientId: z.string().optional(),
})

const SendMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
})

// =============================================================================
// POST /api/chat/session - Create new chat session
// =============================================================================
chat.post(
  '/session',
  zValidator('json', CreateSessionSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues
      const message = issues.map((e) => e.message).join('; ')
      return c.json({ error: 'validation_failed', message }, 400)
    }
  }),
  async (c) => {
    const { patientId } = c.req.valid('json')

    try {
      const { sessionId, status } = await createChatSession(patientId)

      return c.json(
        {
          sessionId,
          status,
          message: 'Chat session created successfully',
        },
        201
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // Check for missing credentials
      if (message.includes('Missing ElevenLabs credentials')) {
        return c.json({ error: 'configuration_error', message }, 503)
      }

      console.error('[Chat] Failed to create session:', error)
      return c.json({ error: 'session_creation_failed', message }, 500)
    }
  }
)

// =============================================================================
// POST /api/chat/message - Send message and get response
// =============================================================================
chat.post(
  '/message',
  zValidator('json', SendMessageSchema.extend({ sessionId: z.string().min(1) }), (result, c) => {
    if (!result.success) {
      const issues = result.error.issues
      const message = issues.map((e) => e.message).join('; ')
      return c.json({ error: 'validation_failed', message }, 400)
    }
  }),
  async (c) => {
    const { sessionId, message } = c.req.valid('json')

    try {
      const result = await sendMessage(sessionId, message)

      return c.json({
        sessionId,
        response: result.response,
        messages: result.messages,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage === 'Session not found') {
        return c.json({ error: 'session_not_found', message: errorMessage }, 404)
      }

      if (errorMessage.includes('cannot send message')) {
        return c.json({ error: 'session_inactive', message: errorMessage }, 400)
      }

      if (errorMessage === 'Response timeout') {
        return c.json({ error: 'response_timeout', message: 'Agent did not respond in time' }, 504)
      }

      console.error('[Chat] Failed to send message:', error)
      return c.json({ error: 'message_failed', message: errorMessage }, 500)
    }
  }
)

// =============================================================================
// GET /api/chat/session/:id - Get session history
// =============================================================================
chat.get('/session/:id', async (c) => {
  const sessionId = c.req.param('id')

  if (!sessionId) {
    return c.json({ error: 'validation_failed', message: 'Session ID is required' }, 400)
  }

  const session = getSession(sessionId)

  if (!session) {
    return c.json({ error: 'session_not_found', message: 'Session not found' }, 404)
  }

  return c.json({
    sessionId: session.id,
    patientId: session.patientId,
    status: session.status,
    messages: session.messages,
    createdAt: session.createdAt.toISOString(),
    lastActivityAt: session.lastActivityAt.toISOString(),
  })
})

// =============================================================================
// DELETE /api/chat/session/:id - End session
// =============================================================================
chat.delete('/session/:id', async (c) => {
  const sessionId = c.req.param('id')

  if (!sessionId) {
    return c.json({ error: 'validation_failed', message: 'Session ID is required' }, 400)
  }

  const ended = endSession(sessionId)

  if (!ended) {
    return c.json({ error: 'session_not_found', message: 'Session not found' }, 404)
  }

  return c.json({
    sessionId,
    status: 'ended',
    message: 'Session ended successfully',
  })
})

// =============================================================================
// GET /api/chat/sessions - List active sessions (for monitoring)
// Only available in non-production environments
// =============================================================================
chat.get('/sessions', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    return c.json({ error: 'forbidden', message: 'Not available in production' }, 403)
  }

  const sessions = getActiveSessions()

  return c.json({
    count: sessions.length,
    sessions: sessions.map((s) => ({
      sessionId: s.id,
      patientId: s.patientId,
      status: s.status,
      messageCount: s.messageCount,
      createdAt: s.createdAt.toISOString(),
      lastActivityAt: s.lastActivityAt.toISOString(),
    })),
  })
})

export default chat
