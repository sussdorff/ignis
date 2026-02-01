'use client'

import { useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { ChatMessage } from './chat-message'
import type { ChatMessage as ChatMessageType } from './types'

interface ChatMessageListProps {
  messages: ChatMessageType[]
  isLoading?: boolean
}

/**
 * Scrollable list of chat messages with auto-scroll to bottom
 */
export function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <ScrollArea className="flex-1 px-2" data-testid="chat-message-list">
      <div className="space-y-1 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p>Stellen Sie eine Frage, um zu beginnen.</p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}

        {isLoading && (
          <div className="flex gap-3 px-4 py-3" data-testid="chat-loading-indicator">
            <div className="size-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
              <Spinner className="size-4 text-muted-foreground" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Denkt nach</span>
                <span className="animate-pulse">...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
