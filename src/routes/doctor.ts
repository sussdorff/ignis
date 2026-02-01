import { Hono } from 'hono'
import {
  PrescriptionRequestActionSchema,
  type PrescriptionRequestAction,
} from '../lib/schemas'
import {
  listPendingPrescriptionRequests,
  getMedicationRequestById,
  updatePrescriptionRequestStatus,
  type FHIRMedicationRequest,
} from '../lib/aidbox-medication-requests'
import { getPatientById } from '../lib/aidbox-patients'
import type { FHIRPatient } from '../lib/schemas'

const doctor = new Hono()

/** Patient reference from MedicationRequest subject (e.g. "Patient/patient-1"). */
function patientIdFromSubject(subject?: { reference?: string }): string | null {
  const ref = subject?.reference
  if (!ref || !ref.startsWith('Patient/')) return null
  return ref.slice('Patient/'.length)
}

/** Build display name from FHIR Patient. */
function patientDisplayName(p: FHIRPatient): string {
  const name = p.name?.[0]
  if (!name) return ''
  const given = (name.given ?? []).join(' ')
  const family = name.family ?? ''
  return [given, family].filter(Boolean).join(' ').trim() || '—'
}

/** API shape for patient summary in prescription request list. */
export interface PrescriptionRequestPatientSummary {
  id: string
  name: string
  birthDate?: string
}

/** API shape for one prescription request. */
export interface PrescriptionRequestItem {
  id: string
  status: string
  intent: string
  patientId: string | null
  patient: PrescriptionRequestPatientSummary | null
  authoredOn: string | undefined
  medicationText: string | undefined
  note: string | undefined
}

/** Build API shape for one prescription request with patient context. */
async function toPrescriptionRequestItem(mr: FHIRMedicationRequest): Promise<PrescriptionRequestItem> {
  const patientId = patientIdFromSubject(mr.subject)
  const fhirPatient = patientId ? await getPatientById(patientId) : null
  const patient: PrescriptionRequestPatientSummary | null = fhirPatient
    ? { id: fhirPatient.id, name: patientDisplayName(fhirPatient), birthDate: fhirPatient.birthDate }
    : null
  const medicationText =
    mr.medicationCodeableConcept?.text ??
    mr.medicationCodeableConcept?.coding?.[0]?.display
  const note = mr.note?.[0]?.text
  return {
    id: mr.id ?? '',
    status: mr.status ?? 'active',
    intent: mr.intent ?? 'order',
    patientId,
    patient,
    authoredOn: mr.authoredOn,
    medicationText,
    note,
  }
}

// =============================================================================
// GET /api/doctor/prescription-requests - list pending prescription requests
// =============================================================================
doctor.get('/prescription-requests', async (c) => {
  try {
    // Use a shorter timeout so we return 502 before server/connection timeouts (~12s)
    const list = await listPendingPrescriptionRequests({ timeout: 8_000 })
    const items = await Promise.all(list.map(toPrescriptionRequestItem))
    return c.json({ requests: items }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json(
      {
        error: 'internal',
        message: message.includes('abort') ? 'Aidbox request timed out' : 'Aidbox request failed',
      },
      502
    )
  }
})

// =============================================================================
// POST /api/doctor/prescription-requests/:id/action - approve or deny
// =============================================================================
doctor.post('/prescription-requests/:id/action', async (c) => {
  const id = c.req.param('id')
  if (!id) {
    return c.json({ error: 'validation_failed', message: 'Missing id' }, 400)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'validation_failed', message: 'Invalid JSON' }, 400)
  }

  const parsed = PrescriptionRequestActionSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    return c.json({ error: 'validation_failed', message }, 400)
  }

  const { action, note } = parsed.data as PrescriptionRequestAction

  const existing = await getMedicationRequestById(id)
  if (!existing) {
    return c.json({ error: 'not_found', resource: 'MedicationRequest' }, 404)
  }

  if (existing.status !== 'active') {
    return c.json(
      { error: 'validation_failed', message: 'Request is no longer pending' },
      400
    )
  }

  const status = action === 'approve' ? 'completed' : 'cancelled'
  try {
    await updatePrescriptionRequestStatus(id, status, note)
    return c.json({ id, action, status, message: action === 'approve' ? 'Approved' : 'Denied' }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: 'internal', message }, 502)
  }
})

export default doctor
