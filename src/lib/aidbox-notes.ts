import { fhirClient } from './fhir-client'

const NOTE_CATEGORY_SYSTEM = 'http://ignis.hackathon/note-types'
const NOTE_CATEGORY_CODE = 'patient-note'

/** FHIR Communication resource for patient notes. */
interface FHIRCommunication {
  resourceType: 'Communication'
  id?: string
  status: 'completed'
  subject?: { reference: string }
  payload?: Array<{ contentString: string }>
  sent?: string
  sender?: { display: string }
  category?: Array<{
    coding: Array<{ system: string; code: string }>
  }>
}

/** FHIR Bundle for Communication search. */
interface CommunicationBundle {
  resourceType: 'Bundle'
  entry?: Array<{ resource?: FHIRCommunication }>
}

/** Normalized note returned to the API consumer. */
export interface PatientNoteResult {
  id: string
  content: string
  author: string
  date: string
  time: string
  aiGenerated?: boolean
}

/** Convert a FHIR Communication to our API note format. */
function toNoteResult(comm: FHIRCommunication): PatientNoteResult {
  const sent = comm.sent ? new Date(comm.sent) : new Date()
  return {
    id: comm.id ?? '',
    content: comm.payload?.[0]?.contentString ?? '',
    author: comm.sender?.display ?? 'Arzt',
    date: sent.toLocaleDateString('de-DE'),
    time: sent.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  }
}

/**
 * Create a patient note as a FHIR Communication resource.
 */
export async function createNote(
  patientId: string,
  content: string,
  author?: string
): Promise<PatientNoteResult> {
  const now = new Date().toISOString()
  const communication: FHIRCommunication = {
    resourceType: 'Communication',
    status: 'completed',
    subject: { reference: `Patient/${patientId}` },
    payload: [{ contentString: content }],
    sent: now,
    sender: { display: author || 'Arzt' },
    category: [
      {
        coding: [{ system: NOTE_CATEGORY_SYSTEM, code: NOTE_CATEGORY_CODE }],
      },
    ],
  }

  const created = await fhirClient.post<FHIRCommunication>('Communication', communication)
  return toNoteResult(created)
}

/**
 * Get all notes for a patient, sorted by date (newest first).
 */
export async function getPatientNotes(patientId: string): Promise<PatientNoteResult[]> {
  const path = `Communication?subject=Patient/${patientId}&category=${NOTE_CATEGORY_SYSTEM}|${NOTE_CATEGORY_CODE}&_sort=-sent&_count=100`
  const bundle = await fhirClient.get<CommunicationBundle>(path)
  const entries = bundle.entry ?? []
  return entries
    .map((e) => e.resource)
    .filter((r): r is FHIRCommunication => r?.resourceType === 'Communication')
    .map(toNoteResult)
}

/**
 * Update an existing note (Communication resource).
 */
export async function updateNote(
  noteId: string,
  content: string
): Promise<PatientNoteResult> {
  // Read existing Communication first
  let existing: FHIRCommunication
  try {
    existing = await fhirClient.get<FHIRCommunication>(`Communication/${noteId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404') || message.includes('Not Found')) {
      throw new Error('Note not found')
    }
    throw err
  }

  if (existing.resourceType !== 'Communication') {
    throw new Error('Note not found')
  }

  const updated: FHIRCommunication = {
    ...existing,
    payload: [{ contentString: content }],
  }

  const result = await fhirClient.put<FHIRCommunication>(`Communication/${noteId}`, updated)
  return toNoteResult(result)
}
