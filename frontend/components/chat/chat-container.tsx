'use client'

import { ChatMessageList } from './chat-message-list'
import { ChatInput } from './chat-input'
import { VoiceIndicator } from './voice-indicator'
import type { ChatProps } from './types'
import type { VoiceState } from '@/hooks/use-voice-chat'

interface ChatContainerProps extends ChatProps {
  /** Voice mode props */
  voiceState?: VoiceState
  isVoiceModeEnabled?: boolean
  onVoiceToggle?: () => void
  isVoiceSupported?: boolean
}

/**
 * Main chat container combining message list and input
 */
export function ChatContainer({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder,
  disabled = false,
  voiceState = 'idle',
  isVoiceModeEnabled = false,
  onVoiceToggle,
  isVoiceSupported = true,
}: ChatContainerProps) {
  return (
    <div className="flex flex-col h-full" data-testid="chat-container">
      <ChatMessageList messages={messages} isLoading={isLoading} />

      {/* Voice indicator when voice mode is active */}
      {isVoiceModeEnabled && voiceState !== 'idle' && (
        <VoiceIndicator voiceState={voiceState} />
      )}

      <ChatInput
        onSend={onSendMessage}
        placeholder={placeholder}
        disabled={disabled}
        isLoading={isLoading}
        voiceState={voiceState}
        isVoiceModeEnabled={isVoiceModeEnabled}
        onVoiceToggle={onVoiceToggle}
        isVoiceSupported={isVoiceSupported}
      />
    </div>
  )
}
