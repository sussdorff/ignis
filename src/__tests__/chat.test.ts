import { describe, it, expect, beforeAll, afterAll } from 'bun:test'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

/**
 * Chat API Integration Tests
 *
 * These tests verify the /api/chat/* endpoints for text-based chat sessions.
 * Note: Full integration tests require:
 * - ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID environment variables
 * - The server to be running (`bun run dev`)
 *
 * Tests are organized to work in both environments:
 * - With ElevenLabs: Full end-to-end chat flow
 * - Without ElevenLabs: Validation and error handling tests
 */

// Check if ElevenLabs credentials are available
const hasElevenLabsCredentials = !!(
  process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID
)

describe('Chat API - Validation', () => {
  it('POST /api/chat/session accepts empty body', async () => {
    const res = await fetch(`${BASE}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    // Without ElevenLabs credentials, we expect 503 (config error)
    // With credentials but no connection, we expect 500 or 201
    expect([201, 500, 503].includes(res.status)).toBe(true)
  })

  it('POST /api/chat/session accepts optional patientId', async () => {
    const res = await fetch(`${BASE}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'patient-1' }),
    })

    // Should accept patientId parameter
    expect([201, 500, 503].includes(res.status)).toBe(true)
  })

  it('POST /api/chat/message returns 400 for missing sessionId', async () => {
    const res = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    })

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('validation_failed')
  })

  it('POST /api/chat/message returns 400 for missing message', async () => {
    const res = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test-session' }),
    })

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('validation_failed')
  })

  it('POST /api/chat/message returns 400 for empty message', async () => {
    const res = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test-session', message: '' }),
    })

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('validation_failed')
  })

  it('POST /api/chat/message returns 404 for nonexistent session', async () => {
    const res = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'nonexistent-session-xyz',
        message: 'Hello',
      }),
    })

    expect(res.status).toBe(404)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('session_not_found')
  })

  it('GET /api/chat/session/:id returns 404 for nonexistent session', async () => {
    const res = await fetch(`${BASE}/api/chat/session/nonexistent-session-xyz`)

    expect(res.status).toBe(404)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('session_not_found')
  })

  it('DELETE /api/chat/session/:id returns 404 for nonexistent session', async () => {
    const res = await fetch(`${BASE}/api/chat/session/nonexistent-session-xyz`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('session_not_found')
  })
})

describe('Chat API - Sessions List (Non-Production)', () => {
  it('GET /api/chat/sessions returns active sessions list', async () => {
    const res = await fetch(`${BASE}/api/chat/sessions`)

    // In non-production, should return 200
    // In production, should return 403
    if (process.env.NODE_ENV === 'production') {
      expect(res.status).toBe(403)
    } else {
      expect(res.status).toBe(200)
      const data = (await res.json()) as {
        count: number
        sessions: Array<{ sessionId: string; status: string }>
      }
      expect(typeof data.count).toBe('number')
      expect(Array.isArray(data.sessions)).toBe(true)
    }
  })
})

// These tests require ElevenLabs credentials and may incur API costs
describe.skipIf(!hasElevenLabsCredentials)('Chat API - Full Integration (requires ElevenLabs)', () => {
  let testSessionId: string | null = null

  afterAll(async () => {
    // Clean up test session if created
    if (testSessionId) {
      try {
        await fetch(`${BASE}/api/chat/session/${testSessionId}`, {
          method: 'DELETE',
        })
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  it('creates a chat session successfully', async () => {
    const res = await fetch(`${BASE}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(201)
    const data = (await res.json()) as {
      sessionId: string
      status: string
      message: string
    }

    expect(data.sessionId).toBeDefined()
    expect(data.sessionId.startsWith('chat-')).toBe(true)
    expect(data.status).toBe('active')
    expect(data.message).toBe('Chat session created successfully')

    testSessionId = data.sessionId
  })

  it('retrieves session history', async () => {
    if (!testSessionId) {
      console.log('Skipping - no test session created')
      return
    }

    const res = await fetch(`${BASE}/api/chat/session/${testSessionId}`)

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      sessionId: string
      status: string
      messages: Array<{ role: string; content: string }>
      createdAt: string
      lastActivityAt: string
    }

    expect(data.sessionId).toBe(testSessionId)
    expect(data.status).toBe('active')
    expect(Array.isArray(data.messages)).toBe(true)
    expect(data.createdAt).toBeDefined()
    expect(data.lastActivityAt).toBeDefined()
  })

  it('sends a message and receives a response', async () => {
    if (!testSessionId) {
      console.log('Skipping - no test session created')
      return
    }

    const res = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        message: 'Hello, I would like to schedule an appointment.',
      }),
    })

    // May take time for ElevenLabs to respond
    expect([200, 504].includes(res.status)).toBe(true)

    if (res.status === 200) {
      const data = (await res.json()) as {
        sessionId: string
        response: string
        messages: Array<{ role: string; content: string }>
      }

      expect(data.sessionId).toBe(testSessionId)
      expect(typeof data.response).toBe('string')
      expect(data.response.length).toBeGreaterThan(0)
      expect(data.messages.length).toBeGreaterThanOrEqual(2)

      // Check message structure
      const userMessage = data.messages.find((m) => m.role === 'user')
      const agentMessage = data.messages.find((m) => m.role === 'agent')
      expect(userMessage).toBeDefined()
      expect(agentMessage).toBeDefined()
    }
  })

  it('ends a session successfully', async () => {
    if (!testSessionId) {
      console.log('Skipping - no test session created')
      return
    }

    const res = await fetch(`${BASE}/api/chat/session/${testSessionId}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      sessionId: string
      status: string
      message: string
    }

    expect(data.sessionId).toBe(testSessionId)
    expect(data.status).toBe('ended')
    expect(data.message).toBe('Session ended successfully')

    // Clear session ID so afterAll doesn't try to clean up
    testSessionId = null
  })
})

describe('Chat API - Configuration Error Handling', () => {
  // This test verifies proper error handling when ElevenLabs is not configured
  it('returns appropriate error when ElevenLabs is not configured', async () => {
    // Note: This test's behavior depends on whether ELEVENLABS credentials are set
    const res = await fetch(`${BASE}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    if (!hasElevenLabsCredentials) {
      // Without credentials, expect 503 Service Unavailable
      expect(res.status).toBe(503)
      const data = (await res.json()) as { error: string; message: string }
      expect(data.error).toBe('configuration_error')
      expect(data.message).toContain('Missing ElevenLabs credentials')
    } else {
      // With credentials, expect success or connection error
      expect([201, 500].includes(res.status)).toBe(true)
    }
  })
})

describe('Chat API - Message to Ended Session', () => {
  it('returns error when sending message to ended session', async () => {
    // First create a session (may fail without credentials)
    const createRes = await fetch(`${BASE}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    if (createRes.status !== 201) {
      console.log('Skipping - could not create test session')
      return
    }

    const { sessionId } = (await createRes.json()) as { sessionId: string }

    // End the session
    await fetch(`${BASE}/api/chat/session/${sessionId}`, {
      method: 'DELETE',
    })

    // Try to send a message to the ended session
    const messageRes = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message: 'Hello',
      }),
    })

    expect(messageRes.status).toBe(400)
    const data = (await messageRes.json()) as { error: string }
    expect(data.error).toBe('session_inactive')
  })
})
