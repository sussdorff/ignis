import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatContainer } from './chat-container'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { ChatMessageList } from './chat-message-list'
import type { ChatMessageType } from './types'

// Mock scrollIntoView since it's not available in jsdom
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const mockMessages: ChatMessageType[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Hallo! Wie kann ich Ihnen helfen?',
    timestamp: new Date('2024-01-15T10:00:00'),
  },
  {
    id: '2',
    role: 'user',
    content: 'Ich habe Kopfschmerzen.',
    timestamp: new Date('2024-01-15T10:01:00'),
  },
]

describe('ChatMessage', () => {
  it('renders assistant message with correct styling', () => {
    render(<ChatMessage message={mockMessages[0]} />)

    expect(screen.getByText('Hallo! Wie kann ich Ihnen helfen?')).toBeInTheDocument()
    expect(screen.getByTestId('chat-message-assistant')).toBeInTheDocument()
  })

  it('renders user message with correct styling', () => {
    render(<ChatMessage message={mockMessages[1]} />)

    expect(screen.getByText('Ich habe Kopfschmerzen.')).toBeInTheDocument()
    expect(screen.getByTestId('chat-message-user')).toBeInTheDocument()
  })

  it('displays formatted timestamp', () => {
    render(<ChatMessage message={mockMessages[0]} />)

    // The time should be formatted in HH:mm format
    const timeElement = screen.getByRole('time')
    expect(timeElement).toBeInTheDocument()
    expect(timeElement).toHaveAttribute('dateTime', mockMessages[0].timestamp.toISOString())
  })
})

describe('ChatMessageList', () => {
  it('renders all messages', () => {
    render(<ChatMessageList messages={mockMessages} />)

    expect(screen.getByText('Hallo! Wie kann ich Ihnen helfen?')).toBeInTheDocument()
    expect(screen.getByText('Ich habe Kopfschmerzen.')).toBeInTheDocument()
  })

  it('shows empty state when no messages', () => {
    render(<ChatMessageList messages={[]} />)

    expect(screen.getByText('Stellen Sie eine Frage, um zu beginnen.')).toBeInTheDocument()
  })

  it('shows loading indicator when isLoading is true', () => {
    render(<ChatMessageList messages={mockMessages} isLoading />)

    expect(screen.getByTestId('chat-loading-indicator')).toBeInTheDocument()
    expect(screen.getByText('Denkt nach')).toBeInTheDocument()
  })

  it('does not show loading indicator when isLoading is false', () => {
    render(<ChatMessageList messages={mockMessages} isLoading={false} />)

    expect(screen.queryByTestId('chat-loading-indicator')).not.toBeInTheDocument()
  })
})

describe('ChatInput', () => {
  it('renders input field and send button', () => {
    render(<ChatInput onSend={vi.fn()} />)

    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    expect(screen.getByTestId('chat-send-button')).toBeInTheDocument()
  })

  it('calls onSend with trimmed value when form is submitted', async () => {
    const handleSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput onSend={handleSend} />)

    const input = screen.getByTestId('chat-input')
    await user.type(input, '  Test message  ')
    await user.click(screen.getByTestId('chat-send-button'))

    expect(handleSend).toHaveBeenCalledWith('Test message')
  })

  it('clears input after sending', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={vi.fn()} />)

    const input = screen.getByTestId('chat-input') as HTMLTextAreaElement
    await user.type(input, 'Test message')
    await user.click(screen.getByTestId('chat-send-button'))

    expect(input.value).toBe('')
  })

  it('sends message on Enter key', async () => {
    const handleSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput onSend={handleSend} />)

    const input = screen.getByTestId('chat-input')
    await user.type(input, 'Test message{enter}')

    expect(handleSend).toHaveBeenCalledWith('Test message')
  })

  it('does not send on Shift+Enter', async () => {
    const handleSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput onSend={handleSend} />)

    const input = screen.getByTestId('chat-input')
    await user.type(input, 'Line 1{Shift>}{enter}{/Shift}Line 2')

    expect(handleSend).not.toHaveBeenCalled()
  })

  it('disables send button when input is empty', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const button = screen.getByTestId('chat-send-button')
    expect(button).toBeDisabled()
  })

  it('disables input when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled />)

    expect(screen.getByTestId('chat-input')).toBeDisabled()
    expect(screen.getByTestId('chat-send-button')).toBeDisabled()
  })

  it('disables input when isLoading prop is true', () => {
    render(<ChatInput onSend={vi.fn()} isLoading />)

    expect(screen.getByTestId('chat-input')).toBeDisabled()
    expect(screen.getByTestId('chat-send-button')).toBeDisabled()
  })

  it('shows custom placeholder', () => {
    render(<ChatInput onSend={vi.fn()} placeholder="Ihre Frage hier..." />)

    expect(screen.getByPlaceholderText('Ihre Frage hier...')).toBeInTheDocument()
  })

  describe('voice mode integration', () => {
    it('renders voice toggle when onVoiceToggle is provided', () => {
      render(<ChatInput onSend={vi.fn()} onVoiceToggle={vi.fn()} />)

      expect(screen.getByTestId('voice-mode-toggle')).toBeInTheDocument()
    })

    it('does not render voice toggle when onVoiceToggle is not provided', () => {
      render(<ChatInput onSend={vi.fn()} />)

      expect(screen.queryByTestId('voice-mode-toggle')).not.toBeInTheDocument()
    })

    it('disables input when voice mode is enabled', () => {
      render(
        <ChatInput
          onSend={vi.fn()}
          onVoiceToggle={vi.fn()}
          isVoiceModeEnabled={true}
          voiceState="listening"
        />
      )

      expect(screen.getByTestId('chat-input')).toBeDisabled()
      expect(screen.getByTestId('chat-send-button')).toBeDisabled()
    })

    it('shows voice mode placeholder when voice mode is enabled', () => {
      render(
        <ChatInput
          onSend={vi.fn()}
          onVoiceToggle={vi.fn()}
          isVoiceModeEnabled={true}
          voiceState="listening"
        />
      )

      expect(
        screen.getByPlaceholderText('Sprachmodus aktiv - sprechen Sie...')
      ).toBeInTheDocument()
    })

    it('shows voice mode help text when voice mode is enabled', () => {
      render(
        <ChatInput
          onSend={vi.fn()}
          onVoiceToggle={vi.fn()}
          isVoiceModeEnabled={true}
          voiceState="listening"
        />
      )

      expect(
        screen.getByText(
          'Klicken Sie auf das Mikrofon, um den Sprachmodus zu beenden'
        )
      ).toBeInTheDocument()
    })

    it('calls onVoiceToggle when voice toggle is clicked', () => {
      const handleVoiceToggle = vi.fn()
      render(<ChatInput onSend={vi.fn()} onVoiceToggle={handleVoiceToggle} />)

      fireEvent.click(screen.getByTestId('voice-mode-toggle'))

      expect(handleVoiceToggle).toHaveBeenCalledTimes(1)
    })
  })
})

