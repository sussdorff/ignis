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
  /** FHIR R4: reference to Slot(s) so we can free the slot on cancel */
  slot?: Array<{ reference?: string }>
  [key: string]: unknown
}

/** FHIR Slot resource. */
export interface FHIRSlot {
  resourceType: 'Slot'
  id?: string
  status?: 'busy' | 'free' | 'busy-unavailable' | 'busy-tentative' | 'entered-in-error'
  start?: string
  end?: string
  schedule?: { reference?: string }
  [key: string]: unknown
}

/** FHIR Schedule resource. */
export interface FHIRSchedule {
  resourceType: 'Schedule'
  id?: string
  actor?: Array<{ reference?: string; display?: string }>
  active?: boolean
  [key: string]: unknown
}

/** FHIR Bundle (searchset) from GET /Appointment?date=... */
interface AppointmentBundle {
  resourceType: 'Bundle'
  entry?: Array<{ resource?: FHIRAppointment }>
}

/** FHIR Bundle (searchset) from GET /Slot?... */
interface SlotBundle {
  resourceType: 'Bundle'
  entry?: Array<{ resource?: FHIRSlot | FHIRSchedule; search?: { mode?: 'match' | 'include' } }>
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
 * Extract slot ID from a FHIR reference (e.g. "Slot/abc" -> "abc").
 */
function slotIdFromReference(ref: string | undefined): string | null {
  if (!ref?.trim()) return null
  const parts = ref.split('/')
  const id = parts[parts.length - 1]
  return id?.trim() || null
}

/**
 * Cancel an appointment in Aidbox (set status to cancelled) and free the linked Slot if any.
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

  // Free the slot so it becomes bookable again (best-effort; don't fail cancel if slot update fails)
  const slotRef = appt.slot?.[0]?.reference
  const slotId = slotIdFromReference(slotRef)
  if (slotId) {
    try {
      await updateSlotStatus(slotId, 'free')
    } catch (err) {
      console.error('[cancelAppointment] Failed to free slot', slotId, err)
    }
  }

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
 * Stores the slot reference on the Appointment so the slot can be freed on cancel.
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
  /** Slot ID to store on the Appointment (used to free the slot on cancel) */
  slotId?: string
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
  if (params.slotId) {
    body.slot = [{ reference: `Slot/${params.slotId}` }]
  }
  const created = (await fhirClient.post('Appointment', body)) as FHIRAppointment
  return { ok: true, appointment: created }
}

// =============================================================================
// Slot operations (for real FHIR Slot/Schedule data)
// =============================================================================

/** Slot with resolved practitioner info from Schedule. */
export interface SlotWithPractitioner {
  slotId: string
  start: string
  end: string
  practitionerId?: string
  practitionerDisplay?: string
}

/**
 * Get a Slot by ID from Aidbox.
 * Returns null if not found (404).
 */
export async function getSlotById(id: string): Promise<FHIRSlot | null> {
  try {
    const slot = (await fhirClient.get(`Slot/${id}`)) as FHIRSlot
    return slot?.resourceType === 'Slot' ? slot : null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404') || message.includes('Not Found')) return null
    throw err
  }
}

/**
 * Get a Schedule by ID from Aidbox.
 * Returns null if not found (404).
 */
export async function getScheduleById(id: string): Promise<FHIRSchedule | null> {
  try {
    const schedule = (await fhirClient.get(`Schedule/${id}`)) as FHIRSchedule
    return schedule?.resourceType === 'Schedule' ? schedule : null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404') || message.includes('Not Found')) return null
    throw err
  }
}

/**
 * Update a Slot's status in Aidbox (e.g., from 'free' to 'busy').
 */
export async function updateSlotStatus(
  slotId: string,
  status: 'busy' | 'free' | 'busy-unavailable' | 'busy-tentative'
): Promise<FHIRSlot | null> {
  const slot = await getSlotById(slotId)
  if (!slot) return null
  const updated: FHIRSlot = { ...slot, status }
  const result = (await fhirClient.put(`Slot/${slotId}`, updated)) as FHIRSlot
  return result
}

/**
 * Query available (free) slots for a given date.
 * Optionally filter by practitionerId.
 * Returns slots with practitioner info resolved from Schedule.
 */
export async function getAvailableSlots(params: {
  date: string // YYYY-MM-DD
  practitionerId?: string
  limit?: number
}): Promise<SlotWithPractitioner[]> {
  const { date, practitionerId, limit = 10 } = params

  // Build search query
  // FHIR Slot search by start date and status=free
  // Use _include to get the Schedule in the same request
  const searchParams = new URLSearchParams({
    status: 'free',
    _count: String(limit * 3), // Fetch more to account for filtering
    _include: 'Slot:schedule',
    _sort: 'start',
  })

  // Search by date range (slots starting on the given date)
  // Using ge (>=) and lt (<) for the date range
  searchParams.append('start', `ge${date}T00:00:00`)
  searchParams.append('start', `lt${date}T23:59:59`)

  const bundle = (await fhirClient.get(`Slot?${searchParams.toString()}`)) as SlotBundle

  // Separate slots and schedules from the bundle
  const slots: FHIRSlot[] = []
  const schedules = new Map<string, FHIRSchedule>()

  for (const entry of bundle.entry ?? []) {
    if (entry.resource?.resourceType === 'Slot' && entry.search?.mode === 'match') {
      slots.push(entry.resource as FHIRSlot)
    } else if (entry.resource?.resourceType === 'Schedule' && entry.search?.mode === 'include') {
      const schedule = entry.resource as FHIRSchedule
      if (schedule.id) {
        schedules.set(`Schedule/${schedule.id}`, schedule)
      }
    }
  }

  // Map slots to SlotWithPractitioner, resolving practitioner info
  const results: SlotWithPractitioner[] = []
  for (const slot of slots) {
    if (!slot.id || !slot.start || !slot.end) continue

    // Get practitioner info from the referenced Schedule
    const scheduleRef = slot.schedule?.reference
    const schedule = scheduleRef ? schedules.get(scheduleRef) : undefined
    const actor = schedule?.actor?.[0]
    const practitionerRef = actor?.reference // e.g., "Practitioner/practitioner-1"
    const practitionerIdFromRef = practitionerRef?.replace('Practitioner/', '')

    // Filter by practitionerId if specified
    if (practitionerId && practitionerIdFromRef !== practitionerId) {
      continue
    }

    results.push({
      slotId: slot.id,
      start: slot.start,
      end: slot.end,
      practitionerId: practitionerIdFromRef,
      practitionerDisplay: actor?.display,
    })

    // Stop once we have enough results
    if (results.length >= limit) break
  }

  return results
}

/**
 * Get slot details with practitioner info resolved.
 * Used when booking to get the full slot info.
 */
export async function getSlotWithPractitioner(slotId: string): Promise<SlotWithPractitioner | null> {
  const slot = await getSlotById(slotId)
  if (!slot || !slot.start || !slot.end) return null

  // Get practitioner info from the referenced Schedule
  let practitionerId: string | undefined
  let practitionerDisplay: string | undefined

  const scheduleRef = slot.schedule?.reference
  if (scheduleRef) {
    const scheduleId = scheduleRef.replace('Schedule/', '')
    const schedule = await getScheduleById(scheduleId)
    if (schedule) {
      const actor = schedule.actor?.[0]
      practitionerId = actor?.reference?.replace('Practitioner/', '')
      practitionerDisplay = actor?.display
    }
  }

  return {
    slotId: slot.id!,
    start: slot.start,
    end: slot.end,
    practitionerId,
    practitionerDisplay,
  }
}
