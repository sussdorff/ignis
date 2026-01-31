import { fhirClient } from './fhir-client'

/** Minimal FHIR Appointment for read/update. */
interface FHIRAppointment {
  resourceType: 'Appointment'
  id?: string
  status?: string
  start?: string
  end?: string
  [key: string]: unknown
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
