import { Hono } from 'hono'
import { setupDemoData, clearDemoData } from '../lib/demo-setup'

const demo = new Hono()

// =============================================================================
// POST /api/demo/setup - Setup demo data for today
// =============================================================================
demo.post('/setup', async (c) => {
  console.log('[API] POST /api/demo/setup')

  try {
    const result = await setupDemoData()

    if (result.success) {
      return c.json({
        ok: true,
        message: 'Demo data setup complete',
        ...result,
      }, 200)
    } else {
      return c.json({
        ok: false,
        message: 'Demo data setup completed with errors',
        ...result,
      }, 207) // Multi-Status
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[API] Demo setup failed:', message)
    return c.json({
      ok: false,
      error: 'setup_failed',
      message,
    }, 500)
  }
})

// =============================================================================
// DELETE /api/demo/clear - Clear demo data for today
// =============================================================================
demo.delete('/clear', async (c) => {
  console.log('[API] DELETE /api/demo/clear')

  try {
    const result = await clearDemoData()

    return c.json({
      ok: true,
      message: 'Demo data cleared',
      ...result,
    }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[API] Demo clear failed:', message)
    return c.json({
      ok: false,
      error: 'clear_failed',
      message,
    }, 500)
  }
})

// =============================================================================
// GET /api/demo/status - Check demo data status
// =============================================================================
demo.get('/status', async (c) => {
  // Import here to avoid circular dependency
  const { getTodayQueue, getQueueStats } = await import('../lib/aidbox-encounters')
  const { getTodayAppointments } = await import('../lib/aidbox-appointments')

  try {
    const [queue, stats, appointments] = await Promise.all([
      getTodayQueue(),
      getQueueStats(),
      getTodayAppointments(),
    ])

    return c.json({
      ok: true,
      today: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }),
      queue: {
        total: queue.length,
        ...stats,
      },
      appointments: {
        total: appointments.length,
        booked: appointments.filter(a => a.status === 'booked').length,
        arrived: appointments.filter(a => a.status === 'arrived').length,
      },
    }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({
      ok: false,
      error: 'status_failed',
      message,
    }, 500)
  }
})

export default demo
