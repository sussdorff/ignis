'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ChatMessage, MessageRole } from '@/components/chat/types'
import {
  createChatSession,
  sendChatMessage,
  endChatSession,
  ChatApiError,
} from '@/lib/chat-api'

// ============================================================================
// Types
// ============================================================================

export interface UseChatOptions {
  /** Initial welcome message from the assistant */
  welcomeMessage?: string
  /** Whether to auto-create a session on mount */
  autoCreateSession?: boolean
  /** Callback when an error occurs */
  onError?: (error: Error) => void
}

export interface UseChatReturn {
  /** Array of chat messages */
  messages: ChatMessage[]
  /** Whether the assistant is generating a response */
  isLoading: boolean
  /** Current error, if any */
  error: Error | null
  /** Current session ID */
  sessionId: string | null
  /** Whether session is being initialized */
  isInitializing: boolean
  /** Send a message */
  sendMessage: (content: string) => Promise<void>
  /** Create a new session (clears messages) */
  createSession: () => Promise<void>
  /** End the current session */
  endSession: () => Promise<void>
  /** Clear the error */
  clearError: () => void
}

// ============================================================================
// Helper functions
// ============================================================================

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function createMessage(role: MessageRole, content: string): ChatMessage {
  return {
    id: generateMessageId(),
    role,
    content,
    timestamp: new Date(),
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    welcomeMessage = 'Guten Tag! Ich bin Ihr medizinischer Assistent. Wie kann ich Ihnen heute helfen? Sie konnen mir Ihre Symptome beschreiben oder Fragen zu Ihrer Gesundheit stellen.',
    autoCreateSession = true,
    onError,
  } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  // Ref to track if we've initialized
  const hasInitialized = useRef(false)

  const handleError = useCallback(
    (err: Error) => {
      setError(err)
      onError?.(err)
    },
    [onError]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const createSession = useCallback(async () => {
    setIsInitializing(true)
    setError(null)

    try {
      const response = await createChatSession()
      setSessionId(response.sessionId)

      // Initialize with welcome message
      setMessages([createMessage('assistant', welcomeMessage)])
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create session')
      handleError(error)

      // Still show welcome message even if session creation fails
      // This allows the UI to be usable and retry on first message
      setMessages([createMessage('assistant', welcomeMessage)])
    } finally {
      setIsInitializing(false)
    }
  }, [welcomeMessage, handleError])

  const endSession = useCallback(async () => {
    if (!sessionId) return

    try {
      await endChatSession(sessionId)
    } catch (err) {
      // Log but don't throw - ending session is not critical
      console.error('Failed to end chat session:', err)
    } finally {
      setSessionId(null)
      setMessages([])
    }
  }, [sessionId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      // Add user message immediately for responsive UI
      const userMessage = createMessage('user', content)
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setError(null)

      try {
        // If no session exists, create one first
        let currentSessionId = sessionId
        if (!currentSessionId) {
          const sessionResponse = await createChatSession()
          currentSessionId = sessionResponse.sessionId
          setSessionId(currentSessionId)
        }

        // Send the message
        const response = await sendChatMessage(currentSessionId, content)

        // Add assistant response
        const assistantMessage = createMessage('assistant', response.response)
        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        const error =
          err instanceof ChatApiError
            ? err
            : err instanceof Error
            ? err
            : new Error('Failed to send message')

        handleError(error)

        // Add error message to chat
        const errorMessage = createMessage(
          'assistant',
          'Entschuldigung, es gab ein Problem bei der Verarbeitung Ihrer Nachricht. Bitte versuchen Sie es erneut.'
        )
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, handleError]
  )

  // Auto-create session on mount
  useEffect(() => {
    if (autoCreateSession && !hasInitialized.current) {
      hasInitialized.current = true
      createSession()
    }
  }, [autoCreateSession, createSession])

  // Clean up session on unmount
  useEffect(() => {
    return () => {
      // Don't await - just fire and forget on unmount
      if (sessionId) {
        endChatSession(sessionId).catch(() => {
          // Ignore errors on cleanup
        })
      }
    }
  }, [sessionId])

  return {
    messages,
    isLoading,
    error,
    sessionId,
    isInitializing,
    sendMessage,
    createSession,
    endSession,
    clearError,
  }
}
