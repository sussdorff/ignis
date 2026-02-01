'use client'

import { cn } from '@/lib/utils'
import { Mic, Volume2, Loader2, AlertCircle } from 'lucide-react'
import type { VoiceState } from '@/hooks/use-voice-chat'

interface VoiceIndicatorProps {
  /** Current voice state */
  voiceState: VoiceState
  /** Additional CSS classes */
  className?: string
}

/**
 * Visual indicator showing the current voice state with animations
 */
export function VoiceIndicator({ voiceState, className }: VoiceIndicatorProps) {
  if (voiceState === 'idle') {
    return null
  }

  const getStateContent = () => {
    switch (voiceState) {
      case 'listening':
        return {
          icon: <Mic className="size-6" />,
          text: 'Ich hore zu...',
          bgColor: 'bg-primary/10',
          textColor: 'text-primary',
          animation: 'animate-pulse',
        }
      case 'processing':
        return {
          icon: <Loader2 className="size-6 animate-spin" />,
          text: 'Verarbeite...',
          bgColor: 'bg-muted',
          textColor: 'text-muted-foreground',
          animation: '',
        }
      case 'speaking':
        return {
          icon: <Volume2 className="size-6" />,
          text: 'Assistent spricht...',
          bgColor: 'bg-green-500/10',
          textColor: 'text-green-600 dark:text-green-400',
          animation: '',
        }
      case 'error':
        return {
          icon: <AlertCircle className="size-6" />,
          text: 'Fehler aufgetreten',
          bgColor: 'bg-destructive/10',
          textColor: 'text-destructive',
          animation: '',
        }
      default:
        return null
    }
  }

  const content = getStateContent()
  if (!content) return null

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 py-4 px-6 rounded-xl mx-4',
        content.bgColor,
        content.animation,
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="voice-indicator"
    >
      <div className={cn('flex-shrink-0', content.textColor)}>
        {content.icon}
      </div>
      <span className={cn('text-sm font-medium', content.textColor)}>
        {content.text}
      </span>

      {/* Sound wave animation for listening state */}
      {voiceState === 'listening' && (
        <div className="flex items-center gap-0.5 ml-2" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={cn(
                'w-1 bg-primary rounded-full',
                'animate-soundwave'
              )}
              style={{
                height: '16px',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Speaker wave animation for speaking state */}
      {voiceState === 'speaking' && (
        <div className="flex items-center gap-0.5 ml-2" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1 bg-green-500 rounded-full animate-soundwave"
              style={{
                height: '12px',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
