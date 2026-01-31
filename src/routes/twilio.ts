/**
 * Twilio webhook handlers
 * Handles incoming calls and streams audio to ElevenLabs
 */

import { Hono } from 'hono'
import type { Context } from 'hono'
import { createElevenLabsClient } from '../lib/elevenlabs-client'
import {
  getTwilioConfig,
  generateStreamTwiML,
  generateSayTwiML,
  formatPhoneNumber,
} from '../lib/twilio-client'

const twilio = new Hono()

// Store active conversations (call SID -> conversation ID)
const activeConversations = new Map<string, string>()

/**
 * POST /api/twilio/voice
 * Webhook called when an inbound call is received
 * Returns TwiML with WebSocket stream instruction
 */
twilio.post('/voice', async (c: Context) => {
  try {
    // Extract Twilio parameters
    const body = await c.req.parseBody()
    const callSid = body.CallSid as string
    const from = body.From as string
    const to = body.To as string

    console.log(`[Twilio] Incoming call: ${callSid} from ${from} to ${to}`)

    // Get WebSocket URL for this server
    const protocol = c.req.header('x-forwarded-proto') || 'wss'
    const host = c.req.header('host') || 'localhost:3000'
    const streamUrl = `${protocol}://${host}/api/twilio/stream`

    console.log(`[Twilio] Returning TwiML with stream URL: ${streamUrl}`)

    // Return TwiML to start WebSocket stream
    const twiml = generateStreamTwiML(streamUrl, callSid)
    
    return c.text(twiml, 200, {
      'Content-Type': 'text/xml',
    })
  } catch (error) {
    console.error('[Twilio] Error handling voice webhook:', error)
    const errorMessage = 'Es tut uns leid, es ist ein technischer Fehler aufgetreten. Bitte rufen Sie später erneut an.'
    return c.text(generateSayTwiML(errorMessage), 200, {
      'Content-Type': 'text/xml',
    })
  }
})

/**
 * POST /api/twilio/status
 * Webhook called when call status changes (answered, completed, etc.)
 */
twilio.post('/status', async (c: Context) => {
  try {
    const body = await c.req.parseBody()
    const callSid = body.CallSid as string
    const callStatus = body.CallStatus as string

    console.log(`[Twilio] Call status update: ${callSid} -> ${callStatus}`)

    // If call ended, clean up conversation
    if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'no-answer') {
      const conversationId = activeConversations.get(callSid)
      if (conversationId) {
        console.log(`[Twilio] Cleaning up conversation: ${conversationId}`)
        const elevenLabs = createElevenLabsClient()
        await elevenLabs.endConversation(conversationId)
        activeConversations.delete(callSid)
      }
    }

    return c.text('', 200)
  } catch (error) {
    console.error('[Twilio] Error handling status webhook:', error)
    return c.text('', 200) // Always return 200 to Twilio
  }
})

/**
 * GET /api/twilio/conversations
 * Debug endpoint to see active conversations
 */
twilio.get('/conversations', (c: Context) => {
  const conversations = Array.from(activeConversations.entries()).map(([callSid, conversationId]) => ({
    callSid,
    conversationId,
  }))
  return c.json({ active: conversations.length, conversations })
})

export default twilio
export { activeConversations }
