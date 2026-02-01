import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChat } from './use-chat'
import * as chatApi from '@/lib/chat-api'

// Mock the chat API module
vi.mock('@/lib/chat-api', () => ({
  createChatSession: vi.fn(),
  sendChatMessage: vi.fn(),
  endChatSession: vi.fn(),
  getChatSession: vi.fn(),
  ChatApiError: class ChatApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public statusText: string
    ) {
      super(message)
      this.name = 'ChatApiError'
    }
  },
}))

const mockCreateChatSession = vi.mocked(chatApi.createChatSession)
const mockSendChatMessage = vi.mocked(chatApi.sendChatMessage)
const mockEndChatSession = vi.mocked(chatApi.endChatSession)

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default successful session creation
    mockCreateChatSession.mockResolvedValue({
      sessionId: 'test-session-123',
      status: 'active',
      message: 'Session created',
    })
    // Default successful end session - always return a resolved promise
    mockEndChatSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('auto-creates a session on mount by default', async () => {
      const { result } = renderHook(() => useChat())

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      expect(mockCreateChatSession).toHaveBeenCalledTimes(1)
      expect(result.current.sessionId).toBe('test-session-123')
    })

    it('adds welcome message on initialization', async () => {
      const { result } = renderHook(() =>
        useChat({ welcomeMessage: 'Welcome!' })
      )

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].role).toBe('assistant')
      expect(result.current.messages[0].content).toBe('Welcome!')
    })

    it('does not auto-create session when autoCreateSession is false', async () => {
      const { result } = renderHook(() =>
        useChat({ autoCreateSession: false })
      )

      // Give it time to potentially call the API
      await new Promise((r) => setTimeout(r, 50))

      expect(mockCreateChatSession).not.toHaveBeenCalled()
      expect(result.current.sessionId).toBeNull()
      expect(result.current.messages).toHaveLength(0)
    })

    it('handles session creation failure gracefully', async () => {
      const onError = vi.fn()
      mockCreateChatSession.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useChat({ onError }))

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(onError).toHaveBeenCalled()
      // Should still show welcome message even on failure
      expect(result.current.messages).toHaveLength(1)
    })
  })

  describe('sendMessage', () => {
    it('sends a message and receives a response', async () => {
      mockSendChatMessage.mockResolvedValueOnce({
        sessionId: 'test-session-123',
        response: 'Hello! How can I help?',
        messages: [],
      })

      const { result } = renderHook(() => useChat())

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      await act(async () => {
        await result.current.sendMessage('Hi there')
      })

      // Should have welcome message, user message, and assistant response
      expect(result.current.messages).toHaveLength(3)
      expect(result.current.messages[1].role).toBe('user')
      expect(result.current.messages[1].content).toBe('Hi there')
      expect(result.current.messages[2].role).toBe('assistant')
      expect(result.current.messages[2].content).toBe('Hello! How can I help?')
    })

    it('creates session if none exists when sending message', async () => {
      const { result } = renderHook(() =>
        useChat({ autoCreateSession: false })
      )

      mockSendChatMessage.mockResolvedValueOnce({
        sessionId: 'test-session-123',
        response: 'Response',
        messages: [],
      })

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(mockCreateChatSession).toHaveBeenCalledTimes(1)
      expect(mockSendChatMessage).toHaveBeenCalledWith(
        'test-session-123',
        'Hello'
      )
    })

    it('shows loading state while waiting for response', async () => {
      // Create a promise we can control
      let resolveMessage: (value: chatApi.ChatMessageResponse) => void
      mockSendChatMessage.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveMessage = resolve
          })
      )

      const { result } = renderHook(() => useChat())

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      // Start sending message
      act(() => {
        result.current.sendMessage('Test')
      })

      // Should be loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true)
      })

      // Resolve the promise
      await act(async () => {
        resolveMessage!({
          sessionId: 'test-session-123',
          response: 'Done',
          messages: [],
        })
      })

      // Should no longer be loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('handles send message failure', async () => {
      const onError = vi.fn()
      mockSendChatMessage.mockRejectedValueOnce(new Error('API Error'))

      const { result } = renderHook(() => useChat({ onError }))

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      await act(async () => {
        await result.current.sendMessage('Test')
      })

      expect(onError).toHaveBeenCalled()
      expect(result.current.error).toBeTruthy()
      // Should have error message added to chat
      expect(result.current.messages[2].role).toBe('assistant')
      expect(result.current.messages[2].content).toContain('Problem')
    })

    it('ignores empty messages', async () => {
      const { result } = renderHook(() => useChat())

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      await act(async () => {
        await result.current.sendMessage('')
        await result.current.sendMessage('   ')
      })

      expect(mockSendChatMessage).not.toHaveBeenCalled()
      // Should only have welcome message
      expect(result.current.messages).toHaveLength(1)
    })
  })

  describe('session management', () => {
    it('creates a new session', async () => {
      const { result } = renderHook(() =>
        useChat({ autoCreateSession: false })
      )

      await act(async () => {
        await result.current.createSession()
      })

      expect(mockCreateChatSession).toHaveBeenCalledTimes(1)
      expect(result.current.sessionId).toBe('test-session-123')
    })

    it('ends the current session', async () => {
      const { result } = renderHook(() => useChat())

      await waitFor(() => {
        expect(result.current.sessionId).toBe('test-session-123')
      })

      await act(async () => {
        await result.current.endSession()
      })

      expect(mockEndChatSession).toHaveBeenCalledWith('test-session-123')
      expect(result.current.sessionId).toBeNull()
      expect(result.current.messages).toHaveLength(0)
    })
  })

  describe('error handling', () => {
    it('clears error when clearError is called', async () => {
      mockCreateChatSession.mockRejectedValueOnce(new Error('Test error'))

      const { result } = renderHook(() => useChat())

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})
