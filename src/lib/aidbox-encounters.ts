/**
 * Aidbox Encounter-based queue management.
 *
 * Maps queue statuses to FHIR Encounter statuses:
 * - erwartet (expected) → planned
 * - wartend (waiting) → arrived
 * - aufgerufen (called) → arrived (with location extension)
 * - in_behandlung (in treatment) → in-progress
 * - fertig (finished) → finished
 *
 * Priority is stored as Encounter.priority coding:
 * - normal → R (routine)
 * - dringend → U (urgent)
 * - notfall → EM (emergency)
 */

import { fhirClient } from './fhir-client'
import { broadcastQueueEvent } from './sse-broadcaster'

// Queue status types (German workflow)
export type QueueStatus = 'erwartet' | 'wartend' | 'aufgerufen' | 'in_behandlung' | 'fertig'
export type Priority = 'normal' | 'dringend' | 'notfall'

// FHIR Encounter status mapping
const statusToFhir: Record<QueueStatus, string> = {
  erwartet: 'planned',
  wartend: 'arrived',
  aufgerufen: 'arrived', // distinguished by extension
  in_behandlung: 'in-progress',
  fertig: 'finished',
}

const fhirToStatus: Record<string, QueueStatus> = {
  planned: 'erwartet',
  arrived: 'wartend',
  'in-progress': 'in_behandlung',
  finished: 'fertig',
}

// FHIR priority coding
const priorityToFhir: Record<Priority, { code: string; display: string }> = {
  normal: { code: 'R', display: 'routine' },
  dringend: { code: 'U', display: 'urgent' },
  notfall: { code: 'EM', display: 'emergency' },
}

const fhirToPriority: Record<string, Priority> = {
  R: 'normal',
  U: 'dringend',
  EM: 'notfall',
}

/** Minimal FHIR Encounter structure */
interface FHIREncounter {
  resourceType: 'Encounter'
  id?: string
  status: string
  class: {
    system: string
    code: string
    display?: string
  }
  priority?: {
    coding?: Array<{
      system?: string
      code?: string
      display?: string
    }>
  }
  subject?: {
    reference?: string
    display?: string
  }
  participant?: Array<{
    individual?: {
      reference?: string
      display?: string
    }
  }>
  appointment?: Array<{
    reference?: string
  }>
  reasonCode?: Array<{
    text?: string
  }>
  location?: Array<{
    location?: {
      display?: string
    }
    status?: string
  }>
  period?: {
    start?: string
    end?: string
  }
  extension?: Array<{
    url: string
    valueString?: string
    valueDateTime?: string
    valueCode?: string
  }>
  meta?: {
    lastUpdated?: string
  }
  [key: string]: unknown
}

interface EncounterBundle {
  resourceType: 'Bundle'
  total?: number
  entry?: Array<{ resource?: FHIREncounter }>
}

/** Queue entry returned by API */
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

