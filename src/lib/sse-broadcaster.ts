/**
 * SSE Broadcaster for real-time appointment and queue updates.
 * Clients connect to /api/appointments/events and receive updates
 * when appointments are created, updated, rescheduled, or cancelled.
 * Queue updates are also broadcast when patients are added/updated in the queue.
 */

export type AppointmentEventType = 'created' | 'updated' | 'rescheduled' | 'cancelled'
export type QueueEventType = 'added' | 'updated' | 'removed'

export interface AppointmentEvent {
  type: AppointmentEventType
  appointmentId: string
  timestamp: string
  data?: Record<string, unknown>
}

export interface QueueEvent {
  type: QueueEventType
  queueEntryId: string
  timestamp: string
  data?: Record<string, unknown>
}

// Connected SSE clients
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()

/**
 * Register a new SSE client connection.
 */
export function addSSEClient(controller: ReadableStreamDefaultController<Uint8Array>): void {
  clients.add(controller)
  console.log(`[SSE] Client connected. Total clients: ${clients.size}`)
}

/**
 * Remove an SSE client connection.
 */
export function removeSSEClient(controller: ReadableStreamDefaultController<Uint8Array>): void {
  clients.delete(controller)
  console.log(`[SSE] Client disconnected. Total clients: ${clients.size}`)
}

/**
 * Broadcast an appointment event to all connected clients.
 */
export function broadcastAppointmentEvent(event: AppointmentEvent): void {
  const message = `data: ${JSON.stringify(event)}\n\n`
  const encoder = new TextEncoder()
  const data = encoder.encode(message)

  let successCount = 0
  const deadClients: ReadableStreamDefaultController<Uint8Array>[] = []

  for (const controller of clients) {
    try {
      controller.enqueue(data)
      successCount++
    } catch {
      // Client disconnected, mark for removal
      deadClients.push(controller)
    }
  }

  // Clean up dead clients
  for (const client of deadClients) {
    clients.delete(client)
  }

  if (clients.size > 0) {
    console.log(`[SSE] Broadcast ${event.type} for ${event.appointmentId} to ${successCount}/${clients.size} clients`)
  }
}

/**
 * Get the current number of connected clients.
 */
export function getSSEClientCount(): number {
  return clients.size
}

/**
 * Broadcast a queue event to all connected clients.
 */
export function broadcastQueueEvent(event: QueueEvent): void {
  const message = `data: ${JSON.stringify({ ...event, source: 'queue' })}\n\n`
  const encoder = new TextEncoder()
  const data = encoder.encode(message)

  let successCount = 0
  const deadClients: ReadableStreamDefaultController<Uint8Array>[] = []

  for (const controller of clients) {
    try {
      controller.enqueue(data)
      successCount++
    } catch {
      // Client disconnected, mark for removal
      deadClients.push(controller)
    }
  }

  // Clean up dead clients
  for (const client of deadClients) {
    clients.delete(client)
  }

  if (clients.size > 0) {
    console.log(`[SSE] Broadcast queue ${event.type} for ${event.queueEntryId} to ${successCount}/${clients.size} clients`)
  }
}
