import { Hono } from 'hono'
import { requireLevel } from '../middleware/auth'
import { storeAuthToken, clearAllAuthData } from '../lib/auth-tokens'

/**
 * Test routes for authentication middleware.
 * Used in integration tests to verify requireLevel behavior.
 * Only available in non-production environments.
 */
const authTest = new Hono()

/**
 * POST /api/auth-test/inject-token
 * Inject a test token for integration testing.
 * Security: Only available in non-production!
 */
authTest.post('/inject-token', (c) => {
  const { rawToken, patientId, method } = c.req.query()
  
  if (!rawToken || !patientId || !method) {
    return c.json({ error: 'Missing parameters' }, 400)
  }
  
  const stored = storeAuthToken(rawToken, patientId, method as any)
  
  return c.json({
    success: true,
    tokenHash: stored.tokenHash,
    expiresAt: stored.expiresAt.toISOString(),
  })
})

/**
 * POST /api/auth-test/clear
 * Clear all auth data for test isolation.
 */
authTest.post('/clear', (c) => {
  clearAllAuthData()
  return c.json({ success: true })
})

/**
 * GET /api/auth-test/level1
 * Requires Level 1 authentication
 */
authTest.get('/level1', requireLevel(1), (c) => {
  const auth = c.get('auth')
  return c.json({
    message: 'Level 1 access granted',
    level: auth.level,
    patientId: auth.sub,
  })
})

/**
 * GET /api/auth-test/level2
 * Requires Level 2 authentication
 */
authTest.get('/level2', requireLevel(2), (c) => {
  const auth = c.get('auth')
  return c.json({
    message: 'Level 2 access granted',
    level: auth.level,
    patientId: auth.sub,
  })
})

/**
 * GET /api/auth-test/level3
 * Requires Level 3 authentication
 */
authTest.get('/level3', requireLevel(3), (c) => {
  const auth = c.get('auth')
  return c.json({
    message: 'Level 3 access granted',
    level: auth.level,
    patientId: auth.sub,
  })
})

export default authTest
