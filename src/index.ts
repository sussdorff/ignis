import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('/api/*', cors())

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// API routes placeholder
app.get('/api', (c) => c.json({ message: 'Ignis API', version: '0.1.0' }))

// Patient routes (to be implemented)
app.get('/api/patients', (c) => c.json({ patients: [], message: 'Not implemented yet' }))

// Appointment routes (to be implemented)
app.get('/api/appointments', (c) => c.json({ appointments: [], message: 'Not implemented yet' }))

// Start server
const port = process.env.PORT || 3000
console.log(`🔥 Ignis server running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
