import type { FHIRPatient } from './schemas'
import { fhirClient } from './fhir-client'

/** FHIR R4 Bundle (searchset) */
interface FHIRBundle {
  resourceType: 'Bundle'
  type: 'searchset'
  total?: number
  entry?: Array<{ resource?: FHIRPatient }>
}

/**
 * Find a patient by email address (Patient.telecom where system=email).
 * Returns the first matching patient or null if not found.
 */
export async function findPatientByEmail(email: string): Promise<FHIRPatient | null> {
  const normalizedEmail = email.toLowerCase().trim()

  // FHIR search by email telecom
  // Note: Aidbox supports telecom search with system|value format
  const path = `Patient?telecom=email|${encodeURIComponent(normalizedEmail)}`

  try {
    const bundle = (await fhirClient.get(path)) as FHIRBundle
    const entries = bundle.entry ?? []
    const patients = entries
      .map((e) => e.resource)
      .filter((r): r is FHIRPatient => r?.resourceType === 'Patient')

    // Additional client-side filter for exact email match (case-insensitive)
    const exactMatch = patients.find((p) =>
      p.telecom?.some(
        (t) => t.system === 'email' && t.value?.toLowerCase() === normalizedEmail
      )
    )

    return exactMatch ?? null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Return null on 404 or empty results
    if (message.includes('404')) {
      return null
    }
    throw err
  }
}

/**
 * Find a patient by phone number (Patient.telecom where system=phone).
 * Expects phone in E.164 format (e.g., +491719876543).
 * Returns the first matching patient or null if not found.
 */
export async function findPatientByPhone(phone: string): Promise<FHIRPatient | null> {
  // Normalize phone: remove spaces, dashes, parentheses
  const normalizedPhone = phone.replace(/[\s\-()]/g, '')

  // FHIR search by phone telecom
  const path = `Patient?telecom=phone|${encodeURIComponent(normalizedPhone)}`

  try {
    const bundle = (await fhirClient.get(path)) as FHIRBundle
    const entries = bundle.entry ?? []
    const patients = entries
      .map((e) => e.resource)
      .filter((r): r is FHIRPatient => r?.resourceType === 'Patient')

    // Additional client-side filter for phone match
    // Handle variations in phone formatting
    const exactMatch = patients.find((p) =>
      p.telecom?.some((t) => {
        if (t.system !== 'phone' || !t.value) return false
        const storedPhone = t.value.replace(/[\s\-()]/g, '')
        // Match if phones are equal or one contains the other (handles country code variations)
        return (
          storedPhone === normalizedPhone ||
          storedPhone.endsWith(normalizedPhone.replace(/^\+\d{1,3}/, '')) ||
          normalizedPhone.endsWith(storedPhone.replace(/^\+\d{1,3}/, ''))
        )
      })
    )

    return exactMatch ?? null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404')) {
      return null
    }
    throw err
  }
}
