/**
 * API Client for Ignis Backend
 * Handles all HTTP requests to /api endpoints
 */

const API_BASE = '/api'

export interface Patient {
  id: string
  firstName: string
  lastName: string
  phone: string
  birthDate: string
  email?: string
  address?: string
  insuranceNumber?: string
  isReturning?: boolean
  urgency?: 'emergency' | 'urgent' | 'regular'
  flags?: string[]
  createdAt?: string
}

export interface Appointment {
  id: string
  patientId: string
  practitionerId: string
  start: string
  end: string
  status: 'booked' | 'arrived' | 'in-progress' | 'completed' | 'cancelled'
  type?: string
  reason?: string
}

/**
 * Fetch all patients
 */
export async function getPatients(): Promise<Patient[]> {
  const response = await fetch(`${API_BASE}/patients`)
  if (!response.ok) throw new Error('Failed to fetch patients')
  return response.json()
}

/**
 * Get patient by ID
 */
export async function getPatient(id: string): Promise<Patient> {
  const response = await fetch(`${API_BASE}/patients/${id}`)
  if (!response.ok) throw new Error('Failed to fetch patient')
  return response.json()
}

/**
 * Lookup patient by phone and birthdate
 */
export async function lookupPatient(phone: string, birthDate: string): Promise<Patient | null> {
  const response = await fetch(`${API_BASE}/patients/lookup?phone=${encodeURIComponent(phone)}&birthDate=${birthDate}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Failed to lookup patient')
  return response.json()
}

/**
 * Create new patient
 */
export async function createPatient(patient: Omit<Patient, 'id'>): Promise<Patient> {
  const response = await fetch(`${API_BASE}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patient),
  })
  if (!response.ok) throw new Error('Failed to create patient')
  return response.json()
}

/**
 * Get all appointments
 */
export async function getAppointments(): Promise<Appointment[]> {
  const response = await fetch(`${API_BASE}/appointments`)
  if (!response.ok) throw new Error('Failed to fetch appointments')
  return response.json()
}

/**
 * Get urgent queue (patients with urgency=urgent or emergency)
 */
export async function getUrgentQueue(): Promise<Patient[]> {
  const patients = await getPatients()
  return patients.filter(p => p.urgency === 'urgent' || p.urgency === 'emergency')
}

/**
 * Get emergency alerts (patients with urgency=emergency)
 */
export async function getEmergencyAlerts(): Promise<Patient[]> {
  const patients = await getPatients()
  return patients.filter(p => p.urgency === 'emergency')
}
