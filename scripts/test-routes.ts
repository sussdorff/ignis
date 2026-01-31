/**
 * Integration tests for backend API routes.
 * Verifies responses and that patient data comes from Aidbox (FHIR Patient shape).
 *
 * Usage: bun run scripts/test-routes.ts
 * Requires: server running (bun run dev) and Aidbox reachable (AIDBOX_FHIR_URL).
 */

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function isFHIRPatient(obj: unknown): obj is { resourceType: 'Patient'; id: string; name?: Array<{ family?: string; given?: string[] }> } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as { resourceType?: string }).resourceType === 'Patient' &&
    typeof (obj as { id?: string }).id === 'string'
  )
}

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`)
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function run(): Promise<void> {
  let passed = 0
  let failed = 0

  const ok = (name: string) => {
    console.log(`  ✓ ${name}`)
    passed++
  }
  const fail = (name: string, err: unknown) => {
    console.error(`  ✗ ${name}: ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }

  console.log('\n--- Health & API ---')
  try {
    const healthRes = await get('/health')
    assert(healthRes.ok, `health status ${healthRes.status}`)
    const health = (await healthRes.json()) as { status?: string; timestamp?: string }
    assert(health.status === 'ok' && health.timestamp != null, 'health body')
    ok('GET /health')
  } catch (e) {
    fail('GET /health', e)
  }

  try {
    const apiRes = await get('/api')
    assert(apiRes.ok, `api status ${apiRes.status}`)
    const api = (await apiRes.json()) as { message?: string; version?: string }
    assert(api.message === 'Ignis API' && api.version != null, 'api body')
    ok('GET /api')
  } catch (e) {
    fail('GET /api', e)
  }

  try {
    const openApiRes = await get('/api/openapi.json')
    assert(openApiRes.ok, `openapi status ${openApiRes.status}`)
    const openApi = (await openApiRes.json()) as { openapi?: string; paths?: unknown }
    assert(openApi.openapi != null && typeof openApi.paths === 'object', 'openapi body')
    ok('GET /api/openapi.json')
  } catch (e) {
    fail('GET /api/openapi.json', e)
  }

  console.log('\n--- Patients (Aidbox) ---')
  try {
    const listRes = await get('/api/patients')
    assert(listRes.ok, `list patients status ${listRes.status}`)
    const list = (await listRes.json()) as unknown[]
    assert(Array.isArray(list), 'response is array')
    for (const item of list) {
      assert(isFHIRPatient(item), 'each item is FHIR Patient from Aidbox')
    }
    ok('GET /api/patients (Aidbox list)')
  } catch (e) {
    fail('GET /api/patients', e)
  }

  try {
    const lookupRes = await get('/api/patients/lookup?birthDate=1985-03-15')
    assert(lookupRes.ok, `lookup status ${lookupRes.status}`)
    const lookup = (await lookupRes.json()) as { patient: unknown; found: boolean }
    assert(typeof lookup.found === 'boolean', 'lookup.found')
    if (lookup.found) {
      assert(isFHIRPatient(lookup.patient), 'lookup patient is FHIR from Aidbox')
    }
    ok('GET /api/patients/lookup?birthDate=... (Aidbox search)')
  } catch (e) {
    fail('GET /api/patients/lookup', e)
  }

  try {
    const lookupBadRes = await get('/api/patients/lookup')
    assert(lookupBadRes.status === 400, `lookup without params should 400, got ${lookupBadRes.status}`)
    ok('GET /api/patients/lookup (no params → 400)')
  } catch (e) {
    fail('GET /api/patients/lookup validation', e)
  }

  try {
    const createRes = await post('/api/patients', {
      family: 'Test',
      given: 'Route',
      birthDate: '1990-01-01',
      phone: '+49 999 8887777',
    })
    assert(createRes.status === 201, `create status ${createRes.status}`)
    const create = (await createRes.json()) as { patient: unknown; created: boolean }
    assert(create.created === true && isFHIRPatient(create.patient), 'create response from Aidbox')
    ok('POST /api/patients (create → Aidbox)')
  } catch (e) {
    fail('POST /api/patients create', e)
  }

  try {
    const updateRes = await post('/api/patients', {
      id: 'patient-1',
      family: 'Müller',
      given: 'Hans',
      birthDate: '1985-03-15',
      phone: '+49 170 1234567',
    })
    assert(updateRes.ok, `update status ${updateRes.status}`)
    const update = (await updateRes.json()) as { patient: unknown; created: boolean }
    assert(update.created === false && isFHIRPatient(update.patient), 'update response from Aidbox')
    ok('POST /api/patients (update patient-1 → Aidbox)')
  } catch (e) {
    fail('POST /api/patients update', e)
  }

  try {
    const notFoundRes = await post('/api/patients', {
      id: 'nonexistent-patient-id-xyz',
      family: 'X',
      given: 'Y',
      birthDate: '2000-01-01',
      phone: '+49 111',
    })
    assert(notFoundRes.status === 404, `update nonexistent should 404, got ${notFoundRes.status}`)
    ok('POST /api/patients (update nonexistent → 404)')
  } catch (e) {
    fail('POST /api/patients update 404', e)
  }

  console.log('\n--- Appointments (slots stub; book uses Aidbox patient) ---')
  try {
    const slotsRes = await get('/api/appointments/slots?date=2026-02-01&limit=5')
    assert(slotsRes.ok, `slots status ${slotsRes.status}`)
    const slots = (await slotsRes.json()) as { slots: Array<{ slotId: string; start: string; end: string }> }
    assert(Array.isArray(slots.slots) && slots.slots.length > 0, 'slots array')
    assert(slots.slots[0].slotId.startsWith('stub-') && slots.slots[0].start.includes('2026-02-01'), 'slot shape')
    ok('GET /api/appointments/slots')
  } catch (e) {
    fail('GET /api/appointments/slots', e)
  }

  try {
    const bookRes = await post('/api/appointments', {
      slotId: 'stub-2026-02-01-0',
      patientId: 'patient-1',
    })
    assert(bookRes.status === 201, `book status ${bookRes.status}`)
    const book = (await bookRes.json()) as { appointment: { resourceType?: string }; start: string; end: string }
    assert(book.appointment?.resourceType === 'Appointment' && book.start && book.end, 'book response')
    ok('POST /api/appointments (book with Aidbox patient-1)')
  } catch (e) {
    fail('POST /api/appointments book', e)
  }

  try {
    const bookBadPatientRes = await post('/api/appointments', {
      slotId: 'stub-2026-02-01-0',
      patientId: 'nonexistent-patient',
    })
    assert(bookBadPatientRes.status === 404, `book unknown patient should 404, got ${bookBadPatientRes.status}`)
    ok('POST /api/appointments (unknown patient → 404)')
  } catch (e) {
    fail('POST /api/appointments book 404', e)
  }

  console.log('\n--- Queue (urgent uses Aidbox patient; emergency no patient) ---')
  try {
    const urgentRes = await post('/api/queue/urgent', { patientId: 'patient-1' })
    assert(urgentRes.status === 201, `urgent status ${urgentRes.status}`)
    const urgent = (await urgentRes.json()) as { queueEntryId: string; position?: number; message?: string }
    assert(typeof urgent.queueEntryId === 'string', 'urgent queueEntryId')
    ok('POST /api/queue/urgent (Aidbox patient-1)')
  } catch (e) {
    fail('POST /api/queue/urgent', e)
  }

  try {
    const urgentBadRes = await post('/api/queue/urgent', { patientId: 'nonexistent' })
    assert(urgentBadRes.status === 404, `urgent unknown patient should 404, got ${urgentBadRes.status}`)
    ok('POST /api/queue/urgent (unknown patient → 404)')
  } catch (e) {
    fail('POST /api/queue/urgent 404', e)
  }

  try {
    const emergencyRes = await post('/api/queue/emergency', {})
    assert(emergencyRes.status === 201, `emergency status ${emergencyRes.status}`)
    const emergency = (await emergencyRes.json()) as { transferId: string; message?: string }
    assert(typeof emergency.transferId === 'string', 'emergency transferId')
    ok('POST /api/queue/emergency')
  } catch (e) {
    fail('POST /api/queue/emergency', e)
  }

  console.log('\n--- Summary ---')
  console.log(`  Passed: ${passed}, Failed: ${failed}`)
  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