/** Get today's date in Berlin timezone */
function todayBerlin(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

/** Extract patient ID from reference */
function extractPatientId(reference?: string): string | null {
  if (!reference) return null
  const match = reference.match(/^Patient\/(.+)$/)
  return match ? match[1] : null
}

/** Extract appointment ID from reference */
function extractAppointmentId(reference?: string): string | null {
  if (!reference) return null
  const match = reference.match(/^Appointment\/(.+)$/)
  return match ? match[1] : null
}

/** Convert FHIR Encounter to QueueEntry */
function encounterToQueueEntry(enc: FHIREncounter): QueueEntry {
  const patientId = extractPatientId(enc.subject?.reference) ?? ''
  const patientName = enc.subject?.display ?? 'Unbekannt'

  // Get appointment ID if linked
  const appointmentId = enc.appointment?.[0]?.reference
    ? extractAppointmentId(enc.appointment[0].reference) ?? undefined
    : undefined

  // Map FHIR status to queue status
  let status = fhirToStatus[enc.status] ?? 'erwartet'

  // Check for 'aufgerufen' extension (called but not yet in treatment)
  const calledExt = enc.extension?.find(e => e.url === 'http://ignis.hackathon/encounter-called')
  if (calledExt && enc.status === 'arrived') {
    status = 'aufgerufen'
  }

  // Get priority
  const priorityCode = enc.priority?.coding?.[0]?.code ?? 'R'
  const priority = fhirToPriority[priorityCode] ?? 'normal'

  // Get reason
  const reason = enc.reasonCode?.[0]?.text

  // Get room from location
  const room = enc.location?.[0]?.location?.display

  // Get doctor from participant
  const doctor = enc.participant?.find(p =>
    p.individual?.reference?.startsWith('Practitioner/')
  )?.individual?.display

  // Get arrival time from extension or period start
  const arrivalExt = enc.extension?.find(e => e.url === 'http://ignis.hackathon/arrival-time')
  const arrivalTime = arrivalExt?.valueDateTime ?? enc.period?.start

  // Get created/updated times
  const createdExt = enc.extension?.find(e => e.url === 'http://ignis.hackathon/created-at')
  const createdAt = createdExt?.valueDateTime ?? enc.period?.start ?? new Date().toISOString()
  const updatedAt = enc.meta?.lastUpdated ?? createdAt

  return {
    id: enc.id ?? '',
    patientId,
    patientName,
    appointmentId,
    status,
    priority,
    arrivalTime,
    reason,
    room,
    doctor,
    createdAt,
    updatedAt,
  }
}

/** Build FHIR Encounter from queue entry data */
function buildEncounter(data: {
  id?: string
  patientId: string
  patientName: string
  appointmentId?: string
  status: QueueStatus
  priority: Priority
  reason?: string
  room?: string
  doctor?: string
  arrivalTime?: string
  createdAt?: string
}): FHIREncounter {
  const now = new Date().toISOString()

  const encounter: FHIREncounter = {
    resourceType: 'Encounter',
    status: statusToFhir[data.status],
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    priority: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
        code: priorityToFhir[data.priority].code,
        display: priorityToFhir[data.priority].display,
      }],
    },
    subject: {
      reference: `Patient/${data.patientId}`,
      display: data.patientName,
    },
    period: {
      start: data.arrivalTime ?? now,
    },
    extension: [
      {
        url: 'http://ignis.hackathon/created-at',
        valueDateTime: data.createdAt ?? now,
      },
    ],
  }

  if (data.id) {
    encounter.id = data.id
  }

  if (data.appointmentId) {
    encounter.appointment = [{ reference: `Appointment/${data.appointmentId}` }]
  }

  if (data.reason) {
    encounter.reasonCode = [{ text: data.reason }]
  }

  if (data.room) {
    encounter.location = [{
      location: { display: data.room },
      status: 'active',
    }]
  }

  if (data.doctor) {
    encounter.participant = [{
      individual: {
        reference: 'Practitioner/practitioner-1',
        display: data.doctor,
      },
    }]
  }

  // Add 'aufgerufen' extension if status is aufgerufen
  if (data.status === 'aufgerufen') {
    encounter.extension!.push({
      url: 'http://ignis.hackathon/encounter-called',
      valueDateTime: now,
    })
  }

  // Add arrival time extension if status is wartend or later
  if (data.status !== 'erwartet' && data.arrivalTime) {
    encounter.extension!.push({
      url: 'http://ignis.hackathon/arrival-time',
      valueDateTime: data.arrivalTime,
    })
  }

  return encounter
}

/**
 * Get all queue entries for today (non-finished Encounters).
 */
export async function getTodayQueue(): Promise<QueueEntry[]> {
  const today = todayBerlin()
  // Query for encounters created today that are not finished
  const path = `Encounter?date=${today}&status:not=finished&_count=100&_sort=-_lastUpdated`

  try {
    const bundle = await fhirClient.get<EncounterBundle>(path)
    const entries = bundle.entry ?? []

    const queueEntries = entries
      .map(e => e.resource)
      .filter((r): r is FHIREncounter => r?.resourceType === 'Encounter')
      .map(encounterToQueueEntry)

    // Sort by priority (notfall > dringend > normal) then by creation time
    const priorityOrder = { notfall: 0, dringend: 1, normal: 2 }
    return queueEntries.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  } catch (err) {
    console.error('[Queue] Error fetching today queue:', err)
    return []
  }
}

