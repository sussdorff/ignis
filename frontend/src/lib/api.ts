/**
 * API Client for Ignis Backend
 * Handles all HTTP requests to /api endpoints
 * Transforms FHIR R4 resources to frontend-friendly formats
 */

const API_BASE = '/api'

// =============================================================================
// FHIR R4 Types (from backend)
// =============================================================================

export interface FHIRHumanName {
  use?: 'official' | 'usual' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden'
  family?: string
  given?: string[]
  prefix?: string[]
}

export interface FHIRContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other'
  value: string
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile'
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing'
  line?: string[]
  city?: string
  postalCode?: string
  country?: string
  state?: string
}

export interface FHIRMeta {
  lastUpdated?: string
  versionId?: string
  extension?: Array<{
    url: string
    valueInstant?: string
  }>
}

export interface FHIRPatient {
  resourceType: 'Patient'
  id: string
  identifier?: Array<{ system?: string; value: string }>
  active?: boolean
  name?: FHIRHumanName[]
  telecom?: FHIRContactPoint[]
  gender?: 'male' | 'female' | 'other' | 'unknown'
  birthDate?: string
  address?: FHIRAddress[]
  meta?: FHIRMeta
}

// =============================================================================
// Frontend Patient Type (transformed from FHIR)
// =============================================================================

export interface Patient {
  id: string
  firstName: string
  lastName: string
  phone: string
  birthDate: string
  email?: string
  address?: string
  insuranceNumber?: string
  isReturning?: boolean
  urgency?: 'emergency' | 'urgent' | 'regular'
  flags?: string[]
  createdAt?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
}

// =============================================================================
// FHIR to Frontend Transformers
// =============================================================================

/**
 * Transform a FHIR R4 Patient resource to frontend Patient format
 */
function fhirPatientToPatient(fhir: FHIRPatient): Patient {
  // Extract name
  const name = fhir.name?.[0]
  const firstName = name?.given?.join(' ') ?? ''
  const lastName = name?.family ?? ''

  // Extract phone
  const phoneContact = fhir.telecom?.find(t => t.system === 'phone')
  const phone = phoneContact?.value ?? ''

  // Extract email
  const emailContact = fhir.telecom?.find(t => t.system === 'email')
  const email = emailContact?.value

  // Extract address as a string
  const addr = fhir.address?.[0]
  let address: string | undefined
  if (addr) {
    const parts = [
      addr.line?.join(', '),
      addr.postalCode,
      addr.city,
      addr.country,
    ].filter(Boolean)
    address = parts.join(', ')
  }

  // Extract insurance number from identifier
  const insuranceId = fhir.identifier?.find(id =>
    id.system?.includes('insurance') || id.system?.includes('krankenkasse')
  )
  const insuranceNumber = insuranceId?.value

  // Extract createdAt from meta extension
  const createdAtExt = fhir.meta?.extension?.find(e => e.url === 'ex:createdAt')
  const createdAt = createdAtExt?.valueInstant ?? fhir.meta?.lastUpdated

  return {
    id: fhir.id,
    firstName,
    lastName,
    phone,
    birthDate: fhir.birthDate ?? '',
    email,
    address,
    insuranceNumber,
    isReturning: true, // All patients from the system are existing patients
    createdAt,
    gender: fhir.gender,
  }
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch all patients (transforms FHIR to frontend format)
 */
export async function getPatients(): Promise<Patient[]> {
  const response = await fetch(`${API_BASE}/patients`)
  if (!response.ok) throw new Error('Failed to fetch patients')
  const fhirPatients: FHIRPatient[] = await response.json()
  return fhirPatients.map(fhirPatientToPatient)
}

/**
 * Get patient by ID
 */
export async function getPatient(id: string): Promise<Patient | null> {
  const response = await fetch(`${API_BASE}/patients/${id}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Failed to fetch patient')
  const fhirPatient: FHIRPatient = await response.json()
  return fhirPatientToPatient(fhirPatient)
}

/**
 * Lookup patient by phone and birthdate
 */
export async function lookupPatient(phone: string, birthDate: string): Promise<{
  patient: Patient | null
  found: boolean
  patientId?: string
  patientName?: string
  upcomingAppointment?: {
    appointmentId: string
    start: string
    reason?: string
  } | null
}> {
  const params = new URLSearchParams()
  if (phone) params.set('phone', phone)
  if (birthDate) params.set('birthDate', birthDate)

  const response = await fetch(`${API_BASE}/patients/lookup?${params.toString()}`)
  if (!response.ok) throw new Error('Failed to lookup patient')

  const data = await response.json()
  return {
    patient: data.patient ? fhirPatientToPatient(data.patient) : null,
    found: data.found,
    patientId: data.patientId,
    patientName: data.patientName,
    upcomingAppointment: data.upcomingAppointment,
  }
}

/**
 * Create or update patient
 */
export async function createPatient(patient: {
  firstName: string
  lastName: string
  phone: string
  birthDate: string
  email?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  address?: {
    line?: string[]
    city?: string
    postalCode?: string
    country?: string
  }
}): Promise<{ patient: Patient; created: boolean }> {
  const response = await fetch(`${API_BASE}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      given: patient.firstName,
      family: patient.lastName,
      phone: patient.phone,
      birthDate: patient.birthDate,
      email: patient.email,
      gender: patient.gender,
      address: patient.address,
    }),
  })
  if (!response.ok) throw new Error('Failed to create patient')
  const data = await response.json()
  return {
    patient: fhirPatientToPatient(data.patient),
    created: data.created,
  }
}

