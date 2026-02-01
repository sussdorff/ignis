/**
 * Backend Integration Tests
 * 
 * Tests the backend API endpoints directly and validates database changes.
 * 
 * Usage:
 *   npx tsx scripts/test-backend-integration.ts
 */

const API_BASE = process.env.API_BASE_URL || 'https://ignis.cognovis.de/api'
const FHIR_BASE = process.env.AIDBOX_FHIR_URL || 'https://ignis.cognovis.de/fhir'
const AIDBOX_USER = process.env.AIDBOX_USER || 'admin'
const AIDBOX_PASSWORD = process.env.AIDBOX_PASSWORD || 'ignis2026'

interface TestResult {
  name: string
  passed: boolean
  details: string
  error?: string
}

const results: TestResult[] = []

// Helper to make API calls with Basic Auth
async function callApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; data: any }> {
  const url = `${API_BASE}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa(`${AIDBOX_USER}:${AIDBOX_PASSWORD}`),
    ...options.headers,
  }

  const response = await fetch(url, { ...options, headers })
  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }
  return { status: response.status, data }
}

// Helper to query FHIR directly
async function queryFhir(path: string): Promise<any> {
  const url = `${FHIR_BASE}/${path}`
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${AIDBOX_USER}:${AIDBOX_PASSWORD}`),
    },
  })
  return response.json()
}

// Test: Patient Lookup - Existing Patient
async function testPatientLookupExisting() {
  const name = 'Hans Müller'
  const birthDate = '1985-03-15'

  const { status, data } = await callApi(
    `/patients/lookup?name=${encodeURIComponent(name)}&birthDate=${birthDate}`
  )

  const passed = status === 200 && data.found === true && data.patientId === 'patient-1'

  results.push({
    name: 'Patient Lookup - Existing Patient',
    passed,
    details: `found=${data.found}, patientId=${data.patientId}`,
    error: passed ? undefined : `Status: ${status}, Data: ${JSON.stringify(data)}`,
  })
}

// Test: Patient Lookup - Non-existing Patient
async function testPatientLookupNonExisting() {
  const name = 'Unknown Person'
  const birthDate = '2000-01-01'

  const { status, data } = await callApi(
    `/patients/lookup?name=${encodeURIComponent(name)}&birthDate=${birthDate}`
  )

  const passed = status === 200 && data.found === false

  results.push({
    name: 'Patient Lookup - Non-existing Patient',
    passed,
    details: `found=${data.found}`,
    error: passed ? undefined : `Status: ${status}, Data: ${JSON.stringify(data)}`,
  })
}

// Test: Get Available Slots
async function testGetAvailableSlots() {
  const today = new Date().toISOString().slice(0, 10)

  const { status, data } = await callApi(`/appointments/slots?date=${today}&limit=5`)

  const passed = status === 200 && Array.isArray(data.slots)

  results.push({
    name: 'Get Available Slots',
    passed,
    details: `Found ${data.slots?.length || 0} slots`,
    error: passed ? undefined : `Status: ${status}, Data: ${JSON.stringify(data)}`,
  })
}

// Test: Request Callback
async function testRequestCallback() {
  const { status, data } = await callApi('/callback', {
    method: 'POST',
    body: JSON.stringify({
      phone: '+491701234567',
      reason: 'Test callback request',
      category: 'general',
    }),
  })

  const passed = (status === 200 || status === 201) && data.callbackId

  results.push({
    name: 'Request Callback',
    passed,
    details: `callbackId=${data.callbackId}`,
    error: passed ? undefined : `Status: ${status}, Data: ${JSON.stringify(data)}`,
  })

  // Verify in FHIR
  if (passed && data.callbackId) {
    const task = await queryFhir(`Task/${data.callbackId}`)
    const verified = task.resourceType === 'Task' && task.status === 'requested'
    results.push({
      name: 'Request Callback - FHIR Verification',
      passed: verified,
      details: `Task status: ${task.status}`,
      error: verified ? undefined : `Task not found or wrong status`,
    })
  }
}

// Test: Add to Urgent Queue
async function testAddToUrgentQueue() {
  const { status, data } = await callApi('/queue/urgent', {
    method: 'POST',
    body: JSON.stringify({
      patientId: 'patient-1',
      reason: 'Test urgent case',
      phone: '+491701234567',
    }),
  })

  const passed = (status === 200 || status === 201) && data.queueEntryId

  results.push({
    name: 'Add to Urgent Queue',
    passed,
    details: `queueEntryId=${data.queueEntryId}, position=${data.position}`,
    error: passed ? undefined : `Status: ${status}, Data: ${JSON.stringify(data)}`,
  })
}

// Test: Register Emergency Transfer
async function testRegisterEmergencyTransfer() {
  const { status, data } = await callApi('/queue/emergency', {
    method: 'POST',
    body: JSON.stringify({
      patientId: 'patient-1',
      phone: '+491701234567',
      reason: 'Test emergency - chest pain',
    }),
  })

  const passed = (status === 200 || status === 201) && data.transferId

  results.push({
    name: 'Register Emergency Transfer',
    passed,
    details: `transferId=${data.transferId}`,
    error: passed ? undefined : `Status: ${status}, Data: ${JSON.stringify(data)}`,
  })
}

// Test: Book Appointment
async function testBookAppointment() {
  // First get available slots
  const today = new Date().toISOString().slice(0, 10)
  const slotsRes = await callApi(`/appointments/slots?date=${today}&limit=1`)

  if (!slotsRes.data.slots || slotsRes.data.slots.length === 0) {
    results.push({
      name: 'Book Appointment',
      passed: false,
      details: 'No available slots to test with',
      error: 'Cannot test booking without slots',
    })
    return
  }

  const slot = slotsRes.data.slots[0]
  const { status, data } = await callApi('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      slotId: slot.slotId,
      patientId: 'patient-1',
      type: 'routine',
      reason: 'Test appointment',
    }),
  })

  const passed = (status === 200 || status === 201) && data.appointmentId

  results.push({
    name: 'Book Appointment',
    passed,
    details: `appointmentId=${data.appointmentId}`,
    error: passed ? undefined : `Status: ${status}, Data: ${JSON.stringify(data)}`,
  })

  // Clean up - cancel the appointment
  if (passed && data.appointmentId) {
    await callApi(`/appointments/${data.appointmentId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason: 'Test cleanup' }),
    })
  }
}

// Run all tests
async function runTests() {
  console.log('🏥 Backend Integration Tests\n')
  console.log(`API Base: ${API_BASE}`)
  console.log(`FHIR Base: ${FHIR_BASE}\n`)

  try {
    await testPatientLookupExisting()
    await testPatientLookupNonExisting()
    await testGetAvailableSlots()
    await testRequestCallback()
    await testAddToUrgentQueue()
    await testRegisterEmergencyTransfer()
    await testBookAppointment()
  } catch (error) {
    console.error('Test execution error:', error)
  }

  // Print results
  console.log('\n' + '='.repeat(60))
  console.log('RESULTS')
  console.log('='.repeat(60) + '\n')

  let passed = 0
  let failed = 0

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
    console.log(`   ${result.details}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    console.log()
    if (result.passed) passed++
    else failed++
  }

  console.log('='.repeat(60))
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
  console.log('='.repeat(60))

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