/**
 * Get waiting room patients (status = wartend).
 */
export async function getWaitingPatients(): Promise<QueueEntry[]> {
  const queue = await getTodayQueue()
  return queue.filter(e => e.status === 'wartend')
}

/**
 * Get urgent patients (priority = dringend or notfall).
 */
export async function getUrgentPatients(): Promise<QueueEntry[]> {
  const queue = await getTodayQueue()
  return queue.filter(e => e.priority === 'dringend' || e.priority === 'notfall')
}

/**
 * Get queue statistics for today.
 */
export async function getQueueStats(): Promise<{
  total: number
  erwartet: number
  wartend: number
  aufgerufen: number
  inBehandlung: number
  dringend: number
  notfall: number
}> {
  const queue = await getTodayQueue()
  return {
    total: queue.length,
    erwartet: queue.filter(e => e.status === 'erwartet').length,
    wartend: queue.filter(e => e.status === 'wartend').length,
    aufgerufen: queue.filter(e => e.status === 'aufgerufen').length,
    inBehandlung: queue.filter(e => e.status === 'in_behandlung').length,
    dringend: queue.filter(e => e.priority === 'dringend').length,
    notfall: queue.filter(e => e.priority === 'notfall').length,
  }
}

/**
 * Add a patient to the queue by creating an Encounter.
 */
export async function addToQueue(data: {
  patientId: string
  patientName: string
  appointmentId?: string
  status?: QueueStatus
  priority?: Priority
  reason?: string
  doctor?: string
}): Promise<QueueEntry> {
  const now = new Date().toISOString()
  const status = data.status ?? 'erwartet'
  const priority = data.priority ?? 'normal'

  const encounter = buildEncounter({
    patientId: data.patientId,
    patientName: data.patientName,
    appointmentId: data.appointmentId,
    status,
    priority,
    reason: data.reason,
    doctor: data.doctor,
    arrivalTime: status === 'wartend' ? now : undefined,
    createdAt: now,
  })

  const result = await fhirClient.post<FHIREncounter>('Encounter', encounter)
  const entry = encounterToQueueEntry(result)

  // Broadcast SSE event
  broadcastQueueEvent({
    type: 'added',
    queueEntryId: entry.id,
    timestamp: now,
    data: { patientId: entry.patientId, patientName: entry.patientName, status, priority },
  })

  return entry
}

/**
 * Add a patient to the queue with a specific ID (for seeding).
 */
export async function addToQueueWithId(data: {
  id: string
  patientId: string
  patientName: string
  appointmentId?: string
  status?: QueueStatus
  priority?: Priority
  reason?: string
  doctor?: string
}): Promise<QueueEntry> {
  const now = new Date().toISOString()
  const status = data.status ?? 'erwartet'
  const priority = data.priority ?? 'normal'

  const encounter = buildEncounter({
    id: data.id,
    patientId: data.patientId,
    patientName: data.patientName,
    appointmentId: data.appointmentId,
    status,
    priority,
    reason: data.reason,
    doctor: data.doctor,
    arrivalTime: status === 'wartend' ? now : undefined,
    createdAt: now,
  })

  const result = await fhirClient.put<FHIREncounter>(`Encounter/${data.id}`, encounter)
  return encounterToQueueEntry(result)
}

/**
 * Get a queue entry by ID.
 */
export async function getQueueEntry(encounterId: string): Promise<QueueEntry | null> {
  try {
    const enc = await fhirClient.get<FHIREncounter>(`Encounter/${encounterId}`)
    if (enc?.resourceType !== 'Encounter') return null
    return encounterToQueueEntry(enc)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404') || message.includes('Not Found')) return null
    throw err
  }
}

/**
 * Get queue entry by patient ID (active encounter for today).
 */
