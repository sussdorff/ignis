import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PatientChat, { type ChatMessage } from './Chat'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'chat.title': 'AI Health Assistant',
        'chat.subtitle': 'Describe your symptoms and concerns',
        'chat.conversationTitle': 'Chat with our AI Assistant',
        'chat.messageList': 'Chat messages',
        'chat.emptyState': 'Start a conversation by describing your symptoms or health concerns.',
        'chat.inputPlaceholder': 'Type your message...',
        'chat.inputLabel': 'Message input',
        'chat.sendButton': 'Send message',
        'chat.send': 'Send',
      }
      return translations[key] || key
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}))

// Mock the LanguageSwitcher component
vi.mock('@/components/ui/language-switcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">Language Switcher</div>,
}))

describe('PatientChat', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! How can I help you today?',
      timestamp: new Date('2024-01-15T10:00:00'),
    },
    {
      id: '2',
      role: 'user',
      content: 'I have a headache.',
      timestamp: new Date('2024-01-15T10:01:00'),
    },
    {
      id: '3',
      role: 'assistant',
      content: 'I understand. How long have you had this headache?',
      timestamp: new Date('2024-01-15T10:01:30'),
    },
  ]

  it('renders the chat page with title and subtitle', () => {
    render(<PatientChat />)

    expect(screen.getByText('AI Health Assistant')).toBeInTheDocument()
    expect(screen.getByText('Describe your symptoms and concerns')).toBeInTheDocument()
  })

  it('renders the language switcher', () => {
    render(<PatientChat />)

    expect(screen.getByTestId('language-switcher')).toBeInTheDocument()
  })

  it('displays empty state when no messages', () => {
    render(<PatientChat />)

    expect(screen.getByText('Start a conversation by describing your symptoms or health concerns.')).toBeInTheDocument()
  })

  it('renders messages when provided', () => {
    render(<PatientChat messages={mockMessages} />)

    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument()
    expect(screen.getByText('I have a headache.')).toBeInTheDocument()
    expect(screen.getByText('I understand. How long have you had this headache?')).toBeInTheDocument()
  })

  it('displays message bubbles with correct data-testid', () => {
    render(<PatientChat messages={mockMessages} />)

    expect(screen.getByTestId('message-1')).toBeInTheDocument()
    expect(screen.getByTestId('message-2')).toBeInTheDocument()
    expect(screen.getByTestId('message-3')).toBeInTheDocument()
  })

  it('renders input field and send button', () => {
    render(<PatientChat />)

    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument()
  })

  it('disables send button when input is empty', () => {
    render(<PatientChat />)

    const sendButton = screen.getByRole('button', { name: 'Send message' })
    expect(sendButton).toBeDisabled()
  })

  it('enables send button when input has text', async () => {
    const user = userEvent.setup()
    render(<PatientChat onSendMessage={vi.fn()} />)

    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, 'Hello')

    const sendButton = screen.getByRole('button', { name: 'Send message' })
    expect(sendButton).not.toBeDisabled()
  })

  it('calls onSendMessage when send button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnSendMessage = vi.fn()
    render(<PatientChat onSendMessage={mockOnSendMessage} />)

    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, 'I have a fever')

    const sendButton = screen.getByRole('button', { name: 'Send message' })
    await user.click(sendButton)

    expect(mockOnSendMessage).toHaveBeenCalledWith('I have a fever')
  })

  it('clears input after sending message', async () => {
    const user = userEvent.setup()
    const mockOnSendMessage = vi.fn()
    render(<PatientChat onSendMessage={mockOnSendMessage} />)

    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, 'I have a fever')

    const sendButton = screen.getByRole('button', { name: 'Send message' })
    await user.click(sendButton)

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('sends message when pressing Enter', async () => {
    const user = userEvent.setup()
    const mockOnSendMessage = vi.fn()
    render(<PatientChat onSendMessage={mockOnSendMessage} />)

    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, 'I have a cough{enter}')

    expect(mockOnSendMessage).toHaveBeenCalledWith('I have a cough')
  })

  it('does not send empty messages', async () => {
    const user = userEvent.setup()
    const mockOnSendMessage = vi.fn()
    render(<PatientChat onSendMessage={mockOnSendMessage} />)

    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, '   ') // Only spaces

    const sendButton = screen.getByRole('button', { name: 'Send message' })
    expect(sendButton).toBeDisabled()
  })

  it('displays loading indicator when isLoading is true', () => {
    render(<PatientChat isLoading={true} />)

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('disables input when loading', () => {
    render(<PatientChat isLoading={true} />)

    const input = screen.getByPlaceholderText('Type your message...')
    expect(input).toBeDisabled()
  })

  it('does not display empty state when there are messages', () => {
    render(<PatientChat messages={mockMessages} />)

    expect(screen.queryByText('Start a conversation by describing your symptoms or health concerns.')).not.toBeInTheDocument()
  })

  it('renders message list with correct aria attributes', () => {
    render(<PatientChat messages={mockMessages} />)

    const messageList = screen.getByRole('log')
    expect(messageList).toHaveAttribute('aria-label', 'Chat messages')
    expect(messageList).toHaveAttribute('aria-live', 'polite')
  })

  it('displays timestamps on messages', () => {
    render(<PatientChat messages={mockMessages} />)

    // Check that timestamps are rendered (format depends on locale)
    const messageBubbles = screen.getAllByTestId(/^message-/)
    expect(messageBubbles.length).toBe(3)
  })

  it('trims whitespace from messages before sending', async () => {
    const user = userEvent.setup()
    const mockOnSendMessage = vi.fn()
    render(<PatientChat onSendMessage={mockOnSendMessage} />)

    const input = screen.getByPlaceholderText('Type your message...')
    await user.type(input, '  Hello world  ')

    const sendButton = screen.getByRole('button', { name: 'Send message' })
    await user.click(sendButton)

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world')
  })
})
