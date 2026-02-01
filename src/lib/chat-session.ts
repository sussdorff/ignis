/**
 * Chat Session Manager
 * Manages text-based chat sessions with ElevenLabs Conversational AI
 *
 * Sessions use WebSocket connections to ElevenLabs for real-time text chat.
 * The WebSocket API supports both voice and text modes.
 */

import WebSocket from 'ws'

interface ChatMessage {
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

interface ChatSession {
  id: string
  patientId?: string
  agentId: string
  status: 'connecting' | 'active' | 'ended' | 'error'
  messages: ChatMessage[]
  createdAt: Date
  lastActivityAt: Date
  ws?: WebSocket
  pendingResponse?: {
    resolve: (text: string) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }
}

/** In-memory session store (should be Redis/DB in production) */
const sessions = new Map<string, ChatSession>()

/** Session timeout (5 minutes of inactivity) */
const SESSION_TIMEOUT_MS = 5 * 60 * 1000

/** Response timeout (30 seconds to wait for agent response) */
const RESPONSE_TIMEOUT_MS = 30 * 1000

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Get ElevenLabs API configuration from environment
 */
function getConfig(): { apiKey: string; agentId: string } {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID

  if (!apiKey || !agentId) {
    throw new Error(
      'Missing ElevenLabs credentials. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID environment variables.'
    )
  }

  return { apiKey, agentId }
}

/**
 * Get a signed WebSocket URL from ElevenLabs
 */
async function getSignedUrl(agentId: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
    {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get signed URL: ${response.status} - ${error}`)
  }

  const data = (await response.json()) as { signed_url: string }
  return data.signed_url
}

/**
 * Create a new chat session
 */
export async function createChatSession(patientId?: string): Promise<{
  sessionId: string
  status: ChatSession['status']
}> {
  const { apiKey, agentId } = getConfig()
  const sessionId = generateSessionId()

  const session: ChatSession = {
    id: sessionId,
    patientId,
    agentId,
    status: 'connecting',
    messages: [],
    createdAt: new Date(),
    lastActivityAt: new Date(),
  }

  sessions.set(sessionId, session)

  try {
    // Get signed WebSocket URL
    const signedUrl = await getSignedUrl(agentId, apiKey)

    // Connect to ElevenLabs WebSocket
    const ws = new WebSocket(signedUrl)

    session.ws = ws

    ws.on('open', () => {
      console.log(`[Chat] Session ${sessionId} connected to ElevenLabs`)
      session.status = 'active'
      session.lastActivityAt = new Date()
    })

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        handleWebSocketMessage(session, message)
      } catch (err) {
        console.error(`[Chat] Failed to parse message:`, err)
      }
    })

    ws.on('close', (code, reason) => {
      console.log(`[Chat] Session ${sessionId} disconnected: ${code} ${reason}`)
      session.status = 'ended'
      // Reject any pending response
      if (session.pendingResponse) {
        clearTimeout(session.pendingResponse.timeout)
        session.pendingResponse.reject(new Error('WebSocket closed'))
        session.pendingResponse = undefined
      }
    })

    ws.on('error', (error) => {
      console.error(`[Chat] Session ${sessionId} error:`, error)
      session.status = 'error'
      // Reject any pending response
      if (session.pendingResponse) {
        clearTimeout(session.pendingResponse.timeout)
        session.pendingResponse.reject(error)
        session.pendingResponse = undefined
      }
    })

    // Wait for connection to be established (with timeout)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 10000)

      const checkConnection = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          clearTimeout(timeout)
          clearInterval(checkConnection)
          resolve()
        } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          clearTimeout(timeout)
          clearInterval(checkConnection)
          reject(new Error('WebSocket connection failed'))
        }
      }, 100)
    })

    return {
      sessionId,
      status: session.status,
    }
  } catch (error) {
    session.status = 'error'
    console.error(`[Chat] Failed to create session:`, error)
    throw error
  }
}

/**
 * Handle incoming WebSocket messages from ElevenLabs
 */
function handleWebSocketMessage(session: ChatSession, message: any): void {
  session.lastActivityAt = new Date()

  switch (message.type) {
    case 'agent_response':
      // Agent text response (may be partial or final)
      if (message.agent_response_type === 'agent_response') {
        const text = message.agent_response?.trim()
        if (text && session.pendingResponse) {
          // Store the message
          session.messages.push({
            role: 'agent',
            content: text,
            timestamp: new Date(),
          })

          // Resolve the pending response
          clearTimeout(session.pendingResponse.timeout)
          session.pendingResponse.resolve(text)
          session.pendingResponse = undefined
        }
      }
      break

    case 'agent_response_correction':
      // Corrected/updated response
      if (message.corrected_text) {
        // Update the last agent message
        const lastAgentMsg = [...session.messages].reverse().find((m) => m.role === 'agent')
        if (lastAgentMsg) {
          lastAgentMsg.content = message.corrected_text
        }
      }
      break

    case 'user_transcript':
      // User's message was transcribed (for voice, but also confirms text receipt)
      console.log(`[Chat] User transcript: ${message.user_transcript}`)
      break

    case 'ping':
      // Respond to ping with pong
      if (session.ws?.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({ type: 'pong', event_id: message.ping_event?.event_id }))
      }
      break

    case 'conversation_initiation_metadata':
      // Conversation started - may include initial greeting
      console.log(`[Chat] Conversation initiated for session ${session.id}`)
      break

    default:
      // Log unknown message types for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Chat] Unknown message type: ${message.type}`, message)
      }
  }
}

