'use client'

import { ArrowLeft, Bot, AlertCircle, Mic } from 'lucide-react'
import Link from 'next/link'
import { ChatContainer } from '@/components/chat'
import { useChat } from '@/hooks/use-chat'
import { useVoiceChat } from '@/hooks/use-voice-chat'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export default function PatientChatPage() {
  const {
    messages,
    isLoading,
    error,
    isInitializing,
    sendMessage,
    clearError,
  } = useChat({
    welcomeMessage:
      'Guten Tag! Ich bin Ihr medizinischer Assistent. Wie kann ich Ihnen heute helfen? Sie konnen mir Ihre Symptome beschreiben oder Fragen zu Ihrer Gesundheit stellen.',
  })

  const {
    voiceState,
    isVoiceModeEnabled,
    toggleVoiceMode,
    isSupported: isVoiceSupported,
    error: voiceError,
    clearError: clearVoiceError,
  } = useVoiceChat({
    onTranscript: (text) => {
      // When voice is transcribed, send it as a message
      sendMessage(text)
    },
    onError: (err) => {
      console.error('[VoiceChat] Error:', err)
    },
  })

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="shrink-0 border-b bg-background">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Zuruck
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Medizinischer Assistent</h1>
              <p className="text-xs text-muted-foreground">
                {isVoiceModeEnabled ? (
                  <span className="flex items-center gap-1">
                    <Mic className="size-3 text-primary animate-pulse" />
                    Sprachmodus aktiv
                  </span>
                ) : (
                  'KI-gestutzter Patientenassistent'
                )}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {(error || voiceError) && (
        <Alert variant="destructive" className="mx-4 mt-2">
          <AlertCircle className="size-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {voiceError?.message ||
                'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearError()
                clearVoiceError()
              }}
            >
              Schliessen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Chat area */}
      <main className="flex-1 overflow-hidden">
        {isInitializing ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Spinner className="size-8" />
              <p className="text-sm text-muted-foreground">
                Chat wird initialisiert...
              </p>
            </div>
          </div>
        ) : (
          <ChatContainer
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            placeholder="Beschreiben Sie Ihre Symptome oder stellen Sie eine Frage..."
            voiceState={voiceState}
            isVoiceModeEnabled={isVoiceModeEnabled}
            onVoiceToggle={toggleVoiceMode}
            isVoiceSupported={isVoiceSupported}
          />
        )}
      </main>
    </div>
  )
}
