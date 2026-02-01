'use client'

import { ChatMessageList } from './chat-message-list'
import { ChatInput } from './chat-input'
import type { ChatProps } from './types'

/**
 * Main chat container combining message list and input
 */
export function ChatContainer({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder,
  disabled = false,
}: ChatProps) {
  return (
    <div className="flex flex-col h-full" data-testid="chat-container">
      <ChatMessageList messages={messages} isLoading={isLoading} />
      <ChatInput
        onSend={onSendMessage}
        placeholder={placeholder}
        disabled={disabled}
        isLoading={isLoading}
      />
    </div>
  )
}
