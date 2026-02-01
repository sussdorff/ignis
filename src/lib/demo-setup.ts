/**
 * Demo data setup for hackathon presentations.
 *
 * Creates Schedules, Slots, Appointments, and Encounters for today
 * using existing Practitioners and Patients from Aidbox.
 *
 * Call POST /api/demo/setup to initialize demo data for the day.
 */

import { fhirClient } from './fhir-client'
import { addToQueueWithId, clearTodayEncounters, type QueueStatus, type Priority } from './aidbox-encounters'

interface FHIRPatient {
  resourceType: 'Patient'
  id: string
  name?: Array<{
    given?: string[]
    family?: string
    prefix?: string[]
  }>
}

interface FHIRPractitioner {
  resourceType: 'Practitioner'
  id: string
  name?: Array<{
    given?: string[]
    family?: string
    prefix?: string[]
  }>
}

interface Bundle<T> {
  resourceType: 'Bundle'
  total?: number
  entry?: Array<{ resource?: T }>
}

/** Get today's date in Berlin timezone */
function todayBerlin(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

/** Get patient display name */
function getPatientName(patient: FHIRPatient): string {
  const name = patient.name?.[0]
  if (!name) return 'Unbekannt'
  const given = name.given?.join(' ') ?? ''
  const family = name.family ?? ''
  return [given, family].filter(Boolean).join(' ') || 'Unbekannt'
}

/** Get practitioner display name */
function getPractitionerName(practitioner: FHIRPractitioner): string {
  const name = practitioner.name?.[0]
  if (!name) return 'Arzt'
  const prefix = name.prefix?.join(' ') ?? ''
  const given = name.given?.join(' ') ?? ''
  const family = name.family ?? ''
  return [prefix, given, family].filter(Boolean).join(' ') || 'Arzt'
}

/** Demo patient queue data */
interface DemoQueueEntry {
  status: QueueStatus
  priority: Priority
  reason: string
}

const demoQueueData: DemoQueueEntry[] = [
  { status: 'wartend', priority: 'notfall', reason: 'Brustschmerzen' },
  { status: 'wartend', priority: 'dringend', reason: 'Starke Rückenschmerzen' },
  { status: 'wartend', priority: 'dringend', reason: 'Atemnot' },
  { status: 'wartend', priority: 'normal', reason: 'Kopfschmerzen' },
  { status: 'wartend', priority: 'normal', reason: 'Blutdruckkontrolle' },
  { status: 'wartend', priority: 'normal', reason: 'EKG-Kontrolle' },
  { status: 'wartend', priority: 'normal', reason: 'Laborergebnisse besprechen' },
  { status: 'erwartet', priority: 'normal', reason: 'Hautausschlag' },
  { status: 'erwartet', priority: 'normal', reason: 'Impfung' },
  { status: 'erwartet', priority: 'normal', reason: 'Allergietest' },
  { status: 'erwartet', priority: 'normal', reason: 'Vorsorgeuntersuchung' },
]

export interface DemoSetupResult {
  success: boolean
  schedules: number
  slots: number
  appointments: number
  encounters: number
  errors: string[]
}

/**
 * Setup demo data for today's hackathon presentation.
 *
 * 1. Fetches existing practitioners (up to 3)
 * 2. Fetches existing patients (up to 15)
 * 3. Creates Schedule for each practitioner for today
 * 4. Creates 30-minute Slots from 08:00 to 18:00 for each schedule
 * 5. Creates Appointments linking patients to slots
 * 6. Creates Encounters (queue entries) for patients
 */
export async function setupDemoData(): Promise<DemoSetupResult> {
  const result: DemoSetupResult = {
    success: false,
    schedules: 0,
    slots: 0,
    appointments: 0,
    encounters: 0,
    errors: [],
  }

  const today = todayBerlin()
  console.log(`[Demo Setup] Starting demo data setup for ${today}`)

  try {
    // 1. Fetch practitioners
    console.log('[Demo Setup] Fetching practitioners...')
    const practBundle = await fhirClient.get<Bundle<FHIRPractitioner>>('Practitioner?_count=3')
    const practitioners = (practBundle.entry ?? [])
      .map(e => e.resource)
      .filter((p): p is FHIRPractitioner => p?.resourceType === 'Practitioner')

    if (practitioners.length === 0) {
      result.errors.push('No practitioners found in Aidbox')
      return result
    }
    console.log(`[Demo Setup] Found ${practitioners.length} practitioners`)

    // 2. Fetch patients
    console.log('[Demo Setup] Fetching patients...')
    const patientBundle = await fhirClient.get<Bundle<FHIRPatient>>('Patient?_count=15')
    const patients = (patientBundle.entry ?? [])
      .map(e => e.resource)
      .filter((p): p is FHIRPatient => p?.resourceType === 'Patient')

    if (patients.length === 0) {
      result.errors.push('No patients found in Aidbox')
      return result
    }
    console.log(`[Demo Setup] Found ${patients.length} patients`)

    // 3. Clear existing encounters for today
    console.log('[Demo Setup] Clearing existing encounters for today...')
    const cleared = await clearTodayEncounters()
    console.log(`[Demo Setup] Cleared ${cleared} existing encounters`)

    // 4. Create Schedules for each practitioner
    console.log('[Demo Setup] Creating schedules...')
    for (const practitioner of practitioners) {
      const scheduleId = `schedule-${practitioner.id}-${today}`
      const schedule = {
        resourceType: 'Schedule',
        id: scheduleId,
        active: true,
        actor: [{
          reference: `Practitioner/${practitioner.id}`,
          display: getPractitionerName(practitioner),
        }],
        planningHorizon: {
          start: `${today}T08:00:00+01:00`,
          end: `${today}T18:00:00+01:00`,
        },
      }

      try {
        await fhirClient.put(`Schedule/${scheduleId}`, schedule)
        result.schedules++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Failed to create schedule for ${practitioner.id}: ${msg}`)
      }
    }
    console.log(`[Demo Setup] Created ${result.schedules} schedules`)

    // 5. Create Slots for each schedule (30-minute intervals from 08:00 to 18:00)
    console.log('[Demo Setup] Creating slots...')
    const slotTimes: { hour: number; minute: number }[] = []
    for (let hour = 8; hour < 18; hour++) {
      slotTimes.push({ hour, minute: 0 })
      slotTimes.push({ hour, minute: 30 })
    }

    for (const practitioner of practitioners) {
      const scheduleId = `schedule-${practitioner.id}-${today}`

      for (const { hour, minute } of slotTimes) {
        const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        const endHour = minute === 30 ? hour + 1 : hour
        const endMinute = minute === 30 ? 0 : 30
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`

        const slotId = `slot-${scheduleId}-${startTime.replace(':', '')}`
        const slot = {
          resourceType: 'Slot',
          id: slotId,
          schedule: { reference: `Schedule/${scheduleId}` },
          status: 'free',
          start: `${today}T${startTime}:00+01:00`,
          end: `${today}T${endTime}:00+01:00`,
        }

        try {
          await fhirClient.put(`Slot/${slotId}`, slot)
          result.slots++
        } catch (err) {
          // Ignore slot creation errors (may already exist)
        }
      }
    }
    console.log(`[Demo Setup] Created ${result.slots} slots`)

    // 6. Create Appointments and Encounters for patients
    console.log('[Demo Setup] Creating appointments and encounters...')
    const patientsToSchedule = patients.slice(0, Math.min(patients.length, demoQueueData.length))

    for (let i = 0; i < patientsToSchedule.length; i++) {
      const patient = patientsToSchedule[i]
      const queueData = demoQueueData[i]
      const practitioner = practitioners[i % practitioners.length]
      const practitionerName = getPractitionerName(practitioner)
      const patientName = getPatientName(patient)

      // Calculate appointment time (spread across the morning)
      const slotIndex = i
      const hour = 8 + Math.floor(slotIndex / 2)
      const minute = (slotIndex % 2) * 30
      const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      const endHour = minute === 30 ? hour + 1 : hour
      const endMinute = minute === 30 ? 0 : 30
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`

      const scheduleId = `schedule-${practitioner.id}-${today}`
      const slotId = `slot-${scheduleId}-${startTime.replace(':', '')}`
      const appointmentId = `appointment-demo-${today}-${i + 1}`

      // Create Appointment
      const appointment = {
        resourceType: 'Appointment',
        id: appointmentId,
        status: queueData.status === 'erwartet' ? 'booked' : 'arrived',
        description: queueData.reason,
        start: `${today}T${startTime}:00+01:00`,
        end: `${today}T${endTime}:00+01:00`,
        slot: [{ reference: `Slot/${slotId}` }],
        participant: [
          {
            actor: {
              reference: `Patient/${patient.id}`,
              display: patientName,
            },
            status: 'accepted',
          },
          {
            actor: {
              reference: `Practitioner/${practitioner.id}`,
              display: practitionerName,
            },
            status: 'accepted',
          },
        ],
      }

      try {
        await fhirClient.put(`Appointment/${appointmentId}`, appointment)
        result.appointments++

        // Update slot status to busy
        try {
          await fhirClient.put(`Slot/${slotId}`, {
            resourceType: 'Slot',
            id: slotId,
            schedule: { reference: `Schedule/${scheduleId}` },
            status: 'busy',
            start: `${today}T${startTime}:00+01:00`,
            end: `${today}T${endTime}:00+01:00`,
          })
        } catch {
          // Ignore slot update errors
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Failed to create appointment for ${patientName}: ${msg}`)
        continue
      }

      // Create Encounter (queue entry)
      const encounterId = `encounter-demo-${today}-${i + 1}`
      try {
        await addToQueueWithId({
          id: encounterId,
          patientId: patient.id,
          patientName,
          appointmentId,
          status: queueData.status,
          priority: queueData.priority,
          reason: queueData.reason,
          doctor: practitionerName,
        })
        result.encounters++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Failed to create encounter for ${patientName}: ${msg}`)
      }
    }

    console.log(`[Demo Setup] Created ${result.appointments} appointments and ${result.encounters} encounters`)

    result.success = result.errors.length === 0
    console.log(`[Demo Setup] Setup complete. Success: ${result.success}`)

    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Setup failed: ${msg}`)
    return result
  }
}

