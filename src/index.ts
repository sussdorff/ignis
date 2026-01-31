import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import * as YAML from 'yaml'
import patients from './routes/patients'
import appointments from './routes/appointments'
import queue from './routes/queue'
import callback from './routes/callback'
import twilio from './routes/twilio'
import questionnaires from './routes/questionnaires'
import { serveStatic } from 'hono/bun'
import { handleTwilioWebSocket } from './lib/twilio-websocket'
import type { ServerWebSocket } from 'bun'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('/api/*', cors())

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// API routes
app.get('/api', (c) => c.json({ message: 'Ignis API', version: '0.1.0' }))

// OpenAPI spec for ElevenLabs tools (servers.url set from API_BASE_URL env)
const openApiSpecPath = new URL('../docs/backend-services-elevenlabs.openapi.yaml', import.meta.url)
let cachedOpenApiJson: object | null = null
app.get('/api/openapi.json', async (c) => {
  if (!cachedOpenApiJson) {
    const yamlText = await Bun.file(openApiSpecPath).text()
    const spec = YAML.parse(yamlText) as { servers?: Array<{ url: string }> }
    const baseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`
    if (spec.servers?.[0]) spec.servers[0].url = baseUrl
    cachedOpenApiJson = spec
  }
  return c.json(cachedOpenApiJson)
})

// Patient routes (per OpenAPI spec: patient_lookup, patient_create_or_update)
app.route('/api/patients', patients)

// Appointment routes (get_available_slots, book_appointment)
app.route('/api/appointments', appointments)

// Queue routes (add_to_urgent_queue, register_emergency_transfer)
app.route('/api/queue', queue)

// Callback route (request_callback)
app.route('/api/callback', callback)

// Questionnaire routes (get questionnaires from FHIR store)
app.route('/api/questionnaires', questionnaires)

// Twilio routes (voice webhooks, call status, WebSocket streaming)
app.route('/api/twilio', twilio)

// Serve frontend static files (built React app)
app.use('/*', serveStatic({ root: './frontend/dist' }))

// Fallback to index.html for client-side routing (SPA)
app.get('*', serveStatic({ path: './frontend/dist/index.html' }))

// Start server with WebSocket support
const port = Number(process.env.PORT) || 3000
console.log(`🔥 Ignis server running on http://localhost:${port}`)
console.log(`📞 Twilio webhooks: /api/twilio/voice, /api/twilio/status`)
console.log(`🔌 WebSocket endpoint: ws://localhost:${port}/api/twilio/stream`)

Bun.serve({
  port,
  
  fetch(req, server) {
    const url = new URL(req.url)
    
    // Handle WebSocket upgrade for Twilio Media Streams
    if (url.pathname === '/api/twilio/stream') {
      if (server.upgrade(req)) {
        return undefined // Connection upgraded to WebSocket
      }
      return new Response('WebSocket upgrade failed', { status: 400 })
    }
    
    // Handle regular HTTP requests
    return app.fetch(req, { server })
  },
  
  // WebSocket handler for Twilio Media Streams
  websocket: {
    message(ws, message) {
      const data = typeof message === 'string' ? message : Buffer.from(message).toString()
      // Trigger message handler if set
      if ((ws as any)._messageHandler) {
        (ws as any)._messageHandler(Buffer.from(data))
      }
    },
    
    open(ws) {
      console.log('[WebSocket] Twilio stream connected')
      // Initialize WebSocket wrapper with standard interface
      const wsWrapper: any = ws
      wsWrapper.on = (event: string, handler: (...args: any[]) => void) => {
        if (event === 'message') wsWrapper._messageHandler = handler
        else if (event === 'close') wsWrapper._closeHandler = handler
        else if (event === 'error') wsWrapper._errorHandler = handler
      }
      wsWrapper.send = (data: string) => ws.send(data)
      wsWrapper.close = () => ws.close()
      wsWrapper.readyState = 1 // OPEN
      
      handleTwilioWebSocket(wsWrapper)
    },
    
    close(ws, code, reason) {
      console.log(`[WebSocket] Stream disconnected: ${code} ${reason}`)
      if ((ws as any)._closeHandler) {
        (ws as any)._closeHandler()
      }
    },
    
    error(ws, error) {
      console.error('[WebSocket] Error:', error)
      if ((ws as any)._errorHandler) {
        (ws as any)._errorHandler(error)
      }
    },
  },
})
