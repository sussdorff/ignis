import { describe, it, expect } from 'bun:test'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

describe('Health & API', () => {
  it('GET /health returns ok status', async () => {
    const res = await fetch(`${BASE}/health`)
    expect(res.ok).toBe(true)

    const data = await res.json() as { status: string; timestamp: string }
    expect(data.status).toBe('ok')
    expect(data.timestamp).toBeDefined()
  })

  it('GET /api returns API info', async () => {
    const res = await fetch(`${BASE}/api`)
    expect(res.ok).toBe(true)

    const data = await res.json() as { message: string; version: string }
    expect(data.message).toBe('Ignis API')
    expect(data.version).toBeDefined()
  })

  it('GET /api/openapi.json returns OpenAPI spec', async () => {
    const res = await fetch(`${BASE}/api/openapi.json`)
    expect(res.ok).toBe(true)

    const data = await res.json() as { openapi: string; paths: object }
    expect(data.openapi).toBeDefined()
    expect(typeof data.paths).toBe('object')
  })
})