export async function getQueueEntryByPatient(patientId: string): Promise<QueueEntry | null> {
  const today = todayBerlin()
  const path = `Encounter?subject=Patient/${patientId}&date=${today}&status:not=finished&_count=1`

  try {
    const bundle = await fhirClient.get<EncounterBundle>(path)
    const enc = bundle.entry?.[0]?.resource
    if (!enc || enc.resourceType !== 'Encounter') return null
    return encounterToQueueEntry(enc)
  } catch {
    return null
  }
}

/**
 * Update a queue entry's status/priority/room/doctor.
 */
export async function updateQueueStatus(
  encounterId: string,
  updates: Partial<Pick<QueueEntry, 'status' | 'priority' | 'room' | 'doctor'>>
): Promise<QueueEntry | null> {
  try {
    const enc = await fhirClient.get<FHIREncounter>(`Encounter/${encounterId}`)
    if (!enc || enc.resourceType !== 'Encounter') return null

    const now = new Date().toISOString()

    // Update status
    if (updates.status) {
      enc.status = statusToFhir[updates.status]

      // Handle 'aufgerufen' extension
      enc.extension = enc.extension?.filter(e => e.url !== 'http://ignis.hackathon/encounter-called') ?? []
      if (updates.status === 'aufgerufen') {
        enc.extension.push({
          url: 'http://ignis.hackathon/encounter-called',
          valueDateTime: now,
        })
      }

      // Set arrival time when status changes to wartend
      if (updates.status === 'wartend') {
        const hasArrivalTime = enc.extension?.some(e => e.url === 'http://ignis.hackathon/arrival-time')
        if (!hasArrivalTime) {
          enc.extension = enc.extension ?? []
          enc.extension.push({
            url: 'http://ignis.hackathon/arrival-time',
            valueDateTime: now,
          })
        }
      }

      // Set end time when finished
      if (updates.status === 'fertig') {
        enc.period = enc.period ?? {}
        enc.period.end = now
      }
    }

    // Update priority
    if (updates.priority) {
      enc.priority = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
          code: priorityToFhir[updates.priority].code,
          display: priorityToFhir[updates.priority].display,
        }],
      }
    }

    // Update room
    if (updates.room !== undefined) {
      enc.location = [{
        location: { display: updates.room },
        status: 'active',
      }]
    }

    // Update doctor
    if (updates.doctor !== undefined) {
      enc.participant = [{
        individual: {
          reference: 'Practitioner/practitioner-1',
          display: updates.doctor,
        },
      }]
    }

    const result = await fhirClient.put<FHIREncounter>(`Encounter/${encounterId}`, enc)
    const entry = encounterToQueueEntry(result)

    // Broadcast SSE event
    broadcastQueueEvent({
      type: 'updated',
      queueEntryId: encounterId,
      timestamp: now,
      data: updates,
    })

    return entry
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404') || message.includes('Not Found')) return null
    throw err
  }
}

/**
 * Mark a queue entry as finished.
 */
export async function finishQueueEntry(encounterId: string): Promise<boolean> {
  const result = await updateQueueStatus(encounterId, { status: 'fertig' })
  return result !== null
}

/**
 * Delete all encounters for today (for cleanup/reset).
 */
export async function clearTodayEncounters(): Promise<number> {
  const today = todayBerlin()
  const path = `Encounter?date=${today}&_count=100`

  try {
    const bundle = await fhirClient.get<EncounterBundle>(path)
    const entries = bundle.entry ?? []
    let deleted = 0

    for (const entry of entries) {
      const id = entry.resource?.id
      if (id) {
        try {
          // Set status to finished (FHIR doesn't allow deleting encounters in some systems)
          await fhirClient.put(`Encounter/${id}`, {
            ...entry.resource,
            status: 'finished',
            period: {
              ...entry.resource?.period,
              end: new Date().toISOString(),
            },
          })
          deleted++
        } catch {
          // Ignore errors during cleanup
        }
      }
    }

    return deleted
  } catch {
    return 0
  }
}
