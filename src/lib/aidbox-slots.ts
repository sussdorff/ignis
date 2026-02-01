import { fhirClient } from './fhir-client'
import type { Slot } from './schemas'

/** Minimal FHIR Slot from search results. */
interface FHIRSlot {
  resourceType: 'Slot'
  id?: string
  start?: string
  end?: string
  status?: string
  schedule?: { reference?: string }
}

/** Minimal FHIR Schedule for practitioner info. */
interface FHIRSchedule {
  resourceType: 'Schedule'
  id?: string
  actor?: Array<{ reference?: string; display?: string }>
}

interface SlotBundle {
  resourceType: 'Bundle'
  entry?: Array<{ resource?: FHIRSlot }>
}

const BERLIN_OFFSET = '+01:00'

/** Extract Schedule ID from reference "Schedule/id". */
function scheduleIdFromRef(ref?: string): string | null {
  if (!ref || !ref.startsWith('Schedule/')) return null
  return ref.replace(/^Schedule\//, '') || null
}

/** Fetch Schedules by IDs and return a map id -> { practitionerId, practitionerDisplay }. */
async function loadSchedulePractitioners(
  scheduleIds: string[]
): Promise<Map<string, { practitionerId: string; practitionerDisplay: string }>> {
  const unique = [...new Set(scheduleIds)]
  const map = new Map<string, { practitionerId: string; practitionerDisplay: string }>()
  if (unique.length === 0) return map

  for (const id of unique) {
    try {
      const s = (await fhirClient.get(`Schedule/${id}`)) as FHIRSchedule
      const actor = s.actor?.[0]
      const practitionerRef = actor?.reference ?? ''
      const practitionerId = practitionerRef.replace(/^Practitioner\//, '') || 'unknown'
      const practitionerDisplay = actor?.display ?? 'Practitioner'
      map.set(id, { practitionerId, practitionerDisplay })
    } catch {
      map.set(id, { practitionerId: 'unknown', practitionerDisplay: 'Practitioner' })
    }
  }
  return map
}

/** Map FHIR Slot + practitioner info to API Slot shape. */
function toApiSlot(
  fhir: FHIRSlot,
  practitioners: Map<string, { practitionerId: string; practitionerDisplay: string }>
): Slot {
  const scheduleRef = fhir.schedule?.reference
  const scheduleId = scheduleIdFromRef(scheduleRef) ?? ''
  const practitioner = practitioners.get(scheduleId) ?? {
    practitionerId: 'unknown',
    practitionerDisplay: 'Practitioner',
  }
  return {
    slotId: fhir.id ?? '',
    start: fhir.start ?? '',
    end: fhir.end ?? '',
    practitionerId: practitioner.practitionerId,
    practitionerDisplay: practitioner.practitionerDisplay,
  }
}

/**
 * Get free slots for a given date from Aidbox.
 * Optionally filter out slots before minStartTime (e.g. for "today" - 30 min from now).
 */
export async function getSlotsForDate(
  date: string,
  limit: number,
  options?: { minStartTime?: Date }
): Promise<Slot[]> {
  const startGe = `${date}T00:00:00${BERLIN_OFFSET}`
  const startLe = `${date}T23:59:59${BERLIN_OFFSET}`
  const query = `Slot?status=free&start=ge${encodeURIComponent(startGe)}&start=le${encodeURIComponent(startLe)}&_count=${Math.min(limit * 2, 100)}&_sort=start`

  const bundle = (await fhirClient.get(query)) as SlotBundle
  const entries = bundle.entry ?? []
  const fhirSlots = entries
    .map((e) => e.resource)
    .filter((r): r is FHIRSlot => r?.resourceType === 'Slot')

  const scheduleIds = fhirSlots
    .map((s) => scheduleIdFromRef(s.schedule?.reference))
    .filter((id): id is string => !!id)
  const practitioners = await loadSchedulePractitioners(scheduleIds)

  let slots = fhirSlots.map((s) => toApiSlot(s, practitioners))

  if (options?.minStartTime) {
    slots = slots.filter((s) => new Date(s.start) >= options.minStartTime!)
  }

  return slots.slice(0, limit)
}

/**
 * Get the next N free slots from now (ig-afr).
 * Searches forward from 30 minutes from now (min booking notice).
 */
export async function getNextSlots(limit: number): Promise<Slot[]> {
  const minStart = new Date(Date.now() + 30 * 60 * 1000)
  const minStartISO = minStart.toISOString()

  const query = `Slot?status=free&start=ge${encodeURIComponent(minStartISO)}&_count=${limit}&_sort=start`
  const bundle = (await fhirClient.get(query)) as SlotBundle
  const entries = bundle.entry ?? []
  const fhirSlots = entries
    .map((e) => e.resource)
    .filter((r): r is FHIRSlot => r?.resourceType === 'Slot')
    .slice(0, limit)

  const scheduleIds = fhirSlots
    .map((s) => scheduleIdFromRef(s.schedule?.reference))
    .filter((id): id is string => !!id)
  const practitioners = await loadSchedulePractitioners(scheduleIds)

  return fhirSlots.map((s) => toApiSlot(s, practitioners))
}

/**
 * Get a Slot by ID from Aidbox.
 * Returns null if not found.
 */
export async function getSlotById(
  slotId: string
): Promise<{ start: string; end: string; scheduleRef: string; practitionerId: string; practitionerDisplay: string } | null> {
  try {
    const slot = (await fhirClient.get(`Slot/${slotId}`)) as FHIRSlot
    if (slot?.resourceType !== 'Slot') return null
    const scheduleRef = slot.schedule?.reference ?? ''
    const scheduleId = scheduleIdFromRef(scheduleRef) ?? ''
    let practitionerId = 'practitioner-1'
    let practitionerDisplay = 'Dr. Anna Schmidt'
    if (scheduleId) {
      const s = (await fhirClient.get(`Schedule/${scheduleId}`)) as FHIRSchedule
      const actor = s.actor?.[0]
      if (actor) {
        practitionerId = (actor.reference ?? '').replace(/^Practitioner\//, '') || practitionerId
        practitionerDisplay = actor.display ?? practitionerDisplay
      }
    }
    return {
      start: slot.start ?? '',
      end: slot.end ?? '',
      scheduleRef,
      practitionerId,
      practitionerDisplay,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('404') || msg.includes('Not Found')) return null
    throw err
  }
}
