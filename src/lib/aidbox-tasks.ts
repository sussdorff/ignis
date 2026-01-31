import { fhirClient } from './fhir-client'

/** Custom task type system for Ignis queue/callback. */
const TASK_TYPE_SYSTEM = 'http://ignis.hackathon/task-type'

/** Minimal FHIR Task as returned by Aidbox (id set by server on POST). */
export interface FHIRTask {
  resourceType: 'Task'
  id?: string
  status?: string
  intent?: string
  for?: { reference?: string }
  description?: string
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }> }
  input?: Array<{ type?: { text?: string }; valueString?: string; valueReference?: { reference?: string } }>
  [key: string]: unknown
}

function taskCode(code: string, display: string): FHIRTask['code'] {
  return {
    coding: [{ system: TASK_TYPE_SYSTEM, code, display }],
  }
}

/**
 * Create an urgent queue entry (FHIR Task) in Aidbox.
 * Returns the created Task (id = queueEntryId).
 */
export async function createUrgentQueueEntry(params: {
  patientId: string
  reason?: string
  phone?: string
}): Promise<FHIRTask> {
  const body: FHIRTask = {
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    for: { reference: `Patient/${params.patientId}` },
    description: params.reason ?? 'Urgent callback requested',
    code: taskCode('urgent-queue', 'Urgent queue entry'),
  }
  if (params.phone) {
    body.input = body.input ?? []
    body.input.push({
      type: { text: 'callbackPhone' },
      valueString: params.phone,
    })
  }
  return (await fhirClient.post('Task', body)) as FHIRTask
}

/**
 * Create an emergency transfer record (FHIR Task) in Aidbox.
 * Returns the created Task (id = transferId).
 */
export async function createEmergencyTransfer(params?: {
  patientId?: string
  phone?: string
  reason?: string
}): Promise<FHIRTask> {
  const body: FHIRTask = {
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    description: params?.reason ?? 'Emergency transfer',
    code: taskCode('emergency-transfer', 'Emergency transfer'),
  }
  if (params?.patientId) body.for = { reference: `Patient/${params.patientId}` }
  if (params?.phone) {
    body.input = [{ type: { text: 'callerPhone' }, valueString: params.phone }]
  }
  return (await fhirClient.post('Task', body)) as FHIRTask
}

/**
 * Create a callback request (FHIR Task) in Aidbox.
 * Returns the created Task (id = callbackId).
 */
export async function createCallbackRequest(params: {
  phone: string
  reason: string
  category: string
  patientId?: string
  patientName?: string
}): Promise<FHIRTask> {
  const body: FHIRTask = {
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    description: params.reason,
    code: taskCode('callback-request', 'Callback request'),
    input: [
      { type: { text: 'callbackPhone' }, valueString: params.phone },
      { type: { text: 'category' }, valueString: params.category },
    ],
  }
  if (params.patientId) {
    body.for = { reference: `Patient/${params.patientId}` }
    body.input = body.input ?? []
    body.input.push({
      type: { text: 'patientName' },
      valueString: params.patientName ?? '',
    })
  }
  return (await fhirClient.post('Task', body)) as FHIRTask
}