/**
 * Clear all demo data for today.
 */
export async function clearDemoData(): Promise<{ cleared: number; errors: string[] }> {
  const errors: string[] = []
  let cleared = 0

  const today = todayBerlin()
  console.log(`[Demo Clear] Clearing demo data for ${today}`)

  // Clear encounters
  try {
    const encounterCleared = await clearTodayEncounters()
    cleared += encounterCleared
    console.log(`[Demo Clear] Cleared ${encounterCleared} encounters`)
  } catch (err) {
    errors.push(`Failed to clear encounters: ${err}`)
  }

  // Clear today's demo appointments
  try {
    const apptBundle = await fhirClient.get<Bundle<{ id?: string }>>(`Appointment?date=${today}&_count=100`)
    const appointments = apptBundle.entry ?? []

    for (const entry of appointments) {
      const id = entry.resource?.id
      if (id?.startsWith('appointment-demo-')) {
        try {
          await fhirClient.put(`Appointment/${id}`, {
            resourceType: 'Appointment',
            id,
            status: 'cancelled',
          })
          cleared++
        } catch {
          // Ignore
        }
      }
    }
    console.log(`[Demo Clear] Cancelled demo appointments`)
  } catch (err) {
    errors.push(`Failed to clear appointments: ${err}`)
  }

  return { cleared, errors }
}
