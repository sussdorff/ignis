import { fhirClient } from './fhir-client'

/** Minimal FHIR Appointment for read/update/create. */
export interface FHIRAppointment {
  resourceType: 'Appointment'
  id?: string
  status?: string
  start?: string
  end?: string
  participant?: Array<{ actor?: { reference?: string; display?: string }; status?: string }>
  description?: string
  appointmentType?: { coding?: Array<{ system?: string; code?: string; display?: string }> }
  [key: string]: unknown
}

/** FHIR Bundle (searchset) from GET /Appointment?date=... */
interface AppointmentBundle {
  resourceType: 'Bundle'
  entry?: Array<{ resource?: FHIRAppointment }>
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart
}

export type CancelResult =
  | { ok: true; appointmentId: string }
  | { ok: false; code: 'not_found' }
  | { ok: false; code: 'conflict'; reason: 'already_cancelled' | 'in_the_past' }

/**
 * Get an appointment by ID from Aidbox.
 * Returns null if not found (404).
 */
export async function getAppointmentById(id: string): Promise<FHIRAppointment | null> {
  try {
    const appt = (await fhirClient.get(`Appointment/${id}`)) as FHIRAppointment
    return appt?.resourceType === 'Appointment' ? appt : null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404') || message.includes('Not Found')) return null
    throw err
  }
}

/**
 * Cancel an appointment in Aidbox (set status to cancelled).
 * Returns result: ok, not_found, or conflict (already_cancelled / in_the_past).
 */
export async function cancelAppointment(appointmentId: string): Promise<CancelResult> {
  const appt = await getAppointmentById(appointmentId)
  if (!appt) return { ok: false, code: 'not_found' }

  const status = appt.status ?? ''
  if (status === 'cancelled') return { ok: false, code: 'conflict', reason: 'already_cancelled' }

  const start = appt.start
  if (start && new Date(start) < new Date()) return { ok: false, code: 'conflict', reason: 'in_the_past' }

  const updated: FHIRAppointment = { ...appt, status: 'cancelled' }
  await fhirClient.put(`Appointment/${appointmentId}`, updated)
  return { ok: true, appointmentId }
}

/**
 * Find appointments in a time range (for conflict check).
 * Uses FHIR search by date (day of start), then filters for overlap and non-cancelled.
 */
export async function getAppointmentsInRange(start: string, end: string): Promise<FHIRAppointment[]> {
  const date = start.slice(0, 10) // YYYY-MM-DD
  const bundle = (await fhirClient.get(`Appointment?date=${date}&_count=100`)) as AppointmentBundle
  const list: FHIRAppointment[] = []
  for (const e of bundle.entry ?? []) {
    const r = e.resource
    if (r?.resourceType !== 'Appointment' || r.status === 'cancelled') continue
    const rStart = r.start ?? ''
    const rEnd = r.end ?? ''
    if (rStart && rEnd && overlaps(start, end, rStart, rEnd)) list.push(r)
  }
  return list
}

export type CreateAppointmentResult =
  | { ok: true; appointment: FHIRAppointment }
  | { ok: false; code: 'slot_unavailable' }

/**
 * Create an Appointment in Aidbox for the given slot and patient.
 * Returns slot_unavailable if an appointment already exists in that time range.
 */
export async function createAppointment(params: {
  start: string
  end: string
  patientId: string
  practitionerId: string
  practitionerDisplay?: string
  type?: 'routine' | 'urgent'
  reason?: string
}): Promise<CreateAppointmentResult> {
  const existing = await getAppointmentsInRange(params.start, params.end)
  if (existing.length > 0) return { ok: false, code: 'slot_unavailable' }

  const appointmentTypeCode = params.type === 'urgent' ? 'URGENT' : 'ROUTINE'
  const body: FHIRAppointment = {
    resourceType: 'Appointment',
    status: 'booked',
    start: params.start,
    end: params.end,
    description: params.reason ?? undefined,
    appointmentType: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
          code: appointmentTypeCode,
          display: params.type === 'urgent' ? 'Urgent appointment' : 'Routine appointment',
        },
      ],
    },
    participant: [
      { actor: { reference: `Patient/${params.patientId}` }, status: 'accepted' },
      {
        actor: {
          reference: `Practitioner/${params.practitionerId}`,
          display: params.practitionerDisplay,
        },
        status: 'accepted',
      },
    ],
  }
  const created = (await fhirClient.post('Appointment', body)) as FHIRAppointment
  return { ok: true, appointment: created }
}
