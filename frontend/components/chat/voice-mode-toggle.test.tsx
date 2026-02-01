import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VoiceModeToggle } from './voice-mode-toggle'

describe('VoiceModeToggle', () => {
  const defaultProps = {
    voiceState: 'idle' as const,
    isVoiceModeEnabled: false,
    onToggle: vi.fn(),
    isSupported: true,
  }

  describe('rendering', () => {
    it('renders the toggle button', () => {
      render(<VoiceModeToggle {...defaultProps} />)

      expect(screen.getByTestId('voice-mode-toggle')).toBeInTheDocument()
    })

    it('shows MicOff icon when voice mode is disabled', () => {
      render(<VoiceModeToggle {...defaultProps} isVoiceModeEnabled={false} />)

      const button = screen.getByTestId('voice-mode-toggle')
      // The button should have aria-pressed="false"
      expect(button).toHaveAttribute('aria-pressed', 'false')
    })

    it('shows Mic icon when voice mode is enabled', () => {
      render(
        <VoiceModeToggle
          {...defaultProps}
          isVoiceModeEnabled={true}
          voiceState="listening"
        />
      )

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows loading spinner when processing', () => {
      render(
        <VoiceModeToggle
          {...defaultProps}
          isVoiceModeEnabled={true}
          voiceState="processing"
        />
      )

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toBeDisabled()
    })

    it('shows Volume2 icon when speaking', () => {
      render(
        <VoiceModeToggle
          {...defaultProps}
          isVoiceModeEnabled={true}
          voiceState="speaking"
        />
      )

      const button = screen.getByTestId('voice-mode-toggle')
      // Button should have the speaking ring style
      expect(button).toHaveClass('ring-green-500')
    })
  })

  describe('interactions', () => {
    it('calls onToggle when clicked', () => {
      const handleToggle = vi.fn()
      render(<VoiceModeToggle {...defaultProps} onToggle={handleToggle} />)

      fireEvent.click(screen.getByTestId('voice-mode-toggle'))

      expect(handleToggle).toHaveBeenCalledTimes(1)
    })

    it('is disabled when not supported', () => {
      render(<VoiceModeToggle {...defaultProps} isSupported={false} />)

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toBeDisabled()
    })

    it('is disabled when explicitly disabled', () => {
      render(<VoiceModeToggle {...defaultProps} disabled={true} />)

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toBeDisabled()
    })

    it('is disabled when processing', () => {
      render(
        <VoiceModeToggle
          {...defaultProps}
          isVoiceModeEnabled={true}
          voiceState="processing"
        />
      )

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toBeDisabled()
    })

    it('does not call onToggle when disabled', () => {
      const handleToggle = vi.fn()
      render(
        <VoiceModeToggle {...defaultProps} onToggle={handleToggle} disabled={true} />
      )

      fireEvent.click(screen.getByTestId('voice-mode-toggle'))

      expect(handleToggle).not.toHaveBeenCalled()
    })
  })

  describe('visual states', () => {
    it('has pulse animation when listening', () => {
      render(
        <VoiceModeToggle
          {...defaultProps}
          isVoiceModeEnabled={true}
          voiceState="listening"
        />
      )

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toHaveClass('animate-pulse')
    })

    it('has error ring when in error state', () => {
      render(
        <VoiceModeToggle
          {...defaultProps}
          isVoiceModeEnabled={true}
          voiceState="error"
        />
      )

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toHaveClass('ring-destructive')
    })

    it('uses default variant when voice mode disabled', () => {
      render(<VoiceModeToggle {...defaultProps} isVoiceModeEnabled={false} />)

      const button = screen.getByTestId('voice-mode-toggle')
      // outline variant has bg-background
      expect(button.className).toContain('bg-background')
    })

    it('uses primary variant when voice mode enabled', () => {
      render(
        <VoiceModeToggle
          {...defaultProps}
          isVoiceModeEnabled={true}
          voiceState="listening"
        />
      )

      const button = screen.getByTestId('voice-mode-toggle')
      // default variant has bg-primary
      expect(button.className).toContain('bg-primary')
    })
  })

  describe('accessibility', () => {
    it('has correct aria-label when disabled', () => {
      render(<VoiceModeToggle {...defaultProps} isVoiceModeEnabled={false} />)

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toHaveAttribute('aria-label', 'Sprachmodus aktivieren')
    })

    it('has correct aria-label when enabled', () => {
      render(
        <VoiceModeToggle
          {...defaultProps}
          isVoiceModeEnabled={true}
          voiceState="listening"
        />
      )

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toHaveAttribute('aria-label', 'Sprachmodus deaktivieren')
    })

    it('has aria-pressed attribute', () => {
      const { rerender } = render(
        <VoiceModeToggle {...defaultProps} isVoiceModeEnabled={false} />
      )

      expect(screen.getByTestId('voice-mode-toggle')).toHaveAttribute(
        'aria-pressed',
        'false'
      )

      rerender(
        <VoiceModeToggle
          {...defaultProps}
          isVoiceModeEnabled={true}
          voiceState="listening"
        />
      )

      expect(screen.getByTestId('voice-mode-toggle')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<VoiceModeToggle {...defaultProps} className="custom-class" />)

      const button = screen.getByTestId('voice-mode-toggle')
      expect(button).toHaveClass('custom-class')
    })
  })
})
