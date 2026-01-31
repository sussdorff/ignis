import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import * as YAML from 'yaml'
import patients from './routes/patients'
import appointments from './routes/appointments'
import queue from './routes/queue'
import callback from './routes/callback'
import { serveStatic } from 'hono/bun'

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

// Serve frontend static files (built React app)
app.use('/*', serveStatic({ root: './frontend/dist' }))

// Fallback to index.html for client-side routing (SPA)
app.get('*', serveStatic({ path: './frontend/dist/index.html' }))

// Start server
const port = Number(process.env.PORT) || 3000
console.log(`🔥 Ignis server running on http://localhost:${port}`)

Bun.serve({
  port,
  fetch: app.fetch,
})
