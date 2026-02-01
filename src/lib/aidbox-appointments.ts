import { fhirClient } from './fhir-client'

/** Minimal FHIR Appointment for read/update. */
interface FHIRAppointment {
  resourceType: 'Appointment'
  id?: string
  status?: string
  start?: string
  end?: string
  description?: string
  participant?: Array<{
    actor?: { reference?: string; display?: string }
    status?: string
  }>
  [key: string]: unknown
}

interface AppointmentBundle {
  resourceType: 'Bundle'
  entry?: Array<{ resource?: FHIRAppointment }>
}

export interface AppointmentWithPatient {
  id: string
  patientId: string
  patientName: string
  start: string
  end: string
  status: string
  reason?: string
  practitioner?: string
}

export type CancelResult =
  | { ok: true; appointmentId: string }
  | { ok: false; code: 'not_found' }
  | { ok: false; code: 'conflict'; reason: 'already_cancelled' | 'in_the_past' }

/** Minimal payload for creating an Appointment. */
export interface CreateAppointmentInput {
  start: string
  end: string
  patientId: string
  practitionerId?: string
  practitionerDisplay?: string
  slotId?: string
}

/**
 * Create an Appointment in Aidbox.
 * References the Slot if slotId provided (FHIR workflow).
 * Returns the created resource with server-assigned id, or throws on error.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<FHIRAppointment> {
  const body: FHIRAppointment = {
    resourceType: 'Appointment',
    status: 'booked',
    start: input.start,
    end: input.end,
    ...(input.slotId && { slot: [{ reference: `Slot/${input.slotId}` }] }),
    participant: [
      { actor: { reference: `Patient/${input.patientId}` }, status: 'accepted' },
      {
        actor: {
          reference: `Practitioner/${input.practitionerId ?? 'practitioner-1'}`,
          display: input.practitionerDisplay ?? 'Dr. Anna Schmidt',
        },
        status: 'accepted',
      },
    ],
  }
  return (await fhirClient.post('Appointment', body)) as FHIRAppointment
}

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
 * Get today's date in YYYY-MM-DD format (Europe/Berlin timezone).
 */
function todayBerlin(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

/**
 * Extract patient ID from participant reference (e.g., "Patient/123" -> "123").
 */
function extractPatientId(reference?: string): string | null {
  if (!reference) return null
  const match = reference.match(/^Patient\/(.+)$/)
  return match ? match[1] : null
}

/**
 * Get all appointments for today.
 */
export async function getTodayAppointments(): Promise<AppointmentWithPatient[]> {
  const today = todayBerlin()
  const path = `Appointment?date=${today}&_count=100`
  
  try {
    const bundle = (await fhirClient.get(path)) as AppointmentBundle
    const entries = bundle.entry ?? []
    
    return entries
      .map((e) => e.resource)
      .filter((r): r is FHIRAppointment => r?.resourceType === 'Appointment')
      .map((appt) => {
        const patientParticipant = appt.participant?.find(p => 
          p.actor?.reference?.startsWith('Patient/')
        )
        const practitionerParticipant = appt.participant?.find(p => 
          p.actor?.reference?.startsWith('Practitioner/')
        )
        
        return {
          id: appt.id ?? '',
          patientId: extractPatientId(patientParticipant?.actor?.reference) ?? '',
          patientName: patientParticipant?.actor?.display ?? 'Unbekannt',
          start: appt.start ?? '',
          end: appt.end ?? '',
          status: appt.status ?? 'booked',
          reason: appt.description,
          practitioner: practitionerParticipant?.actor?.display,
        }
      })
  } catch {
    return []
  }
}

/**
 * Update appointment status.
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow'
): Promise<{ ok: boolean; error?: string }> {
  const appt = await getAppointmentById(appointmentId)
  if (!appt) return { ok: false, error: 'not_found' }
  
  const updated: FHIRAppointment = { ...appt, status: newStatus }
  await fhirClient.put(`Appointment/${appointmentId}`, updated)
  return { ok: true }
}
