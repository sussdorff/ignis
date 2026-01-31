import type { FHIRPatient } from './schemas'
import { fhirClient } from './fhir-client'

/** FHIR R4 Bundle (searchset) returned by GET /Patient?... */
interface FHIRBundle {
  resourceType: 'Bundle'
  type: 'searchset' | 'transaction-response'
  total?: number
  entry?: Array<{ resource?: FHIRPatient }>
}

/**
 * Normalize phone number for comparison and FHIR search.
 * Strips spaces, dashes, parentheses. Keeps + for E.164 format.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '')
}

/**
 * Build display name for Voice AI greeting.
 * Returns "Frau Weber" / "Herr Müller" based on gender, or full name if unknown.
 */
export function buildPatientDisplayName(patient: FHIRPatient): string {
  const name = patient.name?.[0]
  if (!name) return ''
  const family = name.family ?? ''
  const given = (name.given ?? []).join(' ')
  if (patient.gender === 'male') return family ? `Herr ${family}` : given
  if (patient.gender === 'female') return family ? `Frau ${family}` : given
  const full = [given, family].filter(Boolean).join(' ').trim()
  return full || family
}

/**
 * Generate phone number format variations for FHIR search.
 * FHIR telecom search requires exact match, so we try multiple formats.
 */
function generatePhoneVariations(phone: string): string[] {
  const normalized = normalizePhone(phone)
  if (!normalized) return []

  const variations = new Set<string>()
  variations.add(normalized)

  // If starts with +49, try German mobile format with spaces: +49 1XX XXXXXXX
  if (normalized.startsWith('+49') && normalized.length >= 12) {
    const afterCountry = normalized.slice(3)
    // Format: +49 1XX XXXXXXX (mobile)
    if (afterCountry.startsWith('1')) {
      const formatted = `+49 ${afterCountry.slice(0, 3)} ${afterCountry.slice(3)}`
      variations.add(formatted)
    }
  }

  // Try without + prefix
  if (normalized.startsWith('+')) {
    variations.add(normalized.slice(1))
  }

  return Array.from(variations)
}

/**
 * Find a patient by phone number (telecom search).
 * Returns the patient if found; null otherwise.
 * Tries multiple phone number format variations for FHIR search.
 */
export async function findPatientByPhone(phone: string): Promise<FHIRPatient | null> {
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  const variations = generatePhoneVariations(phone)

  // Try each variation until we find a match
  for (const phoneVariation of variations) {
    const path = `Patient?telecom=${encodeURIComponent(phoneVariation)}&_count=5`
    try {
      const bundle = (await fhirClient.get(path)) as FHIRBundle
      const entries = bundle.entry ?? []
      const patients = entries
        .map((e) => e.resource)
        .filter((r): r is FHIRPatient => r?.resourceType === 'Patient')

      // Filter by matching phone (additional client-side verification)
      const matching = patients.filter((p) => {
        const phones = p.telecom
          ?.filter((t) => t.system === 'phone')
          .map((t) => normalizePhone(t.value)) ?? []
        return phones.some((pn) => pn.includes(normalized) || normalized.includes(pn))
      })

      if (matching.length > 0) {
        return matching[0]!
      }
    } catch {
      // Continue trying other variations
    }
  }

  return null
}

/**
 * Get a patient by ID via Aidbox FHIR read.
 * Returns null if not found (404).
 */
export async function getPatientById(id: string): Promise<FHIRPatient | null> {
  try {
    const patient = (await fhirClient.get(`Patient/${id}`)) as FHIRPatient
    return patient?.resourceType === 'Patient' ? patient : null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404') || message.includes('Not Found')) {
      return null
    }
    throw err
  }
}

/**
 * Validate birth date factor against patient record.
 * Compares YYYY-MM-DD format.
 */
export function validateBirthDate(patient: FHIRPatient, birthDate: string): boolean {
  if (!patient.birthDate || !birthDate) return false
  // Normalize to YYYY-MM-DD
  const patientDate = patient.birthDate.slice(0, 10)
  const inputDate = birthDate.slice(0, 10)
  return patientDate === inputDate
}

/**
 * Validate postal code factor against patient record.
 * Case-insensitive, trims whitespace.
 */
export function validatePostalCode(patient: FHIRPatient, postalCode: string): boolean {
  if (!postalCode) return false
  const addresses = patient.address ?? []
  const input = postalCode.trim().toLowerCase()
  return addresses.some((addr) => {
    const patientPostal = (addr.postalCode ?? '').trim().toLowerCase()
    return patientPostal === input
  })
}

