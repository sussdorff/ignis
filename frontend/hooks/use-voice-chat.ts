'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// ============================================================================
// Types
// ============================================================================

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export interface UseVoiceChatOptions {
  /** Callback when transcribed text is received */
  onTranscript?: (text: string) => void
  /** Callback when an error occurs */
  onError?: (error: Error) => void
  /** Callback when voice state changes */
  onStateChange?: (state: VoiceState) => void
  /** ElevenLabs agent ID (optional, uses backend default) */
  agentId?: string
}

export interface UseVoiceChatReturn {
  /** Current voice state */
  voiceState: VoiceState
  /** Whether voice mode is enabled */
  isVoiceModeEnabled: boolean
  /** Whether the microphone is currently listening */
  isListening: boolean
  /** Whether audio is currently playing */
  isSpeaking: boolean
  /** Current error, if any */
  error: Error | null
  /** Enable voice mode and start listening */
  startVoiceMode: () => Promise<void>
  /** Stop voice mode and cleanup */
  stopVoiceMode: () => void
  /** Toggle voice mode on/off */
  toggleVoiceMode: () => Promise<void>
  /** Clear the current error */
  clearError: () => void
  /** Check if browser supports voice features */
  isSupported: boolean
}

// ============================================================================
// Audio Utilities
// ============================================================================

/**
 * Check if browser supports required audio APIs
 */
function checkBrowserSupport(): boolean {
  if (typeof window === 'undefined') return false

  return !!(
    navigator.mediaDevices?.getUserMedia &&
    window.AudioContext &&
    window.MediaRecorder
  )
}

/**
 * Request microphone permission
 */
async function requestMicrophonePermission(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    })
    return stream
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Mikrofonzugriff wurde verweigert. Bitte erlauben Sie den Zugriff in Ihren Browsereinstellungen.')
      }
      if (error.name === 'NotFoundError') {
        throw new Error('Kein Mikrofon gefunden. Bitte schliessen Sie ein Mikrofon an.')
      }
    }
    throw new Error('Fehler beim Zugriff auf das Mikrofon.')
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useVoiceChat(options: UseVoiceChatOptions = {}): UseVoiceChatReturn {
  const { onTranscript, onError, onStateChange, agentId } = options

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [isVoiceModeEnabled, setIsVoiceModeEnabled] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isSupported] = useState(() => checkBrowserSupport())

  // Refs for audio resources
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const audioQueueRef = useRef<AudioBuffer[]>([])
  const isPlayingRef = useRef(false)

  // Update voice state and notify callback
  const updateVoiceState = useCallback((newState: VoiceState) => {
    setVoiceState(newState)
    onStateChange?.(newState)
  }, [onStateChange])

  // Handle errors
  const handleError = useCallback((err: Error) => {
    setError(err)
    updateVoiceState('error')
    onError?.(err)
  }, [onError, updateVoiceState])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
    if (voiceState === 'error') {
      updateVoiceState('idle')
    }
  }, [voiceState, updateVoiceState])

  // Play audio buffer
  const playAudioBuffer = useCallback(async (audioBuffer: AudioBuffer) => {
    if (!audioContextRef.current) return

    const source = audioContextRef.current.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContextRef.current.destination)

    return new Promise<void>((resolve) => {
      source.onended = () => resolve()
      source.start()
    })
  }, [])

  // Process audio queue
  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return

    isPlayingRef.current = true
    updateVoiceState('speaking')

    while (audioQueueRef.current.length > 0) {
      const buffer = audioQueueRef.current.shift()
      if (buffer) {
        await playAudioBuffer(buffer)
      }
    }

    isPlayingRef.current = false
    if (isVoiceModeEnabled) {
      updateVoiceState('listening')
    }
  }, [isVoiceModeEnabled, playAudioBuffer, updateVoiceState])

  // Setup WebSocket connection to ElevenLabs via backend
  const setupWebSocket = useCallback(async () => {
    // For now, we'll use a simplified approach that works with the existing chat API
    // A full ElevenLabs WebSocket implementation would require backend WebSocket proxy
    // This is a placeholder for future WebSocket implementation
    console.log('[VoiceChat] WebSocket setup would happen here')
  }, [])

  // Start voice mode
  const startVoiceMode = useCallback(async () => {
    if (!isSupported) {
      handleError(new Error('Ihr Browser unterstutzt keine Sprachfunktionen.'))
      return
    }

    try {
      updateVoiceState('processing')

      // Request microphone access
      const stream = await requestMicrophonePermission()
      mediaStreamRef.current = stream

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 })

      // Setup MediaRecorder for audio capture
      // Try to use opus codec, fallback to default if not supported
      let mediaRecorder: MediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        })
      } catch {
        // Fallback to default mime type
        mediaRecorder = new MediaRecorder(stream)
      }
      mediaRecorderRef.current = mediaRecorder

      const audioChunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
          // In a full implementation, send audioBlob to backend for processing
          console.log('[VoiceChat] Audio recorded:', audioBlob.size, 'bytes')

          // Clear chunks for next recording
          audioChunks.length = 0
        }
      }

      // Start recording
      mediaRecorder.start(1000) // Collect data every second

      setIsVoiceModeEnabled(true)
      updateVoiceState('listening')

      // Setup WebSocket for real-time communication
      await setupWebSocket()

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Fehler beim Starten des Sprachmodus.')
      handleError(error)
    }
  }, [isSupported, handleError, updateVoiceState, setupWebSocket])

  // Stop voice mode
  const stopVoiceMode = useCallback(() => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null

    // Stop all tracks in the media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
    }
    mediaStreamRef.current = null

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
    }
    audioContextRef.current = null

    // Close WebSocket
    if (websocketRef.current) {
      websocketRef.current.close()
    }
    websocketRef.current = null

    // Clear audio queue
    audioQueueRef.current = []
    isPlayingRef.current = false

    setIsVoiceModeEnabled(false)
    updateVoiceState('idle')
    setError(null)
  }, [updateVoiceState])

  // Toggle voice mode
  const toggleVoiceMode = useCallback(async () => {
    if (isVoiceModeEnabled) {
      stopVoiceMode()
    } else {
      await startVoiceMode()
    }
  }, [isVoiceModeEnabled, startVoiceMode, stopVoiceMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceMode()
    }
  }, [stopVoiceMode])

  return {
    voiceState,
    isVoiceModeEnabled,
    isListening: voiceState === 'listening',
    isSpeaking: voiceState === 'speaking',
    error,
    startVoiceMode,
    stopVoiceMode,
    toggleVoiceMode,
    clearError,
    isSupported,
  }
}
