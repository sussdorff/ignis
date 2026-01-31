/**
 * WebSocket audio streaming between Twilio and ElevenLabs
 * Handles bidirectional audio flow during phone calls
 */

import { WebSocket } from 'ws'
import { createElevenLabsClient } from '../lib/elevenlabs-client'
import { activeConversations } from '../routes/twilio'

interface TwilioMediaMessage {
  event: 'connected' | 'start' | 'media' | 'stop'
  sequenceNumber?: string
  streamSid?: string
  start?: {
    streamSid: string
    accountSid: string
    callSid: string
    tracks: string[]
    customParameters: Record<string, string>
  }
  media?: {
    track: 'inbound' | 'outbound'
    chunk: string // base64 encoded audio
    timestamp: string
    payload: string // base64 mulaw audio
  }
  stop?: {
    accountSid: string
    callSid: string
  }
}

interface ElevenLabsWebSocketMessage {
  type: 'audio' | 'ping' | 'pong' | 'metadata'
  audio?: string // base64 encoded audio
}

/**
 * Handle WebSocket connection for Twilio Media Streams
 * This function is called when Twilio connects via WebSocket to stream audio
 */
export async function handleTwilioWebSocket(ws: WebSocket): Promise<void> {
  let callSid: string | null = null
  let conversationId: string | null = null
  let elevenLabsWs: WebSocket | null = null
  let elevenLabsClient = createElevenLabsClient()

  console.log('[WebSocket] Twilio WebSocket connection established')

  ws.on('message', async (data: Buffer) => {
    try {
      const message: TwilioMediaMessage = JSON.parse(data.toString())

      switch (message.event) {
        case 'connected':
          console.log('[WebSocket] Twilio connected')
          break

        case 'start':
          // Call started - initialize ElevenLabs conversation
          if (message.start) {
            callSid = message.start.callSid
            const streamSid = message.start.streamSid
            
            console.log(`[WebSocket] Call started: ${callSid}, stream: ${streamSid}`)

            try {
              // Start ElevenLabs conversation
              const result = await elevenLabsClient.startConversation(callSid)
              conversationId = result.conversationId
              
              // Store mapping
              if (callSid) {
                activeConversations.set(callSid, conversationId)
              }

              console.log(`[WebSocket] ElevenLabs conversation started: ${conversationId}`)

              // Connect to ElevenLabs WebSocket for audio streaming
              const elevenLabsWsUrl = elevenLabsClient.getWebSocketUrl(conversationId)
              elevenLabsWs = new WebSocket(elevenLabsWsUrl, {
                headers: {
                  'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
                },
              })

              // Handle ElevenLabs WebSocket events
              elevenLabsWs.on('open', () => {
                console.log('[WebSocket] Connected to ElevenLabs')
              })

              elevenLabsWs.on('message', (elevenLabsData: Buffer) => {
                try {
                  const elevenLabsMessage: ElevenLabsWebSocketMessage = JSON.parse(
                    elevenLabsData.toString()
                  )

                  if (elevenLabsMessage.type === 'audio' && elevenLabsMessage.audio) {
                    // Send audio back to Twilio
                    const twilioMediaMessage = {
                      event: 'media',
                      streamSid,
                      media: {
                        payload: elevenLabsMessage.audio,
                      },
                    }
                    ws.send(JSON.stringify(twilioMediaMessage))
                  }
                } catch (error) {
                  console.error('[WebSocket] Error processing ElevenLabs message:', error)
                }
              })

              elevenLabsWs.on('error', (error) => {
                console.error('[WebSocket] ElevenLabs WebSocket error:', error)
              })

              elevenLabsWs.on('close', () => {
                console.log('[WebSocket] ElevenLabs WebSocket closed')
              })
            } catch (error) {
              console.error('[WebSocket] Failed to start ElevenLabs conversation:', error)
              // Send error message via Twilio
              ws.send(
                JSON.stringify({
                  event: 'media',
                  streamSid,
                  media: {
                    payload: Buffer.from('Error connecting to voice AI').toString('base64'),
                  },
                })
              )
            }
          }
          break

        case 'media':
          // Audio from caller - forward to ElevenLabs
          if (message.media && elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
            const audioPayload = {
              type: 'audio',
              audio: message.media.payload, // base64 mulaw audio from Twilio
            }
            elevenLabsWs.send(JSON.stringify(audioPayload))
          }
          break

        case 'stop':
          // Call ended
          console.log(`[WebSocket] Call stopped: ${message.stop?.callSid}`)
          
          // Clean up
          if (elevenLabsWs) {
            elevenLabsWs.close()
            elevenLabsWs = null
          }
          
          if (conversationId) {
            await elevenLabsClient.endConversation(conversationId)
          }
          
          if (callSid) {
            activeConversations.delete(callSid)
          }
          break
      }
    } catch (error) {
      console.error('[WebSocket] Error processing message:', error)
    }
  })

  ws.on('error', (error) => {
    console.error('[WebSocket] Twilio WebSocket error:', error)
  })

  ws.on('close', async () => {
    console.log('[WebSocket] Twilio WebSocket closed')
    
    // Clean up
    if (elevenLabsWs) {
      elevenLabsWs.close()
    }
    
    if (conversationId) {
      await elevenLabsClient.endConversation(conversationId)
    }
    
    if (callSid) {
      activeConversations.delete(callSid)
    }
  })
}
