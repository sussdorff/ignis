import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceChat } from './use-voice-chat'

describe('useVoiceChat', () => {
  beforeEach(() => {
    // Mock navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(),
      },
      configurable: true,
      writable: true,
    })

    // Mock AudioContext
    vi.stubGlobal(
      'AudioContext',
      vi.fn().mockImplementation(() => ({
        createBufferSource: vi.fn(() => ({
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
          onended: null,
        })),
        destination: {},
        close: vi.fn(),
        state: 'running',
        sampleRate: 16000,
      }))
    )

    // Mock MediaRecorder
    vi.stubGlobal(
      'MediaRecorder',
      vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        state: 'inactive',
        ondataavailable: null,
        onstop: null,
      }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('returns idle voice state initially', () => {
      const { result } = renderHook(() => useVoiceChat())

      expect(result.current.voiceState).toBe('idle')
      expect(result.current.isVoiceModeEnabled).toBe(false)
      expect(result.current.isListening).toBe(false)
      expect(result.current.isSpeaking).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('checks browser support', () => {
      const { result } = renderHook(() => useVoiceChat())

      expect(result.current.isSupported).toBe(true)
    })

    it('reports unsupported when mediaDevices is unavailable', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      })

      const { result } = renderHook(() => useVoiceChat())

      expect(result.current.isSupported).toBe(false)
    })
  })

  describe('startVoiceMode error handling', () => {
    it('handles microphone permission denied error', async () => {
      const permissionError = new DOMException(
        'Permission denied',
        'NotAllowedError'
      )
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
        permissionError
      )

      const onError = vi.fn()
      const { result } = renderHook(() => useVoiceChat({ onError }))

      await act(async () => {
        await result.current.startVoiceMode()
      })

      expect(result.current.voiceState).toBe('error')
      expect(result.current.error?.message).toContain(
        'Mikrofonzugriff wurde verweigert'
      )
      expect(onError).toHaveBeenCalled()
    })

    it('handles no microphone found error', async () => {
      const notFoundError = new DOMException('No device found', 'NotFoundError')
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
        notFoundError
      )

      const { result } = renderHook(() => useVoiceChat())

      await act(async () => {
        await result.current.startVoiceMode()
      })

      expect(result.current.error?.message).toContain('Kein Mikrofon gefunden')
    })

    it('handles unsupported browser gracefully', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      })

      const onError = vi.fn()
      const { result } = renderHook(() => useVoiceChat({ onError }))

      await act(async () => {
        await result.current.startVoiceMode()
      })

      expect(result.current.error?.message).toContain(
        'unterstutzt keine Sprachfunktionen'
      )
    })
  })

  describe('stopVoiceMode', () => {
    it('resets state to idle', () => {
      const { result } = renderHook(() => useVoiceChat())

      act(() => {
        result.current.stopVoiceMode()
      })

      expect(result.current.isVoiceModeEnabled).toBe(false)
      expect(result.current.voiceState).toBe('idle')
    })

    it('clears error state', async () => {
      const permissionError = new DOMException(
        'Permission denied',
        'NotAllowedError'
      )
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
        permissionError
      )

      const { result } = renderHook(() => useVoiceChat())

      await act(async () => {
        await result.current.startVoiceMode()
      })

      expect(result.current.error).not.toBeNull()

      act(() => {
        result.current.stopVoiceMode()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('clearError', () => {
    it('clears the error state', async () => {
      const permissionError = new DOMException(
        'Permission denied',
        'NotAllowedError'
      )
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
        permissionError
      )

      const { result } = renderHook(() => useVoiceChat())

      await act(async () => {
        await result.current.startVoiceMode()
      })

      expect(result.current.error).not.toBeNull()
      expect(result.current.voiceState).toBe('error')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.voiceState).toBe('idle')
    })

    it('does not change state if not in error state', () => {
      const { result } = renderHook(() => useVoiceChat())

      expect(result.current.voiceState).toBe('idle')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.voiceState).toBe('idle')
    })
  })

  describe('callbacks', () => {
    it('calls onError callback when error occurs', async () => {
      const permissionError = new DOMException(
        'Permission denied',
        'NotAllowedError'
      )
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
        permissionError
      )

      const onError = vi.fn()
      const { result } = renderHook(() => useVoiceChat({ onError }))

      await act(async () => {
        await result.current.startVoiceMode()
      })

      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('calls onStateChange callback when state changes', async () => {
      const permissionError = new DOMException(
        'Permission denied',
        'NotAllowedError'
      )
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
        permissionError
      )

      const onStateChange = vi.fn()
      const { result } = renderHook(() => useVoiceChat({ onStateChange }))

      await act(async () => {
        await result.current.startVoiceMode()
      })

      // Should have called with 'processing' and then 'error'
      expect(onStateChange).toHaveBeenCalledWith('processing')
      expect(onStateChange).toHaveBeenCalledWith('error')
    })
  })
})
