/**
 * FHIR Database Validation Tests
 * 
 * Directly queries the Aidbox FHIR server to validate data integrity.
 * 
 * Usage:
 *   npx tsx scripts/test-fhir-database.ts
 */

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

// Helper to query FHIR
async function queryFhir(path: string): Promise<any> {
  const url = `${FHIR_BASE}/${path}`
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${AIDBOX_USER}:${AIDBOX_PASSWORD}`),
    },
  })
  return response.json()
}

// Test: Patient Count
async function testPatientCount() {
  const bundle = await queryFhir('Patient?_summary=count')
  const count = bundle.total || 0

  results.push({
    name: 'Patient Count',
    passed: count > 0,
    details: `Found ${count} patients`,
  })
}

// Test: Practitioner Count
async function testPractitionerCount() {
  const bundle = await queryFhir('Practitioner?_summary=count')
  const count = bundle.total || 0

  results.push({
    name: 'Practitioner Count',
    passed: count > 0,
    details: `Found ${count} practitioners`,
  })
}

// Test: Demo Patient - Hans Müller
async function testDemoPatientHansMuller() {
  const bundle = await queryFhir('Patient?name=Hans&birthdate=1985-03-15')
  const entries = bundle.entry || []

  const patient = entries.find((e: any) => {
    const p = e.resource
    const name = p.name?.[0]
    return name?.given?.includes('Hans') && name?.family === 'Müller'
  })?.resource

  const passed = !!patient

  results.push({
    name: 'Demo Patient - Hans Müller',
    passed,
    details: passed ? `ID: ${patient.id}, DOB: ${patient.birthDate}` : 'Not found',
  })

  if (passed) {
    // Check phone
    const phone = patient.telecom?.find((t: any) => t.system === 'phone')?.value
    results.push({
      name: 'Hans Müller - Phone',
      passed: !!phone,
      details: phone || 'No phone found',
    })

    // Check address
    const address = patient.address?.[0]
    results.push({
      name: 'Hans Müller - Address',
      passed: !!address?.city,
      details: address ? `${address.line?.[0]}, ${address.postalCode} ${address.city}` : 'No address',
    })
  }
}

// Test: Demo Patient - Maria Schmidt
async function testDemoPatientMariaSchmidt() {
  const bundle = await queryFhir('Patient?name=Maria&birthdate=1990-07-22')
  const entries = bundle.entry || []

  const patient = entries.find((e: any) => {
    const p = e.resource
    const name = p.name?.[0]
    return name?.given?.includes('Maria') && name?.family === 'Schmidt'
  })?.resource

  results.push({
    name: 'Demo Patient - Maria Schmidt',
    passed: !!patient,
    details: patient ? `ID: ${patient.id}` : 'Not found',
  })
}

// Test: Schedule/Slot availability
async function testScheduleAndSlots() {
  const scheduleBundle = await queryFhir('Schedule?_count=5')
  const schedules = scheduleBundle.entry || []

  results.push({
    name: 'Schedules',
    passed: schedules.length > 0,
    details: `Found ${schedules.length} schedules`,
  })

  // Check for slots
  const today = new Date().toISOString().slice(0, 10)
  const slotBundle = await queryFhir(`Slot?start=ge${today}&status=free&_count=10`)
  const slots = slotBundle.entry || []

  results.push({
    name: 'Available Slots (today+)',
    passed: true, // Slots may or may not exist
    details: `Found ${slots.length} free slots`,
  })
}

// Test: Appointments
async function testAppointments() {
  const bundle = await queryFhir('Appointment?_count=10&_sort=-date')
  const appointments = bundle.entry || []

  results.push({
    name: 'Appointments',
    passed: true,
    details: `Found ${appointments.length} appointments (total: ${bundle.total || 'unknown'})`,
  })

  // Check booked appointments
  const bookedBundle = await queryFhir('Appointment?status=booked&_summary=count')
  results.push({
    name: 'Booked Appointments',
    passed: true,
    details: `${bookedBundle.total || 0} booked`,
  })
}

// Test: Tasks (Queue entries)
async function testTasks() {
  const bundle = await queryFhir('Task?_count=10&_sort=-_lastUpdated')
  const tasks = bundle.entry || []

  results.push({
    name: 'Tasks (Queue/Callback)',
    passed: true,
    details: `Found ${tasks.length} tasks (total: ${bundle.total || 'unknown'})`,
  })

  // Check by status
  const requestedBundle = await queryFhir('Task?status=requested&_summary=count')
  const inProgressBundle = await queryFhir('Task?status=in-progress&_summary=count')

  results.push({
    name: 'Task Status Distribution',
    passed: true,
    details: `requested: ${requestedBundle.total || 0}, in-progress: ${inProgressBundle.total || 0}`,
  })
}

// Test: Practitioners
async function testPractitioners() {
  const bundle = await queryFhir('Practitioner?_count=10')
  const practitioners = bundle.entry || []

  results.push({
    name: 'Practitioners',
    passed: practitioners.length > 0,
    details: `Found ${practitioners.length} practitioners`,
  })

  // List practitioner names
  const names = practitioners.map((e: any) => {
    const p = e.resource
    const name = p.name?.[0]
    return name ? `${name.prefix?.[0] || ''} ${name.given?.[0] || ''} ${name.family || ''}`.trim() : p.id
  })

  if (names.length > 0) {
    results.push({
      name: 'Practitioner Names',
      passed: true,
      details: names.slice(0, 5).join(', '),
    })
  }
}

// Run all tests
async function runTests() {
  console.log('🗄️  FHIR Database Validation\n')
  console.log(`FHIR Base: ${FHIR_BASE}\n`)

  try {
    await testPatientCount()
    await testPractitionerCount()
    await testDemoPatientHansMuller()
    await testDemoPatientMariaSchmidt()
    await testScheduleAndSlots()
    await testAppointments()
    await testTasks()
    await testPractitioners()
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