// =============================================================================
// Appointment Types and Functions
// =============================================================================

export interface Slot {
  slotId: string
  start: string
  end: string
  practitionerId?: string
  practitionerDisplay?: string
}

export interface Appointment {
  id: string
  patientId: string
  practitionerId: string
  start: string
  end: string
  status: 'booked' | 'arrived' | 'in-progress' | 'completed' | 'cancelled'
  type?: string
  reason?: string
}

/**
 * Get available appointment slots for a date
 */
export async function getAvailableSlots(
  date: string,
  urgency: 'routine' | 'urgent' = 'routine',
  limit: number = 10
): Promise<Slot[]> {
  const params = new URLSearchParams({
    date,
    urgency,
    limit: String(limit),
  })
  const response = await fetch(`${API_BASE}/appointments/slots?${params.toString()}`)
  if (!response.ok) throw new Error('Failed to fetch slots')
  const data = await response.json()
  return data.slots
}

/**
 * Book an appointment
 */
export async function bookAppointment(
  slotId: string,
  patientId: string,
  type?: 'routine' | 'urgent',
  reason?: string
): Promise<{
  appointment: Record<string, unknown>
  start: string
  end: string
  confirmationMessage?: string
}> {
  const response = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotId, patientId, type, reason }),
  })
  if (!response.ok) throw new Error('Failed to book appointment')
  return response.json()
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(appointmentId: string): Promise<{
  cancelled: boolean
  appointmentId?: string
  message?: string
}> {
  const response = await fetch(`${API_BASE}/appointments/cancel/${appointmentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (response.status === 404) {
    return { cancelled: false, message: 'Appointment not found' }
  }
  if (!response.ok) throw new Error('Failed to cancel appointment')
  return response.json()
}

// =============================================================================
// Queue Functions
// =============================================================================

/**
 * Add patient to urgent queue
 */
export async function addToUrgentQueue(
  patientId: string,
  reason?: string,
  phone?: string
): Promise<{
  queueEntryId: string
  position?: number
  message?: string
}> {
  const response = await fetch(`${API_BASE}/queue/urgent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId, reason, phone }),
  })
  if (!response.ok) throw new Error('Failed to add to urgent queue')
  return response.json()
}

/**
 * Register emergency
 */
export async function registerEmergency(
  patientId?: string,
  phone?: string,
  reason?: string
): Promise<{
  transferId: string
  message?: string
}> {
  const response = await fetch(`${API_BASE}/queue/emergency`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId, phone, reason }),
  })
  if (!response.ok) throw new Error('Failed to register emergency')
  return response.json()
}

// =============================================================================
// Questionnaire Types and Functions
// =============================================================================

