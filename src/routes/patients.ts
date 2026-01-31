import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  PatientLookupQuerySchema,
  PatientCreateOrUpdateRequestSchema,
  type PatientLookupResponse,
  type PatientCreateOrUpdateResponse,
} from '../lib/schemas'
import { findPatient, getPatientById, createOrUpdatePatient, getAllPatients } from '../lib/dummy-data'

const patients = new Hono()

// =============================================================================
// GET /api/patients - list all patients
// =============================================================================
patients.get('/', (c) => {
  // TODO: Replace with Aidbox FHIR query
  const allPatients = getAllPatients()
  return c.json(allPatients, 200)
})

// =============================================================================
// GET /api/patients/lookup - patient_lookup
// Find a returning patient by phone and/or date of birth (Geburtsdatum).
// =============================================================================
patients.get(
  '/lookup',
  zValidator('query', PatientLookupQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: 'validation_failed',
          message: result.error.errors.map((e) => e.message).join('; '),
        },
        400
      )
    }
  }),
  (c) => {
    const { phone, birthDate } = c.req.valid('query')

    // TODO: Replace with Aidbox FHIR search
    const patient = findPatient(phone, birthDate)

    const response: PatientLookupResponse = {
      patient,
      found: patient !== null,
    }

    return c.json(response, 200)
  }
)

// =============================================================================
// POST /api/patients - patient_create_or_update
// Create a new Patient or update an existing one with intake data.
// =============================================================================
patients.post(
  '/',
  zValidator('json', PatientCreateOrUpdateRequestSchema, (result, c) => {
    if (!result.success) {
      const fields = result.error.errors.map((e) => e.path.join('.'))
      return c.json(
        {
          error: 'validation_failed',
          message: result.error.errors.map((e) => e.message).join('; '),
          fields,
        },
        400
      )
    }
  }),
  (c) => {
    const data = c.req.valid('json')

    // If updating, check that patient exists
    if (data.id) {
      const existing = getPatientById(data.id)
      if (!existing) {
        return c.json({ error: 'not_found' }, 404)
      }
    }

    // TODO: Replace with Aidbox FHIR create/update
    const { patient, created } = createOrUpdatePatient(data)

    const response: PatientCreateOrUpdateResponse = { patient, created }

    return c.json(response, created ? 201 : 200)
  }
)

export default patients
