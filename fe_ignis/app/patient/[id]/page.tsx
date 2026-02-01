import { PatientProfileHeader } from "@/components/patient-profile-header"
import { MedicalHistory } from "@/components/medical-history"
import { VisitHistory } from "@/components/visit-history"
import { PatientDocuments } from "@/components/patient-documents"
import { PatientNotes } from "@/components/patient-notes"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Backend API base URL (server-side)
const API_BASE = process.env.BACKEND_URL || 'http://localhost:3000'

interface FHIRPatient {
  resourceType: 'Patient'
  id: string
  name?: Array<{ given?: string[]; family?: string }>
  birthDate?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  telecom?: Array<{ system?: string; value: string }>
  address?: Array<{ line?: string[]; city?: string; postalCode?: string }>
  identifier?: Array<{ system?: string; value: string }>
}

function formatGermanDate(isoDate: string): string {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  return `${day}.${month}.${year}`
}

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function transformPatient(fhir: FHIRPatient) {
  const fhirName = fhir.name?.[0]
  const firstName = fhirName?.given?.join(' ') ?? ''
  const lastName = fhirName?.family ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  const phoneContact = fhir.telecom?.find(t => t.system === 'phone')
  const emailContact = fhir.telecom?.find(t => t.system === 'email')
  
  const addr = fhir.address?.[0]
  const address = addr 
    ? [addr.line?.join(', '), addr.postalCode, addr.city].filter(Boolean).join(' ')
    : ''

  const insuranceId = fhir.identifier?.find(id => 
    id.system?.includes('insurance') || id.system?.includes('krankenkasse') || id.system?.includes('patients')
  )

  const genderMap: Record<string, string> = {
    male: 'Männlich',
    female: 'Weiblich',
    other: 'Divers',
    unknown: 'Unbekannt',
  }

  return {
    id: fhir.id,
    name: fullName,
    initials: getInitials(firstName, lastName),
    geburtsdatum: formatGermanDate(fhir.birthDate || ''),
    alter: fhir.birthDate ? calculateAge(fhir.birthDate) : 0,
    geschlecht: genderMap[fhir.gender || 'unknown'] || 'Unbekannt',
    versicherung: 'Gesetzlich versichert',
    versicherungsnummer: insuranceId?.value || 'Nicht angegeben',
    telefon: phoneContact?.value || 'Nicht angegeben',
    email: emailContact?.value || 'Nicht angegeben',
    adresse: address || 'Nicht angegeben',
  }
}

async function getPatient(id: string) {
  try {
    const response = await fetch(`${API_BASE}/api/patients`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    })
    if (!response.ok) return null
    
    const patients: FHIRPatient[] = await response.json()
    const patient = patients.find(p => p.id === id)
    if (!patient) return null
    
    return transformPatient(patient)
  } catch (err) {
    console.error('Failed to fetch patient:', err)
    return null
  }
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const patient = await getPatient(id)

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Patient nicht gefunden</h1>
          <p className="text-muted-foreground">
            Der Patient mit der ID {id} konnte nicht gefunden werden.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PatientProfileHeader patient={patient} />
      
      <div className="flex-1 p-6 overflow-auto">
        <Tabs defaultValue="uebersicht" className="space-y-6">
          <TabsList>
            <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
            <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
            <TabsTrigger value="besuche">Besuche</TabsTrigger>
            <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
            <TabsTrigger value="notizen">Notizen</TabsTrigger>
          </TabsList>

          <TabsContent value="uebersicht" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MedicalHistory patientId={patient.id} />
              <VisitHistory patientId={patient.id} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PatientDocuments patientId={patient.id} />
              <PatientNotes patientId={patient.id} />
            </div>
          </TabsContent>

          <TabsContent value="anamnese">
            <MedicalHistory patientId={patient.id} expanded />
          </TabsContent>

          <TabsContent value="besuche">
            <VisitHistory patientId={patient.id} expanded />
          </TabsContent>

          <TabsContent value="dokumente">
            <PatientDocuments patientId={patient.id} expanded />
          </TabsContent>

          <TabsContent value="notizen">
            <PatientNotes patientId={patient.id} expanded />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