export interface FHIRQuestionnaireItem {
  linkId: string
  text: string
  type: 'group' | 'display' | 'boolean' | 'decimal' | 'integer' | 'date' | 'dateTime' | 'time' | 'string' | 'text' | 'url' | 'choice' | 'open-choice' | 'attachment' | 'reference' | 'quantity'
  required?: boolean
  repeats?: boolean
  answerOption?: Array<{
    valueCoding?: { code: string; display: string }
    valueString?: string
    valueInteger?: number
  }>
  item?: FHIRQuestionnaireItem[]
}

export interface FHIRQuestionnaire {
  resourceType: 'Questionnaire'
  id: string
  name?: string
  title?: string
  status: 'draft' | 'active' | 'retired' | 'unknown'
  description?: string
  item?: FHIRQuestionnaireItem[]
}

/**
 * Get all active questionnaires
 */
export async function getQuestionnaires(): Promise<FHIRQuestionnaire[]> {
  const response = await fetch(`${API_BASE}/questionnaires`)
  if (!response.ok) throw new Error('Failed to fetch questionnaires')
  return response.json()
}

/**
 * Get the patient intake questionnaire
 */
export async function getPatientIntakeQuestionnaire(): Promise<FHIRQuestionnaire | null> {
  const response = await fetch(`${API_BASE}/questionnaires/patient-intake`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Failed to fetch patient intake questionnaire')
  return response.json()
}

/**
 * Get questionnaire by ID
 */
export async function getQuestionnaireById(id: string): Promise<FHIRQuestionnaire | null> {
  const response = await fetch(`${API_BASE}/questionnaires/${id}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Failed to fetch questionnaire')
  return response.json()
}

// =============================================================================
// Callback Functions
// =============================================================================

/**
 * Request callback
 */
export async function requestCallback(data: {
  phone: string
  reason: string
  category: 'prescription' | 'billing' | 'test_results' | 'insurance' | 'technical_issue' | 'general'
  patientId?: string
  patientName?: string
}): Promise<{
  callbackId: string
  estimatedTime?: string
  message?: string
}> {
  const response = await fetch(`${API_BASE}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error('Failed to request callback')
  return response.json()
}

// =============================================================================
// Helper Functions (keep backward compatibility)
// =============================================================================

/**
 * Get urgent queue (patients with urgency=urgent or emergency)
 * Note: This currently returns all patients since urgency is not stored in FHIR
 * In a real system, urgency would be tracked in a separate Queue resource
 */
export async function getUrgentQueue(): Promise<Patient[]> {
  const patients = await getPatients()
  return patients.filter(p => p.urgency === 'urgent' || p.urgency === 'emergency')
}

/**
 * Get emergency alerts (patients with urgency=emergency)
 * Note: This currently returns all patients since urgency is not stored in FHIR
 * In a real system, emergencies would be tracked in a separate resource
 */
export async function getEmergencyAlerts(): Promise<Patient[]> {
  const patients = await getPatients()
  return patients.filter(p => p.urgency === 'emergency')
}

// =============================================================================
// Doctor dashboard: prescription requests
// =============================================================================

export interface PrescriptionRequestPatientSummary {
  id: string
  name: string
  birthDate?: string
}

export interface PrescriptionRequest {
  id: string
  status: string
  intent: string
  patientId: string | null
  patient: PrescriptionRequestPatientSummary | null
  authoredOn: string | undefined
  medicationText: string | undefined
  note: string | undefined
}

export interface PrescriptionRequestsResponse {
  requests: PrescriptionRequest[]
}

/**
 * Fetch pending prescription requests for the doctor dashboard
 */
export async function getPrescriptionRequests(): Promise<PrescriptionRequest[]> {
  const response = await fetch(`${API_BASE}/doctor/prescription-requests`)
  if (!response.ok) throw new Error('Failed to fetch prescription requests')
  const data: PrescriptionRequestsResponse = await response.json()
  return data.requests
}

/**
 * Approve or deny a prescription request
 */
export async function actionPrescriptionRequest(
  id: string,
  action: 'approve' | 'deny',
  note?: string
): Promise<{ id: string; action: string; status: string; message: string }> {
  const response = await fetch(`${API_BASE}/doctor/prescription-requests/${id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, note }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Failed to update prescription request')
  }
  return response.json()
}
