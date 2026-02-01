/**
 * Chat API client for connecting to the backend chat endpoints
 * Uses relative paths - API calls go to /api/* which Next.js routes to the backend
 */

const API_BASE = ''

// ============================================================================
// Types
// ============================================================================

export interface ChatSessionResponse {
  sessionId: string
  status: string
  message: string
}

export interface ChatMessageRequest {
  sessionId: string
  message: string
}

export interface ChatMessageResponse {
  sessionId: string
  response: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export interface ChatSessionHistory {
  sessionId: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  status: string
}

// ============================================================================
// Error handling
// ============================================================================

export class ChatApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message)
    this.name = 'ChatApiError'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorMessage = await response.text().catch(() => response.statusText)
    throw new ChatApiError(
      errorMessage || `API error: ${response.status}`,
      response.status,
      response.statusText
    )
  }
  return response.json()
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create a new chat session
 */
export async function createChatSession(): Promise<ChatSessionResponse> {
  const response = await fetch(`${API_BASE}/api/chat/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return handleResponse<ChatSessionResponse>(response)
}

/**
 * Send a message in an existing chat session
 */
export async function sendChatMessage(
  sessionId: string,
  message: string
): Promise<ChatMessageResponse> {
  const response = await fetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      message,
    } satisfies ChatMessageRequest),
  })
  return handleResponse<ChatMessageResponse>(response)
}

/**
 * Get session history by ID
 */
export async function getChatSession(
  sessionId: string
): Promise<ChatSessionHistory> {
  const response = await fetch(`${API_BASE}/api/chat/session/${sessionId}`)
  return handleResponse<ChatSessionHistory>(response)
}

/**
 * End a chat session
 */
export async function endChatSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/chat/session/${sessionId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const errorMessage = await response.text().catch(() => response.statusText)
    throw new ChatApiError(
      errorMessage || `API error: ${response.status}`,
      response.status,
      response.statusText
    )
  }
}
