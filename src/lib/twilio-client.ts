/**
 * Twilio client utilities
 * Handles TwiML generation and webhook signature verification
 */

import twilio from 'twilio'

const { validateRequest } = twilio

interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
}

/**
 * Verify that a webhook request came from Twilio
 * @param authToken - Twilio auth token
 * @param signature - X-Twilio-Signature header from request
 * @param url - Full URL of the webhook endpoint
 * @param params - Request parameters (body for POST)
 */
export function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, unknown>
): boolean {
  try {
    return validateRequest(authToken, signature, url, params)
  } catch (error) {
    console.error('[Twilio] Signature verification failed:', error)
    return false
  }
}

/**
 * Generate TwiML response to start a WebSocket stream for media
 * @param streamUrl - WebSocket URL to send audio to
 * @param callSid - Twilio call SID
 */
export function generateStreamTwiML(streamUrl: string, callSid: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callSid" value="${callSid}" />
    </Stream>
  </Connect>
</Response>`
}

/**
 * Generate TwiML to say a message and hang up (error fallback)
 * @param message - Message to speak
 */
export function generateSayTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">${escapeXml(message)}</Say>
  <Hangup/>
</Response>`
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Create Twilio config from environment variables
 */
export function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error(
      'Missing Twilio credentials. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.'
    )
  }

  return { accountSid, authToken, phoneNumber }
}

/**
 * Extract phone number from Twilio request
 * @param from - The "From" parameter from Twilio webhook
 */
export function formatPhoneNumber(from: string): string {
  // Twilio sends in E.164 format (+1234567890)
  return from
}
