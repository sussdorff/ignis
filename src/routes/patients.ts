import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  PatientLookupQuerySchema,
  PatientCreateOrUpdateRequestSchema,
  type PatientLookupResponse,
  type PatientCreateOrUpdateResponse,
} from '../lib/schemas'
import { findPatient, getPatientById, createOrUpdatePatient, getAllPatients, getUpcomingAppointment } from '../lib/aidbox-patients'
import type { FHIRPatient } from '../lib/schemas'

const patients = new Hono()

// =============================================================================
// GET /api/patients - list all patients
// =============================================================================
patients.get('/', async (c) => {
  try {
    const allPatients = await getAllPatients()
    return c.json(allPatients, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json(
      { error: 'internal', message: message.includes('abort') ? 'Aidbox request timed out' : 'Aidbox request failed' },
      502
    )
  }
})

/** Build display name for greeting (e.g. "Herr Müller" / "Frau Weber"). */
function patientDisplayName(patient: FHIRPatient): string {
  const name = patient.name?.[0]
  if (!name) return ''
  const family = name.family ?? ''
  const given = (name.given ?? []).join(' ')
  if (patient.gender === 'male') return family ? `Herr ${family}` : given
  if (patient.gender === 'female') return family ? `Frau ${family}` : given
  const full = [given, family].filter(Boolean).join(' ').trim()
  return full || family
}

// =============================================================================
// GET /api/patients/lookup - patient_lookup
// Find a returning patient by name, phone and/or date of birth.
// =============================================================================
patients.get('/lookup', async (c) => {
  const parsed = PatientLookupQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    const issues = parsed.error.issues
    const message = issues.map((e) => e.message).join('; ') || 'At least one of name, phone or birthDate must be provided'
    return c.json({ error: 'validation_failed', message }, 400)
  }

  const { name, phone, birthDate } = parsed.data
  const patient = await findPatient(name, phone, birthDate)

  const response: PatientLookupResponse = {
    patient,
    found: patient !== null,
  }
  if (patient) {
    response.patientId = patient.id
    response.patientName = patientDisplayName(patient)
    response.upcomingAppointment = await getUpcomingAppointment(patient.id)
  }

  return c.json(response, 200)
})

// =============================================================================
// POST /api/patients - patient_create_or_update
// Create a new Patient or update an existing one with intake data.
// =============================================================================
patients.post(
  '/',
  zValidator('json', PatientCreateOrUpdateRequestSchema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues
      const fields = issues.map((e) => (e.path ?? []).join('.'))
      const message = issues.map((e) => e.message).join('; ')
      return c.json({ error: 'validation_failed', message, fields }, 400)
    }
  }),
  async (c) => {
    const data = c.req.valid('json')

    // If updating, check that patient exists
    if (data.id) {
      const existing = await getPatientById(data.id)
      if (!existing) {
        return c.json({ error: 'not_found' }, 404)
      }
    }

    try {
      const { patient, created } = await createOrUpdatePatient(data)
      const response: PatientCreateOrUpdateResponse = { patient, created }
      return c.json(response, created ? 201 : 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('not found') || message.includes('404')) {
        return c.json({ error: 'not_found' }, 404)
      }
      throw err
    }
  }
)

export default patients
