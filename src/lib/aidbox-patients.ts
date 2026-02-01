import type { FHIRPatient } from './schemas'
import { fhirClient } from './fhir-client'

/** FHIR R4 Bundle (searchset) returned by GET /Patient?... */
interface FHIRBundle {
  resourceType: 'Bundle'
  type: 'searchset' | 'transaction-response'
  total?: number
  entry?: Array<{ resource?: FHIRPatient }>
}

/** Normalize phone for comparison (strip spaces/dashes). */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '')
}

/** Return true if patient's telecom (phone) matches the given normalized phone. */
function patientMatchesPhone(patient: FHIRPatient, normalizedPhone: string): boolean {
  const phones = patient.telecom
    ?.filter((t) => t.system === 'phone')
    .map((t) => normalizePhone(t.value)) ?? []
  return phones.some((p) => p.includes(normalizedPhone) || normalizedPhone.includes(p))
}

/** Return true if patient's name (family or given) partially matches the search string (case-insensitive). */
function patientMatchesName(patient: FHIRPatient, nameQuery: string): boolean {
  const q = nameQuery.trim().toLowerCase()
  if (!q) return true
  const names = patient.name ?? []
  for (const n of names) {
    const family = (n.family ?? '').toLowerCase()
    const given = (n.given ?? []).join(' ').toLowerCase()
    if (family.includes(q) || given.includes(q) || q.includes(family) || q.includes(given)) return true
  }
  return false
}

/**
 * Find a patient by name, phone and/or birthdate via Aidbox FHIR search.
 * Returns the patient if exactly one match; null otherwise.
 */
export async function findPatient(
  name?: string,
  phone?: string,
  birthDate?: string
): Promise<FHIRPatient | null> {
  const params = new URLSearchParams()
  if (birthDate) {
    params.set('birthdate', birthDate)
  } else if (phone) {
    const value = normalizePhone(phone)
    params.set('telecom', `phone|${value}`)
  } else if (name?.trim()) {
    params.set('name', name.trim())
  }
  if (params.size === 0) {
    return null
  }

  const path = `Patient?${params.toString()}`
  const bundle = (await fhirClient.get(path)) as FHIRBundle
  const entries = bundle.entry ?? []
  let patients = entries
    .map((e) => e.resource)
    .filter((r): r is FHIRPatient => r?.resourceType === 'Patient')

  if (name?.trim() && patients.length > 0) {
    patients = patients.filter((p) => patientMatchesName(p, name))
  }
  if (phone && patients.length > 0) {
    const normalized = normalizePhone(phone)
    patients = patients.filter((p) => patientMatchesPhone(p, normalized))
  }

  return patients.length === 1 ? patients[0]! : null
}

/** Minimal FHIR Appointment for upcoming-appointment response. */
interface FHIRAppointmentMin {
  resourceType: 'Appointment'
  id?: string
  start?: string
  description?: string
}

/** FHIR Bundle for Appointment search. */
interface AppointmentBundle {
  resourceType: 'Bundle'
  entry?: Array<{ resource?: FHIRAppointmentMin }>
}

/**
 * Get the next upcoming appointment for a patient (start >= today).
 * Returns null if none or on error.
 */
export async function getUpcomingAppointment(patientId: string): Promise<{
  appointmentId: string
  start: string
  reason?: string
} | null> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    // Use 'patient' search parameter (not 'participant') for Aidbox compatibility
    const path = `Appointment?patient=${patientId}&date=ge${today}&status=booked&_sort=date&_count=1`
    const bundle = (await fhirClient.get(path)) as AppointmentBundle
    const entry = bundle.entry?.[0]?.resource
    if (!entry?.id || !entry.start) return null
    return {
      appointmentId: entry.id,
      start: entry.start,
      reason: entry.description,
    }
  } catch {
    return null
  }
}

/**
 * Get all patients from Aidbox (FHIR search with no filters).
 */
export async function getAllPatients(): Promise<FHIRPatient[]> {
  const bundle = (await fhirClient.get('Patient?_count=100')) as FHIRBundle
  const entries = bundle.entry ?? []
  return entries
    .map((e) => e.resource)
    .filter((r): r is FHIRPatient => r?.resourceType === 'Patient')
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
 * Build a FHIR R4 Patient from API request data (create or update payload).
 */
function toFHIRPatient(data: {
  id?: string
  family: string
  given: string
  birthDate: string
  phone: string
  email?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  address?: {
    line?: string[]
    city?: string
    postalCode?: string
    country?: string
  }
}): FHIRPatient {
  const telecom: FHIRPatient['telecom'] = [
    { system: 'phone', value: data.phone, use: 'mobile' },
  ]
  if (data.email) {
    telecom.push({ system: 'email', value: data.email })
  }

  const patient: FHIRPatient = {
    resourceType: 'Patient',
    id: data.id ?? '',
    active: true,
    name: [{ use: 'official', family: data.family, given: [data.given] }],
    telecom,
    gender: data.gender,
    birthDate: data.birthDate,
  }
  if (data.address) {
    patient.address = [{ use: 'home', ...data.address }]
  }
  return patient
}

/**
 * Create or update a patient in Aidbox.
 * If data.id is set, updates existing patient (PUT); otherwise creates (POST).
 */
export async function createOrUpdatePatient(data: {
  id?: string
  family: string
  given: string
  birthDate: string
  phone: string
  email?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  address?: {
    line?: string[]
    city?: string
    postalCode?: string
    country?: string
  }
}): Promise<{ patient: FHIRPatient; created: boolean }> {
  if (data.id) {
    const existing = await getPatientById(data.id)
    if (!existing) {
      throw new Error('Patient not found')
    }
    const updated: FHIRPatient = {
      ...existing,
      ...toFHIRPatient(data),
      id: data.id,
    }
    const patient = (await fhirClient.put(`Patient/${data.id}`, updated)) as FHIRPatient
    return { patient, created: false }
  }

  const createPayload = toFHIRPatient(data)
  delete (createPayload as { id?: string }).id
  const patient = (await fhirClient.post('Patient', createPayload)) as FHIRPatient
  return {
    patient: { ...patient, id: patient.id ?? '' },
    created: true,
  }
}
