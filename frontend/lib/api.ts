/**
 * API client for connecting to the Hono backend
 * Uses relative paths - API calls go to /api/* which nginx routes to the backend
 */

const API_BASE = ''

// ============================================================================
// Types
// ============================================================================

export type QueueStatus = 'erwartet' | 'wartend' | 'aufgerufen' | 'in_behandlung' | 'fertig'
export type Priority = 'normal' | 'dringend' | 'notfall'

export interface QueueEntry {
  id: string
  patientId: string
  patientName: string
  appointmentId?: string
  status: QueueStatus
  priority: Priority
  arrivalTime?: string
  reason?: string
  room?: string
  doctor?: string
  createdAt: string
  updatedAt: string
}

export interface QueueResponse {
  queue: QueueEntry[]
}

export interface FHIRPatient {
  id?: string
  resourceType: 'Patient'
  name?: Array<{
    use?: string
    family?: string
    given?: string[]
  }>
  telecom?: Array<{
    system?: string
    value?: string
    use?: string
  }>
  birthDate?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  address?: Array<{
    use?: string
    line?: string[]
    city?: string
    postalCode?: string
    country?: string
  }>
}

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  start: string
  end: string
  status: string
  description?: string
  practitioner?: string
}

export interface QueueStats {
  total: number
  erwartet: number
  wartend: number
  aufgerufen: number
  inBehandlung: number
  dringend: number
  notfall: number
}

export interface Encounter {
  id: string
  date: string
  time: string
  practitioner: string
  reason: string
  diagnoses: string[]
  notes?: string
}

export interface Condition {
  id: string
  name: string
  icd10: string
  date: string
  status: 'active' | 'chronic' | 'resolved'
  aiSuggested?: boolean
}

export interface Medication {
  id: string
  name: string
  dosage: string
  frequency: string
  since: string
}

export interface Immunization {
  id: string
  name: string
  date: string
  nextDue?: string
}

export interface MedicalHistory {
  conditions: Condition[]
  medications: Medication[]
  immunizations: Immunization[]
  pastConditions: string[]
}

export interface PatientDocument {
  id: string
  name: string
  type: 'befund' | 'rezept' | 'überweisung' | 'arztbrief' | 'labor' | 'bildgebung'
  date: string
  practitioner: string
  size: string
}

export interface PatientNote {
  id: string
  content: string
  author: string
  date: string
  time: string
  aiGenerated?: boolean
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get the waiting queue
 */
export async function getQueue(): Promise<QueueResponse> {
  const res = await fetch(`${API_BASE}/api/queue`)
  if (!res.ok) {
    throw new Error(`Failed to fetch queue: ${res.status}`)
  }
  return res.json()
}

/**
 * Update a queue entry (status, priority, room, doctor)
 */
export async function updateQueueEntry(
  queueId: string,
  updates: { status?: QueueStatus; priority?: Priority; room?: string; doctor?: string }
): Promise<QueueEntry> {
  const res = await fetch(`${API_BASE}/api/queue/${queueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    throw new Error(`Failed to update queue entry: ${res.status}`)
  }
  const data = await res.json()
  return data.entry
}

/**
 * Remove entry from queue (mark as finished)
 */
export async function finishQueueEntry(queueId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/queue/${queueId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new Error(`Failed to finish queue entry: ${res.status}`)
  }
}

/**
 * Add a patient to the queue
 */
export async function addToQueue(entry: {
  patientId: string
  patientName: string
  appointmentId?: string
  status?: QueueStatus
  priority?: Priority
  reason?: string
  doctor?: string
}): Promise<QueueEntry> {
  const res = await fetch(`${API_BASE}/api/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) {
    throw new Error(`Failed to add to queue: ${res.status}`)
  }
  const data = await res.json()
  return data.entry
}

/**
 * Get all patients
 */
export async function getPatients(): Promise<FHIRPatient[]> {
  const res = await fetch(`${API_BASE}/api/patients`)
  if (!res.ok) {
    throw new Error(`Failed to fetch patients: ${res.status}`)
  }
  const data = await res.json()
  return data.patients
}

/**
 * Get today's appointments
 */
export async function getTodayAppointments(): Promise<Appointment[]> {
  const res = await fetch(`${API_BASE}/api/appointments/today`)
  if (!res.ok) {
    throw new Error(`Failed to fetch appointments: ${res.status}`)
  }
  const data = await res.json()
  return data.appointments
}

/**
 * Reschedule an appointment to a new time
 */
export async function rescheduleAppointment(
  appointmentId: string,
  start: string,
  end: string
): Promise<{ ok: boolean; appointmentId: string; start: string; end: string }> {
  const res = await fetch(`${API_BASE}/api/appointments/${appointmentId}/reschedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end }),
  })
  if (!res.ok) {
    throw new Error(`Failed to reschedule appointment: ${res.status}`)
  }
  return res.json()
}

/**
 * Subscribe to real-time appointment events via SSE
 * Returns an EventSource that emits 'message' events with appointment updates
 */
export function subscribeToAppointmentEvents(
  onEvent: (event: AppointmentSSEEvent) => void,
  onError?: (error: Event) => void
): EventSource {
  const eventSource = new EventSource(`${API_BASE}/api/appointments/events`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as AppointmentSSEEvent
      onEvent(data)
    } catch (err) {
      console.error('[SSE] Failed to parse event:', err)
    }
  }

  eventSource.onerror = (error) => {
    console.error('[SSE] Connection error:', error)
    onError?.(error)
  }

  return eventSource
}

export interface AppointmentSSEEvent {
  type: 'connected' | 'created' | 'updated' | 'rescheduled' | 'cancelled'
  appointmentId?: string
  timestamp?: string
  clients?: number
  data?: {
    start?: string
    end?: string
    status?: string
    patientId?: string
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
  const res = await fetch(`${API_BASE}/api/queue/stats`)
  if (!res.ok) {
    throw new Error(`Failed to fetch queue stats: ${res.status}`)
  }
  return res.json()
}

/**
 * Get patient encounters (visit history)
 */
export async function getPatientEncounters(patientId: string): Promise<Encounter[]> {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/encounters`)
  if (!res.ok) {
    throw new Error(`Failed to fetch patient encounters: ${res.status}`)
  }
  const data = await res.json()
  return data.encounters
}

/**
 * Get patient medical history (conditions, medications, immunizations)
 */
export async function getPatientMedicalHistory(patientId: string): Promise<MedicalHistory> {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/conditions`)
  if (!res.ok) {
    throw new Error(`Failed to fetch patient medical history: ${res.status}`)
  }
  return res.json()
}

/**
 * Get patient documents
 */
export async function getPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/documents`)
  if (!res.ok) {
    throw new Error(`Failed to fetch patient documents: ${res.status}`)
  }
  const data = await res.json()
  return data.documents
}

