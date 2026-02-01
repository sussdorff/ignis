'use client'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot, User } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from './types'

interface ChatMessageProps {
  message: ChatMessageType
}

/**
 * A single chat message bubble with avatar
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
      data-testid={`chat-message-${message.role}`}
    >
      <Avatar className={cn(
        'size-8 shrink-0',
        isUser ? 'bg-primary' : 'bg-muted'
      )}>
        <AvatarFallback className={cn(
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}>
          {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <time
          className={cn(
            'text-[10px] mt-1 block',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
          dateTime={message.timestamp.toISOString()}
        >
          {formatTime(message.timestamp)}
        </time>
      </div>
    </div>
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
