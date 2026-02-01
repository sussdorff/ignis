/**
 * Seed script to add 11 new patients with appointments for today
 * Run with: bun run scripts/seed-patients-today.ts
 */

import { fhirClient } from '../src/lib/fhir-client'
import { addToQueue, clearQueue, type QueueStatus, type Priority } from '../src/lib/waiting-queue'

// Get today's date in ISO format for appointments
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// Generate appointment times for today
function getAppointmentTime(index: number): { start: string; end: string } {
  const today = getTodayDate()
  const startHour = 8 + Math.floor(index / 2) // Start at 8:00, 2 appointments per hour
  const startMinute = (index % 2) * 30 // 00 or 30 minutes
  const endMinute = startMinute + 30
  
  const start = `${today}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00+01:00`
  const end = `${today}T${String(endMinute >= 60 ? startHour + 1 : startHour).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}:00+01:00`
  
  return { start, end }
}

// Patient data for 11 new patients
const newPatients = [
  { id: 'patient-10', family: 'Hoffmann', given: 'Sabine', gender: 'female' as const, birthDate: '1988-05-12', phone: '+49 173 1112233', reason: 'Kopfschmerzen', priority: 'normal' as Priority, status: 'wartend' as QueueStatus },
  { id: 'patient-11', family: 'Krause', given: 'Michael', gender: 'male' as const, birthDate: '1975-11-28', phone: '+49 174 2223344', reason: 'Rückenschmerzen', priority: 'dringend' as Priority, status: 'wartend' as QueueStatus },
  { id: 'patient-12', family: 'Richter', given: 'Claudia', gender: 'female' as const, birthDate: '1992-03-07', phone: '+49 175 3334455', reason: 'Hautausschlag', priority: 'normal' as Priority, status: 'erwartet' as QueueStatus },
  { id: 'patient-13', family: 'Braun', given: 'Wolfgang', gender: 'male' as const, birthDate: '1965-09-18', phone: '+49 176 4445566', reason: 'Blutdruckkontrolle', priority: 'normal' as Priority, status: 'wartend' as QueueStatus },
  { id: 'patient-14', family: 'Zimmermann', given: 'Lisa', gender: 'female' as const, birthDate: '1999-01-25', phone: '+49 177 5556677', reason: 'Halsschmerzen', priority: 'normal' as Priority, status: 'erwartet' as QueueStatus },
  { id: 'patient-15', family: 'Koch', given: 'Andreas', gender: 'male' as const, birthDate: '1982-07-14', phone: '+49 178 6667788', reason: 'Magenschmerzen', priority: 'dringend' as Priority, status: 'wartend' as QueueStatus },
  { id: 'patient-16', family: 'Lehmann', given: 'Petra', gender: 'female' as const, birthDate: '1970-12-03', phone: '+49 179 7778899', reason: 'Impfung', priority: 'normal' as Priority, status: 'erwartet' as QueueStatus },
  { id: 'patient-17', family: 'Schulze', given: 'Martin', gender: 'male' as const, birthDate: '1958-04-22', phone: '+49 170 8889900', reason: 'EKG-Kontrolle', priority: 'normal' as Priority, status: 'wartend' as QueueStatus },
  { id: 'patient-18', family: 'Werner', given: 'Karin', gender: 'female' as const, birthDate: '1995-08-09', phone: '+49 171 9990011', reason: 'Allergietest', priority: 'normal' as Priority, status: 'erwartet' as QueueStatus },
  { id: 'patient-19', family: 'Meyer', given: 'Frank', gender: 'male' as const, birthDate: '1980-02-17', phone: '+49 172 0001122', reason: 'Brustschmerzen', priority: 'notfall' as Priority, status: 'wartend' as QueueStatus },
  { id: 'patient-20', family: 'Neumann', given: 'Julia', gender: 'female' as const, birthDate: '1987-06-30', phone: '+49 173 1122334', reason: 'Laborergebnisse', priority: 'normal' as Priority, status: 'wartend' as QueueStatus },
]

const doctors = ['Dr. Schmidt', 'Dr. Müller', 'Dr. Weber']

async function seedPatientsAndAppointments() {
  console.log('🌱 Seeding 11 new patients with appointments for today...\n')
  
  const today = getTodayDate()
  console.log(`📅 Today's date: ${today}\n`)
  
  // First, clear existing queue and reinitialize
  clearQueue()
  console.log('🗑️  Cleared existing queue\n')
  
  for (let i = 0; i < newPatients.length; i++) {
    const patientData = newPatients[i]
    const { start, end } = getAppointmentTime(i)
    const doctor = doctors[i % doctors.length]
    
    try {
      // 1. Create/Update Patient in FHIR
      const patient = {
        resourceType: 'Patient',
        id: patientData.id,
        identifier: [
          {
            system: 'http://ignis.hackathon/patients',
            value: `PAT${String(10 + i).padStart(3, '0')}`
          }
        ],
        active: true,
        name: [
          {
            use: 'official',
            family: patientData.family,
            given: [patientData.given]
          }
        ],
        telecom: [
          {
            system: 'phone',
            value: patientData.phone,
            use: 'mobile'
          }
        ],
        gender: patientData.gender,
        birthDate: patientData.birthDate,
        address: [
          {
            use: 'home',
            line: [`Straße ${10 + i}`],
            city: 'Hamburg',
            postalCode: `200${90 + i}`,
            country: 'DE'
          }
        ]
      }
      
      await fhirClient.put(`Patient/${patientData.id}`, patient)
      console.log(`✅ Created patient: ${patientData.given} ${patientData.family} (${patientData.id})`)
      
      // 2. Create Appointment for today in FHIR
      const appointmentId = `appointment-today-${i + 1}`
      const appointment = {
        resourceType: 'Appointment',
        id: appointmentId,
        status: 'booked',
        serviceType: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/service-type',
                code: '124',
                display: 'General Practice'
              }
            ]
          }
        ],
        description: patientData.reason,
        start,
        end,
        participant: [
          {
            actor: {
              reference: `Patient/${patientData.id}`,
              display: `${patientData.given} ${patientData.family}`
            },
            status: 'accepted'
          },
          {
            actor: {
              reference: 'Practitioner/practitioner-1',
              display: doctor
            },
            status: 'accepted'
          }
        ]
      }
      
      await fhirClient.put(`Appointment/${appointmentId}`, appointment)
      console.log(`   📅 Created appointment: ${start.split('T')[1].slice(0, 5)} - ${patientData.reason}`)
      
      // 3. Add to waiting queue
      addToQueue({
        patientId: patientData.id,
        patientName: `${patientData.given} ${patientData.family}`,
        appointmentId,
        status: patientData.status,
        priority: patientData.priority,
        reason: patientData.reason,
        doctor,
      })
      console.log(`   🪑 Added to queue: ${patientData.status} (${patientData.priority})\n`)
      
    } catch (err) {
      console.error(`❌ Failed for ${patientData.given} ${patientData.family}:`, err)
    }
  }
  
  console.log('\n✨ Seeding complete!')
  console.log(`   • ${newPatients.length} patients created`)
  console.log(`   • ${newPatients.length} appointments for today`)
  console.log(`   • ${newPatients.length} queue entries added`)
}

// Run the seeding
seedPatientsAndAppointments()
  .then(() => {
    console.log('\n🎉 Done! Refresh the frontend to see the new patients.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('💥 Seeding failed:', err)
    process.exit(1)
  })