/**
 * Send a text message to the chat session and wait for response
 */
export async function sendMessage(sessionId: string, text: string): Promise<{
  response: string
  messages: ChatMessage[]
}> {
  const session = sessions.get(sessionId)

  if (!session) {
    throw new Error('Session not found')
  }

  if (session.status !== 'active') {
    throw new Error(`Session is ${session.status}, cannot send message`)
  }

  if (!session.ws || session.ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket connection not available')
  }

  // Store user message
  session.messages.push({
    role: 'user',
    content: text,
    timestamp: new Date(),
  })

  session.lastActivityAt = new Date()

  // Send text message to ElevenLabs
  // Using the user_message format for text input
  const message = {
    type: 'user_message',
    user_message: {
      type: 'text',
      text: text,
    },
  }

  session.ws.send(JSON.stringify(message))

  // Wait for agent response
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      session.pendingResponse = undefined
      reject(new Error('Response timeout'))
    }, RESPONSE_TIMEOUT_MS)

    session.pendingResponse = {
      resolve: (response: string) => {
        resolve({
          response,
          messages: [...session.messages],
        })
      },
      reject,
      timeout,
    }
  })
}

/**
 * Get session information and history
 */
export function getSession(sessionId: string): {
  id: string
  patientId?: string
  status: ChatSession['status']
  messages: ChatMessage[]
  createdAt: Date
  lastActivityAt: Date
} | null {
  const session = sessions.get(sessionId)

  if (!session) {
    return null
  }

  return {
    id: session.id,
    patientId: session.patientId,
    status: session.status,
    messages: [...session.messages],
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
  }
}

/**
 * End a chat session
 */
export function endSession(sessionId: string): boolean {
  const session = sessions.get(sessionId)

  if (!session) {
    return false
  }

  // Close WebSocket connection
  if (session.ws) {
    try {
      session.ws.close()
    } catch {
      // Ignore close errors
    }
  }

  // Reject any pending response
  if (session.pendingResponse) {
    clearTimeout(session.pendingResponse.timeout)
    session.pendingResponse.reject(new Error('Session ended'))
    session.pendingResponse = undefined
  }

  session.status = 'ended'
  console.log(`[Chat] Session ${sessionId} ended`)

  // Optionally keep session data for history (or remove after some time)
  // For now, we'll keep it so history can be retrieved

  return true
}

/**
 * Clean up expired sessions
 * Should be called periodically (e.g., every minute)
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now()
  let cleaned = 0

  for (const [sessionId, session] of sessions) {
    const inactiveTime = now - session.lastActivityAt.getTime()

    if (inactiveTime > SESSION_TIMEOUT_MS && session.status === 'active') {
      console.log(`[Chat] Cleaning up inactive session ${sessionId}`)
      endSession(sessionId)
      cleaned++
    }

    // Remove ended sessions older than 1 hour
    if (session.status === 'ended' && inactiveTime > 60 * 60 * 1000) {
      sessions.delete(sessionId)
      cleaned++
    }
  }

  return cleaned
}

/**
 * Get all active sessions (for monitoring/debugging)
 */
export function getActiveSessions(): Array<{
  id: string
  patientId?: string
  status: ChatSession['status']
  messageCount: number
  createdAt: Date
  lastActivityAt: Date
}> {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    patientId: s.patientId,
    status: s.status,
    messageCount: s.messages.length,
    createdAt: s.createdAt,
    lastActivityAt: s.lastActivityAt,
  }))
}

// Start cleanup interval
setInterval(cleanupExpiredSessions, 60 * 1000)
