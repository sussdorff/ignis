/**
 * Chat message types and interfaces
 */

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
}

export interface ChatProps {
  /** Array of chat messages to display */
  messages: ChatMessage[]
  /** Callback when user sends a message */
  onSendMessage: (content: string) => void
  /** Whether the assistant is currently generating a response */
  isLoading?: boolean
  /** Placeholder text for the input field */
  placeholder?: string
  /** Whether the input is disabled */
  disabled?: boolean
}