/**
 * Validate city factor against patient record.
 * Case-insensitive, trims whitespace.
 */
export function validateCity(patient: FHIRPatient, city: string): boolean {
  if (!city) return false
  const addresses = patient.address ?? []
  const input = city.trim().toLowerCase()
  return addresses.some((addr) => {
    const patientCity = (addr.city ?? '').trim().toLowerCase()
    return patientCity === input
  })
}

/**
 * Validate street name factor against patient record.
 * Extracts the street name from address lines and compares.
 * Does NOT require house number (per authentication policy).
 *
 * Matching rules:
 * - Extract street name by removing trailing numbers (house number)
 * - Compare case-insensitively
 * - Input must START with the patient's street name (not just contain it anywhere)
 * - Or patient's street must START with the input (for partial matching)
 */
export function validateStreetName(patient: FHIRPatient, streetName: string): boolean {
  if (!streetName) return false
  const addresses = patient.address ?? []
  const input = streetName.trim().toLowerCase()

  // Require minimum length
  if (input.length < 3) return false

  return addresses.some((addr) => {
    const lines = addr.line ?? []
    return lines.some((line) => {
      // Extract street name by removing trailing house number
      // e.g., "Musterstraße 42" -> "Musterstraße"
      // e.g., "Hauptstraße 10" -> "Hauptstraße"
      const patientStreet = line
        .replace(/\s+\d+[a-zA-Z]?\s*$/, '') // Remove trailing number (with optional letter suffix)
        .trim()
        .toLowerCase()

      // Exact match
      if (patientStreet === input) return true

      // Input STARTS with the patient's street name
      // (user says "Musterstraße 42", patient has "Musterstraße")
      if (input.startsWith(patientStreet) && patientStreet.length >= 5) return true

      // Patient's street STARTS with the input
      // (user says "Muster", patient has "Musterstraße")
      if (patientStreet.startsWith(input) && input.length >= 5) return true

      return false
    })
  })
}

/** Authentication attempt tracking (in-memory, should be moved to Redis/DB in production) */
interface AuthAttempt {
  count: number
  lastAttempt: Date
  blocked: boolean
}

const authAttempts = new Map<string, AuthAttempt>()
const MAX_FAILED_ATTEMPTS = 3
const BLOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Check if patient is blocked from authentication attempts.
 */
export function isPatientBlocked(patientId: string): boolean {
  const attempt = authAttempts.get(patientId)
  if (!attempt) return false

  // Check if block has expired
  if (attempt.blocked) {
    const elapsed = Date.now() - attempt.lastAttempt.getTime()
    if (elapsed > BLOCK_DURATION_MS) {
      // Reset after block duration
      authAttempts.delete(patientId)
      return false
    }
    return true
  }
  return false
}

/**
 * Record a failed authentication attempt.
 * Returns true if patient is now blocked.
 */
export function recordFailedAttempt(patientId: string): boolean {
  const existing = authAttempts.get(patientId)
  const now = new Date()

  if (!existing) {
    authAttempts.set(patientId, { count: 1, lastAttempt: now, blocked: false })
    return false
  }

  existing.count++
  existing.lastAttempt = now

  if (existing.count >= MAX_FAILED_ATTEMPTS) {
    existing.blocked = true
    return true
  }

  return false
}

/**
 * Clear failed attempts after successful authentication.
 */
export function clearFailedAttempts(patientId: string): void {
  authAttempts.delete(patientId)
}

/**
 * GDPR-compliant logging for voice authentication.
 * Logs event type, timestamp, patient ID (if known), but never PII on failure.
 */
export function logVoiceAuthEvent(event: {
  type: 'lookup' | 'authenticate'
  success: boolean
  patientId?: string
  level?: number
  failedFactor?: string
}): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: `voice_${event.type}`,
    success: event.success,
    // Only include patientId on success or for tracking blocked attempts
    ...(event.success && event.patientId ? { patientId: event.patientId } : {}),
    ...(event.level !== undefined ? { authLevel: event.level } : {}),
    // For failures, log which factor failed but NOT the value
    ...(event.failedFactor ? { failedFactor: event.failedFactor } : {}),
  }

  // In production, send to structured logging system
  console.log('[VoiceAuth]', JSON.stringify(logEntry))
}
