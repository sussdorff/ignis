'use client'

import { Button } from '@/components/ui/button'
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VoiceState } from '@/hooks/use-voice-chat'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface VoiceModeToggleProps {
  /** Current voice state */
  voiceState: VoiceState
  /** Whether voice mode is enabled */
  isVoiceModeEnabled: boolean
  /** Callback to toggle voice mode */
  onToggle: () => void
  /** Whether voice is supported in this browser */
  isSupported: boolean
  /** Whether the toggle is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Voice mode toggle button with state-dependent icon and animation
 */
export function VoiceModeToggle({
  voiceState,
  isVoiceModeEnabled,
  onToggle,
  isSupported,
  disabled = false,
  className,
}: VoiceModeToggleProps) {
  const isProcessing = voiceState === 'processing'
  const isListening = voiceState === 'listening'
  const isSpeaking = voiceState === 'speaking'
  const isError = voiceState === 'error'

  // Determine which icon to show
  const getIcon = () => {
    if (isProcessing) {
      return <Loader2 className="size-4 animate-spin" />
    }
    if (isSpeaking) {
      return <Volume2 className="size-4" />
    }
    if (isVoiceModeEnabled) {
      return <Mic className="size-4" />
    }
    return <MicOff className="size-4" />
  }

  // Get tooltip text based on state
  const getTooltipText = () => {
    if (!isSupported) {
      return 'Sprachsteuerung wird von Ihrem Browser nicht unterstutzt'
    }
    if (isProcessing) {
      return 'Verbindung wird hergestellt...'
    }
    if (isSpeaking) {
      return 'Assistent spricht...'
    }
    if (isListening) {
      return 'Zuhoren... Klicken zum Beenden'
    }
    if (isError) {
      return 'Fehler aufgetreten. Klicken zum erneuten Versuchen'
    }
    return 'Sprachmodus aktivieren'
  }

  // Get aria-label for accessibility
  const getAriaLabel = () => {
    if (isVoiceModeEnabled) {
      return 'Sprachmodus deaktivieren'
    }
    return 'Sprachmodus aktivieren'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant={isVoiceModeEnabled ? 'default' : 'outline'}
            onClick={onToggle}
            disabled={disabled || !isSupported || isProcessing}
            aria-label={getAriaLabel()}
            aria-pressed={isVoiceModeEnabled}
            data-testid="voice-mode-toggle"
            className={cn(
              'shrink-0 rounded-xl transition-all duration-200',
              isListening && 'ring-2 ring-primary ring-offset-2 animate-pulse',
              isSpeaking && 'ring-2 ring-green-500 ring-offset-2',
              isError && 'ring-2 ring-destructive ring-offset-2',
              className
            )}
          >
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
