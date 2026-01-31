import type { FHIRPatient } from './schemas'

/**
 * Dummy patient data for development/testing.
 * In production, this will be replaced by Aidbox FHIR queries.
 */
export const dummyPatients: FHIRPatient[] = [
  {
    resourceType: 'Patient',
    id: 'patient-1',
    identifier: [
      { system: 'http://ignis.hackathon/patients', value: 'PAT001' },
    ],
    active: true,
    name: [
      { use: 'official', family: 'Müller', given: ['Hans'] },
    ],
    telecom: [
      { system: 'phone', value: '+49 170 1234567', use: 'mobile' },
      { system: 'email', value: 'hans.mueller@example.com' },
    ],
    gender: 'male',
    birthDate: '1985-03-15',
    address: [
      { use: 'home', line: ['Musterstraße 42'], city: 'Hamburg', postalCode: '20095', country: 'DE' },
    ],
  },
  {
    resourceType: 'Patient',
    id: 'patient-2',
    identifier: [
      { system: 'http://ignis.hackathon/patients', value: 'PAT002' },
    ],
    active: true,
    name: [
      { use: 'official', family: 'Weber', given: ['Maria'] },
    ],
    telecom: [
      { system: 'phone', value: '+49 171 9876543', use: 'mobile' },
    ],
    gender: 'female',
    birthDate: '1972-08-22',
    address: [
      { use: 'home', line: ['Hauptstraße 10'], city: 'Hamburg', postalCode: '20099', country: 'DE' },
    ],
  },
  {
    resourceType: 'Patient',
    id: 'patient-3',
    identifier: [
      { system: 'http://ignis.hackathon/patients', value: 'PAT003' },
    ],
    active: true,
    name: [
      { use: 'official', family: 'Becker', given: ['Thomas'] },
    ],
    telecom: [
      { system: 'phone', value: '+49 172 5555555', use: 'mobile' },
    ],
    gender: 'male',
    birthDate: '1990-12-01',
  },
]

// In-memory storage for created/updated patients during development
const patientStore = new Map<string, FHIRPatient>(
  dummyPatients.map((p) => [p.id, p])
)

let nextPatientId = 4

/**
 * Normalize phone number for comparison (strip spaces, dashes).
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '')
}

/**
 * Get all patients.
 * 
 * TODO: Replace with Aidbox FHIR search:
 *   GET /fhir/Patient?_count=100
 */
export function getAllPatients(): Array<{
  id: string
  firstName: string
  lastName: string
  phone: string
  birthDate: string
  email?: string
  address?: string
  isReturning?: boolean
  urgency?: 'emergency' | 'urgent' | 'regular'
  flags?: string[]
  createdAt?: string
}> {
  const patients = Array.from(patientStore.values())
  
  return patients.map(p => ({
    id: p.id,
    firstName: p.name?.[0]?.given?.[0] ?? '',
    lastName: p.name?.[0]?.family ?? '',
    phone: p.telecom?.find(t => t.system === 'phone')?.value ?? '',
    birthDate: p.birthDate ?? '',
    email: p.telecom?.find(t => t.system === 'email')?.value,
    address: p.address?.[0]?.line?.join(', '),
    // Add mock urgency for demo
    urgency: p.id === 'patient-1' ? 'urgent' : 'regular',
    isReturning: true,
  }))
}

/**
 * Find a patient by phone and/or birthDate.
 * Returns the patient if exactly one match found, null otherwise.
 * 
 * TODO: Replace with Aidbox FHIR search:
 *   GET /fhir/Patient?telecom=phone|{phone}&birthdate={birthDate}
 */
export function findPatient(phone?: string, birthDate?: string): FHIRPatient | null {
  const patients = Array.from(patientStore.values())
  
  const matches = patients.filter((patient) => {
    let phoneMatch = true
    let birthDateMatch = true

    if (phone) {
      const normalizedSearch = normalizePhone(phone)
      const patientPhones = patient.telecom
        ?.filter((t) => t.system === 'phone')
        .map((t) => normalizePhone(t.value)) ?? []
      phoneMatch = patientPhones.some((p) => p.includes(normalizedSearch) || normalizedSearch.includes(p))
    }

    if (birthDate) {
      birthDateMatch = patient.birthDate === birthDate
    }

    return phoneMatch && birthDateMatch
  })

  // Return only if exactly one match (to avoid ambiguity)
  return matches.length === 1 ? matches[0] : null
}

/**
 * Get a patient by ID.
 * 
 * TODO: Replace with Aidbox FHIR read:
 *   GET /fhir/Patient/{id}
 */
export function getPatientById(id: string): FHIRPatient | null {
  return patientStore.get(id) ?? null
}

/**
 * Create or update a patient.
 * Returns the patient and whether it was created (true) or updated (false).
 * 
 * TODO: Replace with Aidbox FHIR create/update:
 *   POST /fhir/Patient (create)
 *   PUT /fhir/Patient/{id} (update)
 */
export function createOrUpdatePatient(data: {
  id?: string
  family: string
  given: string
  birthDate: string
  phone: string
  email?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  address?: {
    line?: string[]
    city?: string
    postalCode?: string
    country?: string
  }
}): { patient: FHIRPatient; created: boolean } {
  const isUpdate = Boolean(data.id && patientStore.has(data.id))
  const patientId = data.id ?? `patient-${nextPatientId++}`

  const telecom: FHIRPatient['telecom'] = [
    { system: 'phone', value: data.phone, use: 'mobile' },
  ]
  if (data.email) {
    telecom.push({ system: 'email', value: data.email })
  }

  const patient: FHIRPatient = {
    resourceType: 'Patient',
    id: patientId,
    identifier: [
      { system: 'http://ignis.hackathon/patients', value: `PAT${String(patientId).replace('patient-', '').padStart(3, '0')}` },
    ],
    active: true,
    name: [
      { use: 'official', family: data.family, given: [data.given] },
    ],
    telecom,
    gender: data.gender,
    birthDate: data.birthDate,
    address: data.address ? [{ use: 'home', ...data.address }] : undefined,
  }

  patientStore.set(patientId, patient)

  return { patient, created: !isUpdate }
}
