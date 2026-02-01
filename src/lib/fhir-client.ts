import { aidboxConfig } from './config'

const { fhirBaseUrl, user, password } = aidboxConfig

/** Basic auth header value (base64 of "user:password") */
function getAuthHeader(): string {
  const credentials = `${user}:${password}`
  const encoded = typeof Buffer !== 'undefined'
    ? Buffer.from(credentials, 'utf-8').toString('base64')
    : btoa(credentials)
  return `Basic ${encoded}`
}

const defaultHeaders: Record<string, string> = {
  Accept: 'application/fhir+json',
  'Content-Type': 'application/fhir+json',
  Authorization: getAuthHeader(),
}

const FHIR_REQUEST_TIMEOUT_MS = 20_000

function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = FHIR_REQUEST_TIMEOUT_MS, ...fetchInit } = init
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  return fetch(url, { ...fetchInit, signal: controller.signal }).finally(() => clearTimeout(id))
}

/** Options for FHIR client requests (e.g. shorter timeout for doctor dashboard). */
export interface FhirClientOptions {
  timeout?: number
}

/**
 * Low-level FHIR HTTP client for Aidbox (R4 4.0.1).
 * All methods throw on non-2xx responses. Requests timeout after 20s by default.
 */
export const fhirClient = {
  /** GET [base]/[resourceType] or [base]/[resourceType]/[id] */
  async get<T>(path: string, options?: FhirClientOptions): Promise<T> {
    const url = path.startsWith('http') ? path : `${fhirBaseUrl}/${path.replace(/^\//, '')}`
    const timeout = options?.timeout ?? FHIR_REQUEST_TIMEOUT_MS
    const res = await fetchWithTimeout(url, { method: 'GET', headers: defaultHeaders, timeout })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`FHIR GET ${path} failed: ${res.status} ${res.statusText} - ${body}`)
    }
    return res.json() as Promise<T>
  },

  /** POST [base]/[resourceType] (create) */
  async post<T>(path: string, body: unknown): Promise<T> {
    const url = path.startsWith('http') ? path : `${fhirBaseUrl}/${path.replace(/^\//, '')}`
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`FHIR POST ${path} failed: ${res.status} ${res.statusText} - ${text}`)
    }
    return res.json() as Promise<T>
  },

  /** PUT [base]/[resourceType]/[id] (update) */
  async put<T>(path: string, body: unknown): Promise<T> {
    const url = path.startsWith('http') ? path : `${fhirBaseUrl}/${path.replace(/^\//, '')}`
    const res = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: defaultHeaders,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`FHIR PUT ${path} failed: ${res.status} ${res.statusText} - ${text}`)
    }
    return res.json() as Promise<T>
  },
}