describe('ChatContainer', () => {
  it('renders message list and input', () => {
    render(
      <ChatContainer
        messages={mockMessages}
        onSendMessage={vi.fn()}
      />
    )

    expect(screen.getByTestId('chat-container')).toBeInTheDocument()
    expect(screen.getByTestId('chat-message-list')).toBeInTheDocument()
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
  })

  it('passes messages to message list', () => {
    render(
      <ChatContainer
        messages={mockMessages}
        onSendMessage={vi.fn()}
      />
    )

    expect(screen.getByText('Hallo! Wie kann ich Ihnen helfen?')).toBeInTheDocument()
    expect(screen.getByText('Ich habe Kopfschmerzen.')).toBeInTheDocument()
  })

  it('calls onSendMessage when input is submitted', async () => {
    const handleSend = vi.fn()
    const user = userEvent.setup()
    render(
      <ChatContainer
        messages={mockMessages}
        onSendMessage={handleSend}
      />
    )

    const input = screen.getByTestId('chat-input')
    await user.type(input, 'New message{enter}')

    expect(handleSend).toHaveBeenCalledWith('New message')
  })

  it('shows loading state in message list', () => {
    render(
      <ChatContainer
        messages={mockMessages}
        onSendMessage={vi.fn()}
        isLoading
      />
    )

    expect(screen.getByTestId('chat-loading-indicator')).toBeInTheDocument()
  })

  it('passes disabled state to input', () => {
    render(
      <ChatContainer
        messages={mockMessages}
        onSendMessage={vi.fn()}
        disabled
      />
    )

    expect(screen.getByTestId('chat-input')).toBeDisabled()
  })

  describe('voice mode integration', () => {
    it('renders voice toggle when onVoiceToggle is provided', () => {
      render(
        <ChatContainer
          messages={mockMessages}
          onSendMessage={vi.fn()}
          onVoiceToggle={vi.fn()}
        />
      )

      expect(screen.getByTestId('voice-mode-toggle')).toBeInTheDocument()
    })

    it('shows voice indicator when voice mode is enabled and not idle', () => {
      render(
        <ChatContainer
          messages={mockMessages}
          onSendMessage={vi.fn()}
          onVoiceToggle={vi.fn()}
          isVoiceModeEnabled={true}
          voiceState="listening"
        />
      )

      expect(screen.getByTestId('voice-indicator')).toBeInTheDocument()
    })

    it('does not show voice indicator when voice mode is disabled', () => {
      render(
        <ChatContainer
          messages={mockMessages}
          onSendMessage={vi.fn()}
          onVoiceToggle={vi.fn()}
          isVoiceModeEnabled={false}
          voiceState="idle"
        />
      )

      expect(screen.queryByTestId('voice-indicator')).not.toBeInTheDocument()
    })

    it('does not show voice indicator when voice state is idle', () => {
      render(
        <ChatContainer
          messages={mockMessages}
          onSendMessage={vi.fn()}
          onVoiceToggle={vi.fn()}
          isVoiceModeEnabled={true}
          voiceState="idle"
        />
      )

      expect(screen.queryByTestId('voice-indicator')).not.toBeInTheDocument()
    })

    it('passes voice props to chat input', () => {
      render(
        <ChatContainer
          messages={mockMessages}
          onSendMessage={vi.fn()}
          onVoiceToggle={vi.fn()}
          isVoiceModeEnabled={true}
          voiceState="listening"
          isVoiceSupported={true}
        />
      )

      // Voice toggle should be in enabled state
      const voiceToggle = screen.getByTestId('voice-mode-toggle')
      expect(voiceToggle).toHaveAttribute('aria-pressed', 'true')
    })
  })
})
