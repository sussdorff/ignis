import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createChatSession,
  sendChatMessage,
  getChatSession,
  endChatSession,
  ChatApiError,
} from './chat-api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('chat-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createChatSession', () => {
    it('creates a new session successfully', async () => {
      const mockResponse = {
        sessionId: 'session-123',
        status: 'active',
        message: 'Session created',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await createChatSession()

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      expect(result).toEqual(mockResponse)
    })

    it('throws ChatApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      })

      await expect(createChatSession()).rejects.toThrow(ChatApiError)
    })

    it('includes status code in ChatApiError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      })

      try {
        await createChatSession()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ChatApiError)
        expect((error as ChatApiError).status).toBe(500)
        expect((error as ChatApiError).statusText).toBe('Internal Server Error')
      }
    })
  })

  describe('sendChatMessage', () => {
    it('sends a message successfully', async () => {
      const mockResponse = {
        sessionId: 'session-123',
        response: 'Hello! How can I help?',
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello! How can I help?' },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await sendChatMessage('session-123', 'Hi')

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: 'session-123',
          message: 'Hi',
        }),
      })
      expect(result).toEqual(mockResponse)
    })

    it('throws ChatApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid session'),
      })

      await expect(sendChatMessage('invalid-session', 'Hi')).rejects.toThrow(
        ChatApiError
      )
    })
  })

  describe('getChatSession', () => {
    it('retrieves session history successfully', async () => {
      const mockResponse = {
        sessionId: 'session-123',
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
        ],
        status: 'active',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await getChatSession('session-123')

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/session/session-123')
      expect(result).toEqual(mockResponse)
    })

    it('throws ChatApiError when session not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Session not found'),
      })

      await expect(getChatSession('unknown-session')).rejects.toThrow(
        ChatApiError
      )
    })
  })

  describe('endChatSession', () => {
    it('ends session successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      })

      await expect(endChatSession('session-123')).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/session/session-123', {
        method: 'DELETE',
      })
    })

    it('throws ChatApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Failed to end session'),
      })

      await expect(endChatSession('session-123')).rejects.toThrow(ChatApiError)
    })
  })

  describe('ChatApiError', () => {
    it('has correct properties', () => {
      const error = new ChatApiError('Test error', 404, 'Not Found')

      expect(error.message).toBe('Test error')
      expect(error.status).toBe(404)
      expect(error.statusText).toBe('Not Found')
      expect(error.name).toBe('ChatApiError')
    })
  })
})
