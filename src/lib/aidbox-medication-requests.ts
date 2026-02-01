import { fhirClient } from './fhir-client'

/** FHIR R4 MedicationRequest (minimal fields we use). */
export interface FHIRMedicationRequest {
  resourceType: 'MedicationRequest'
  id?: string
  status?: string
  intent?: string
  subject?: { reference?: string }
  authoredOn?: string
  medicationCodeableConcept?: { text?: string; coding?: Array<{ display?: string }> }
  note?: Array<{ text?: string }>
  [key: string]: unknown
}

/** FHIR Bundle (searchset) for MedicationRequest search. */
interface FHIRBundle {
  resourceType: 'Bundle'
  type: string
  total?: number
  entry?: Array<{ resource?: FHIRMedicationRequest }>
}

/** Options for listing (e.g. shorter timeout to avoid connection reset). */
export interface ListPendingOptions {
  timeout?: number
}

/**
 * List pending prescription requests (MedicationRequest with status=active, intent=order).
 */
export async function listPendingPrescriptionRequests(
  options?: ListPendingOptions
): Promise<FHIRMedicationRequest[]> {
  const path = 'MedicationRequest?status=active&intent=order'
  const bundle = (await fhirClient.get(path, { timeout: options?.timeout })) as FHIRBundle
  const list = bundle.entry ?? []
  return list
    .map((e) => e.resource)
    .filter((r): r is FHIRMedicationRequest => r != null && r.resourceType === 'MedicationRequest')
}

/**
 * Get a single MedicationRequest by id.
 */
export async function getMedicationRequestById(id: string): Promise<FHIRMedicationRequest | null> {
  try {
    return (await fhirClient.get(`MedicationRequest/${id}`)) as FHIRMedicationRequest
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('404') || msg.includes('not found')) return null
    throw err
  }
}

/**
 * Create a prescription request (MedicationRequest) from patient intake (e.g. callback category=prescription).
 */
export async function createPrescriptionRequest(params: {
  patientId: string
  reason: string
  medicationText?: string
}): Promise<FHIRMedicationRequest> {
  const body: FHIRMedicationRequest = {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    subject: { reference: `Patient/${params.patientId}` },
    authoredOn: new Date().toISOString(),
    note: [{ text: params.reason }],
  }
  if (params.medicationText) {
    body.medicationCodeableConcept = { text: params.medicationText }
  }
  return (await fhirClient.post('MedicationRequest', body)) as FHIRMedicationRequest
}

/**
 * Update MedicationRequest status (approve → completed, deny → cancelled).
 */
export async function updatePrescriptionRequestStatus(
  id: string,
  status: 'completed' | 'cancelled',
  note?: string
): Promise<FHIRMedicationRequest> {
  const existing = await getMedicationRequestById(id)
  if (!existing) {
    throw new Error('MedicationRequest not found')
  }
  const updated: FHIRMedicationRequest = {
    ...existing,
    status,
  }
  if (note) {
    updated.note = [...(existing.note ?? []), { text: note }]
  }
  return (await fhirClient.put(`MedicationRequest/${id}`, updated)) as FHIRMedicationRequest
}
