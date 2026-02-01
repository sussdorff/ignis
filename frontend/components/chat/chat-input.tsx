'use client'

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type FormEvent,
} from 'react'
import { Button } from '@/components/ui/button'
import { SendHorizonal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VoiceModeToggle } from './voice-mode-toggle'
import type { VoiceState } from '@/hooks/use-voice-chat'

interface ChatInputProps {
  onSend: (content: string) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  /** Voice mode props */
  voiceState?: VoiceState
  isVoiceModeEnabled?: boolean
  onVoiceToggle?: () => void
  isVoiceSupported?: boolean
}

/**
 * Chat input field with send button and optional voice mode toggle
 */
export function ChatInput({
  onSend,
  placeholder = 'Nachricht eingeben...',
  disabled = false,
  isLoading = false,
  voiceState = 'idle',
  isVoiceModeEnabled = false,
  onVoiceToggle,
  isVoiceSupported = true,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDisabled = disabled || isLoading

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }, [value])

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    const trimmed = value.trim()
    if (trimmed && !isDisabled) {
      onSend(trimmed)
      setValue('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Show voice-specific placeholder when in voice mode
  const effectivePlaceholder = isVoiceModeEnabled
    ? 'Sprachmodus aktiv - sprechen Sie...'
    : placeholder

  return (
    <form onSubmit={handleSubmit} className="border-t bg-background p-4">
      <div className="flex items-end gap-2">
        {/* Voice mode toggle button */}
        {onVoiceToggle && (
          <VoiceModeToggle
            voiceState={voiceState}
            isVoiceModeEnabled={isVoiceModeEnabled}
            onToggle={onVoiceToggle}
            isSupported={isVoiceSupported}
            disabled={disabled}
          />
        )}

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            disabled={isDisabled || isVoiceModeEnabled}
            rows={1}
            className={cn(
              'w-full resize-none rounded-xl bg-secondary/50 px-4 py-3 pr-12 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'min-h-[44px] max-h-[150px]',
              isVoiceModeEnabled && 'opacity-50'
            )}
            aria-label="Chat-Nachricht eingeben"
            data-testid="chat-input"
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={isDisabled || !value.trim() || isVoiceModeEnabled}
          className="shrink-0 rounded-xl"
          aria-label="Nachricht senden"
          data-testid="chat-send-button"
        >
          <SendHorizonal className="size-4" />
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground text-center">
        {isVoiceModeEnabled
          ? 'Klicken Sie auf das Mikrofon, um den Sprachmodus zu beenden'
          : 'Drucken Sie Enter zum Senden, Shift+Enter fur einen Zeilenumbruch'}
      </p>
    </form>
  )
}
