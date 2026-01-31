/**
 * ElevenLabs Conversational AI client
 * Manages conversation sessions with the ElevenLabs agent
 */

import axios, { type AxiosInstance } from 'axios'

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'

interface ElevenLabsConfig {
  apiKey: string
  agentId: string
}

interface StartConversationResponse {
  conversation_id: string
}

interface ConversationStatus {
  conversation_id: string
  status: 'active' | 'ended' | 'error'
  agent_id: string
}

export class ElevenLabsClient {
  private client: AxiosInstance
  private agentId: string

  constructor(config: ElevenLabsConfig) {
    this.agentId = config.agentId
    this.client = axios.create({
      baseURL: ELEVENLABS_API_BASE,
      headers: {
        'xi-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Start a new conversation with the ElevenLabs agent
   * @param callSid - Twilio call SID for tracking
   * @param callerNumber - Phone number of the caller
   * @returns Conversation ID and WebSocket URL for audio streaming
   */
  async startConversation(callSid: string, callerNumber?: string): Promise<{
    conversationId: string
    signedUrl?: string
  }> {
    try {
      const payload: Record<string, unknown> = {
        agent_id: this.agentId,
      }

      // Add caller context if available
      if (callerNumber) {
        payload.context = {
          call_sid: callSid,
          caller_number: callerNumber,
        }
      }

      const response = await this.client.post<StartConversationResponse>(
        '/convai/conversation',
        payload
      )

      console.log(`[ElevenLabs] Started conversation: ${response.data.conversation_id}`)

      return {
        conversationId: response.data.conversation_id,
        signedUrl: (response.data as any).signed_url,
      }
    } catch (error) {
      console.error('[ElevenLabs] Failed to start conversation:', error)
      if (axios.isAxiosError(error)) {
        throw new Error(
          `ElevenLabs API error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
        )
      }
      throw error
    }
  }

  /**
   * Get the status of an ongoing conversation
   * @param conversationId - Conversation ID from startConversation
   */
  async getConversationStatus(conversationId: string): Promise<ConversationStatus> {
    try {
      const response = await this.client.get<ConversationStatus>(
        `/convai/conversation/${conversationId}`
      )
      return response.data
    } catch (error) {
      console.error('[ElevenLabs] Failed to get conversation status:', error)
      throw error
    }
  }

  /**
   * End an active conversation
   * @param conversationId - Conversation ID to end
   */
  async endConversation(conversationId: string): Promise<void> {
    try {
      await this.client.delete(`/convai/conversation/${conversationId}`)
      console.log(`[ElevenLabs] Ended conversation: ${conversationId}`)
    } catch (error) {
      console.error('[ElevenLabs] Failed to end conversation:', error)
      // Don't throw - ending a conversation is best-effort
    }
  }

  /**
   * Get the WebSocket URL for a conversation
   * This is used for audio streaming
   */
  getWebSocketUrl(conversationId: string): string {
    return `wss://api.elevenlabs.io/v1/convai/conversation/${conversationId}/audio`
  }
}

/**
 * Create an ElevenLabs client instance from environment variables
 */
export function createElevenLabsClient(): ElevenLabsClient {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID

  if (!apiKey || !agentId) {
    throw new Error(
      'Missing ElevenLabs credentials. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID environment variables.'
    )
  }

  return new ElevenLabsClient({ apiKey, agentId })
}