/**
 * Get patient notes
 */
export async function getPatientNotes(patientId: string): Promise<PatientNote[]> {
  const res = await fetch(`${API_BASE}/api/patients/${patientId}/notes`)
  if (!res.ok) {
    throw new Error(`Failed to fetch patient notes: ${res.status}`)
  }
  const data = await res.json()
  return data.notes
}

// ============================================================================
// Questionnaire Types (FHIR R4)
// ============================================================================

export interface FHIRQuestionnaire {
  resourceType: 'Questionnaire'
  id?: string
  url?: string
  version?: string
  name?: string
  title?: string
  status: 'draft' | 'active' | 'retired' | 'unknown'
  subjectType?: string[]
  date?: string
  publisher?: string
  description?: string
  purpose?: string
  item?: FHIRQuestionnaireItem[]
}

export interface FHIRQuestionnaireItem {
  linkId: string
  text?: string
  type: 'group' | 'display' | 'boolean' | 'decimal' | 'integer' | 'date' | 'dateTime' | 'time' | 'string' | 'text' | 'url' | 'choice' | 'open-choice' | 'attachment' | 'reference' | 'quantity'
  required?: boolean
  repeats?: boolean
  enableWhen?: FHIREnableWhen[]
  enableBehavior?: 'all' | 'any'
  answerOption?: FHIRAnswerOption[]
  item?: FHIRQuestionnaireItem[]
  extension?: FHIRExtension[]
}

export interface FHIREnableWhen {
  question: string
  operator: 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<='
  answerBoolean?: boolean
  answerCoding?: { code: string; display?: string }
  answerString?: string
  answerInteger?: number
}

export interface FHIRAnswerOption {
  valueCoding?: { code: string; display?: string; system?: string }
  valueString?: string
  valueInteger?: number
}

export interface FHIRExtension {
  url: string
  valueCodeableConcept?: { coding: Array<{ code: string; display?: string }> }
  valueInteger?: number
  valueString?: string
}

// ============================================================================
// Questionnaire API Functions
// ============================================================================

/**
 * Get all active questionnaires
 */
export async function getQuestionnaires(): Promise<FHIRQuestionnaire[]> {
  const res = await fetch(`${API_BASE}/api/questionnaires`)
  if (!res.ok) {
    throw new Error(`Failed to fetch questionnaires: ${res.status}`)
  }
  return res.json()
}

/**
 * Get questionnaire by ID
 */
export async function getQuestionnaireById(id: string): Promise<FHIRQuestionnaire> {
  const res = await fetch(`${API_BASE}/api/questionnaires/${id}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch questionnaire: ${res.status}`)
  }
  return res.json()
}

/**
 * Get the patient intake questionnaire
 */
export async function getPatientIntakeQuestionnaire(): Promise<FHIRQuestionnaire> {
  const res = await fetch(`${API_BASE}/api/questionnaires/patient-intake`)
  if (!res.ok) {
    throw new Error(`Failed to fetch patient intake questionnaire: ${res.status}`)
  }
  return res.json()
}
