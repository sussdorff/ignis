import { describe, it, expect } from 'bun:test'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

interface FHIRPatient {
  resourceType: 'Patient'
  id: string
  name?: Array<{ family?: string; given?: string[] }>
}

function isFHIRPatient(obj: unknown): obj is FHIRPatient {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as { resourceType?: string }).resourceType === 'Patient' &&
    typeof (obj as { id?: string }).id === 'string'
  )
}

describe('Patients API (Aidbox)', () => {
  it('GET /api/patients lists all patients as FHIR resources', async () => {
    const res = await fetch(`${BASE}/api/patients`)
    expect(res.ok).toBe(true)

    const data = await res.json() as unknown[]
    expect(Array.isArray(data)).toBe(true)

    for (const item of data) {
      expect(isFHIRPatient(item)).toBe(true)
    }
  })

  it('GET /api/patients/lookup by birthDate returns patient info', async () => {
    const res = await fetch(`${BASE}/api/patients/lookup?birthDate=1985-03-15`)
    expect(res.ok).toBe(true)

    const data = await res.json() as {
      patient: unknown
      found: boolean
      patientId?: string
      patientName?: string
    }
    expect(typeof data.found).toBe('boolean')

    if (data.found) {
      expect(isFHIRPatient(data.patient)).toBe(true)
      expect(typeof data.patientId).toBe('string')
      expect(typeof data.patientName).toBe('string')
    }
  })

  it('GET /api/patients/lookup by name finds patient', async () => {
    const res = await fetch(`${BASE}/api/patients/lookup?name=Müller`)
    expect(res.ok).toBe(true)

    const data = await res.json() as {
      patient: unknown
      found: boolean
      patientId?: string
      patientName?: string
    }
    expect(data.found).toBe(true)
    expect(isFHIRPatient(data.patient)).toBe(true)
    expect(data.patientId).toBe('patient-1')
    expect(data.patientName).toBeDefined()
    expect(data.patientName!.length).toBeGreaterThan(0)
  })

  it('GET /api/patients/lookup without params returns 400', async () => {
    const res = await fetch(`${BASE}/api/patients/lookup`)
    expect(res.status).toBe(400)
  })

  it('POST /api/patients creates new patient', async () => {
    const res = await fetch(`${BASE}/api/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        family: 'Test',
        given: 'Route',
        birthDate: '1990-01-01',
        phone: '+49 999 8887777',
      }),
    })
    expect(res.status).toBe(201)

    const data = await res.json() as { patient: unknown; created: boolean }
    expect(data.created).toBe(true)
    expect(isFHIRPatient(data.patient)).toBe(true)
  })

  it('POST /api/patients updates existing patient', async () => {
    const res = await fetch(`${BASE}/api/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'patient-1',
        family: 'Müller',
        given: 'Hans',
        birthDate: '1985-03-15',
        phone: '+49 170 1234567',
      }),
    })
    expect(res.ok).toBe(true)

    const data = await res.json() as { patient: unknown; created: boolean }
    expect(data.created).toBe(false)
    expect(isFHIRPatient(data.patient)).toBe(true)
  })

  it('POST /api/patients with nonexistent id returns 404', async () => {
    const res = await fetch(`${BASE}/api/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'nonexistent-patient-id-xyz',
        family: 'X',
        given: 'Y',
        birthDate: '2000-01-01',
        phone: '+49 111',
      }),
    })
    expect(res.status).toBe(404)
  })
})
