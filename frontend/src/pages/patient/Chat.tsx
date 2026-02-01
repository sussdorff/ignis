import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ChatProps {
  messages?: ChatMessage[]
  onSendMessage?: (message: string) => void
  isLoading?: boolean
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3 max-w-[85%]',
        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
      data-testid={`message-${message.id}`}
    >
      <Avatar size="sm">
        <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {isUser ? 'P' : 'AI'}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          'rounded-2xl px-4 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <span
          className={cn(
            'text-xs mt-1 block',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

function LoadingIndicator() {
  return (
    <div className="flex gap-3 mr-auto max-w-[85%]" data-testid="loading-indicator">
      <Avatar size="sm">
        <AvatarFallback className="bg-muted">AI</AvatarFallback>
      </Avatar>
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        <div className="flex gap-1.5">
          <Skeleton className="h-2 w-2 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <Skeleton className="h-2 w-2 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <Skeleton className="h-2 w-2 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  )
}

export default function PatientChat({ messages = [], onSendMessage, isLoading = false }: ChatProps) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedMessage = inputValue.trim()
    if (trimmedMessage && onSendMessage) {
      onSendMessage(trimmedMessage)
      setInputValue('')
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-2xl mx-auto h-[calc(100vh-3rem)] flex flex-col">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{t('chat.title')}</h1>
          <p className="text-sm text-gray-600">{t('chat.subtitle')}</p>
        </div>

        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">{t('chat.conversationTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 p-0">
            {/* Messages area */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              role="log"
              aria-label={t('chat.messageList')}
              aria-live="polite"
            >
              {!hasMessages && !isLoading && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>{t('chat.emptyState')}</p>
                </div>
              )}
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && <LoadingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <form
              onSubmit={handleSubmit}
              className="border-t p-4 flex gap-2"
            >
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.inputPlaceholder')}
                disabled={isLoading}
                aria-label={t('chat.inputLabel')}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                aria-label={t('chat.sendButton')}
              >
                {t('chat.send')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Export the MessageBubble component for potential reuse
export { MessageBubble, LoadingIndicator }
