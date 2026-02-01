import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VoiceIndicator } from './voice-indicator'

describe('VoiceIndicator', () => {
  describe('idle state', () => {
    it('renders nothing when idle', () => {
      const { container } = render(<VoiceIndicator voiceState="idle" />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('listening state', () => {
    it('renders listening indicator', () => {
      render(<VoiceIndicator voiceState="listening" />)

      expect(screen.getByTestId('voice-indicator')).toBeInTheDocument()
      expect(screen.getByText('Ich hore zu...')).toBeInTheDocument()
    })

    it('has pulse animation', () => {
      render(<VoiceIndicator voiceState="listening" />)

      const indicator = screen.getByTestId('voice-indicator')
      expect(indicator).toHaveClass('animate-pulse')
    })

    it('renders soundwave animation bars', () => {
      render(<VoiceIndicator voiceState="listening" />)

      const indicator = screen.getByTestId('voice-indicator')
      const soundwaveBars = indicator.querySelectorAll('.animate-soundwave')
      expect(soundwaveBars.length).toBe(5)
    })

    it('has primary color background', () => {
      render(<VoiceIndicator voiceState="listening" />)

      const indicator = screen.getByTestId('voice-indicator')
      expect(indicator).toHaveClass('bg-primary/10')
    })
  })

  describe('processing state', () => {
    it('renders processing indicator', () => {
      render(<VoiceIndicator voiceState="processing" />)

      expect(screen.getByTestId('voice-indicator')).toBeInTheDocument()
      expect(screen.getByText('Verarbeite...')).toBeInTheDocument()
    })

    it('has muted background', () => {
      render(<VoiceIndicator voiceState="processing" />)

      const indicator = screen.getByTestId('voice-indicator')
      expect(indicator).toHaveClass('bg-muted')
    })

    it('does not have soundwave animation', () => {
      render(<VoiceIndicator voiceState="processing" />)

      const indicator = screen.getByTestId('voice-indicator')
      const soundwaveBars = indicator.querySelectorAll('.animate-soundwave')
      expect(soundwaveBars.length).toBe(0)
    })
  })

  describe('speaking state', () => {
    it('renders speaking indicator', () => {
      render(<VoiceIndicator voiceState="speaking" />)

      expect(screen.getByTestId('voice-indicator')).toBeInTheDocument()
      expect(screen.getByText('Assistent spricht...')).toBeInTheDocument()
    })

    it('has green background', () => {
      render(<VoiceIndicator voiceState="speaking" />)

      const indicator = screen.getByTestId('voice-indicator')
      expect(indicator).toHaveClass('bg-green-500/10')
    })

    it('renders speaker soundwave animation bars', () => {
      render(<VoiceIndicator voiceState="speaking" />)

      const indicator = screen.getByTestId('voice-indicator')
      const soundwaveBars = indicator.querySelectorAll('.animate-soundwave')
      expect(soundwaveBars.length).toBe(3)
    })
  })

  describe('error state', () => {
    it('renders error indicator', () => {
      render(<VoiceIndicator voiceState="error" />)

      expect(screen.getByTestId('voice-indicator')).toBeInTheDocument()
      expect(screen.getByText('Fehler aufgetreten')).toBeInTheDocument()
    })

    it('has destructive background', () => {
      render(<VoiceIndicator voiceState="error" />)

      const indicator = screen.getByTestId('voice-indicator')
      expect(indicator).toHaveClass('bg-destructive/10')
    })

    it('does not have soundwave animation', () => {
      render(<VoiceIndicator voiceState="error" />)

      const indicator = screen.getByTestId('voice-indicator')
      const soundwaveBars = indicator.querySelectorAll('.animate-soundwave')
      expect(soundwaveBars.length).toBe(0)
    })
  })

  describe('accessibility', () => {
    it('has role="status"', () => {
      render(<VoiceIndicator voiceState="listening" />)

      const indicator = screen.getByTestId('voice-indicator')
      expect(indicator).toHaveAttribute('role', 'status')
    })

    it('has aria-live="polite"', () => {
      render(<VoiceIndicator voiceState="listening" />)

      const indicator = screen.getByTestId('voice-indicator')
      expect(indicator).toHaveAttribute('aria-live', 'polite')
    })

    it('soundwave bars have aria-hidden', () => {
      render(<VoiceIndicator voiceState="listening" />)

      const indicator = screen.getByTestId('voice-indicator')
      const soundwaveContainer = indicator.querySelector('[aria-hidden="true"]')
      expect(soundwaveContainer).toBeInTheDocument()
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<VoiceIndicator voiceState="listening" className="custom-class" />)

      const indicator = screen.getByTestId('voice-indicator')
      expect(indicator).toHaveClass('custom-class')
    })
  })
})
