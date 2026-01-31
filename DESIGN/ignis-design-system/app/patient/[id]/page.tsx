import { PatientProfileHeader } from "@/components/patient-profile-header"
import { MedicalHistory } from "@/components/medical-history"
import { VisitHistory } from "@/components/visit-history"
import { PatientDocuments } from "@/components/patient-documents"
import { PatientNotes } from "@/components/patient-notes"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock patient data - in production this would come from a database
const patientsData: Record<string, {
  id: string
  name: string
  initials: string
  geburtsdatum: string
  alter: number
  geschlecht: string
  versicherung: string
  versicherungsnummer: string
  telefon: string
  email: string
  adresse: string
  triage?: "notfall" | "dringend" | "normal"
  allergien?: string[]
}> = {
  "1": {
    id: "1",
    name: "Anna Müller",
    initials: "AM",
    geburtsdatum: "15.03.1985",
    alter: 40,
    geschlecht: "Weiblich",
    versicherung: "AOK Bayern",
    versicherungsnummer: "A123456789",
    telefon: "+49 89 123 4567",
    email: "anna.mueller@email.de",
    adresse: "Maximilianstraße 12, 80539 München",
    triage: "dringend",
    allergien: ["Penicillin", "Nüsse"],
  },
  "2": {
    id: "2",
    name: "Thomas Weber",
    initials: "TW",
    geburtsdatum: "22.07.1972",
    alter: 53,
    geschlecht: "Männlich",
    versicherung: "TK",
    versicherungsnummer: "T987654321",
    telefon: "+49 89 234 5678",
    email: "t.weber@email.de",
    adresse: "Leopoldstraße 45, 80802 München",
  },
  "3": {
    id: "3",
    name: "Lisa Schneider",
    initials: "LS",
    geburtsdatum: "08.11.1990",
    alter: 35,
    geschlecht: "Weiblich",
    versicherung: "Barmer",
    versicherungsnummer: "B456123789",
    telefon: "+49 89 345 6789",
    email: "lisa.schneider@email.de",
    adresse: "Sendlinger Straße 78, 80331 München",
  },
  "4": {
    id: "4",
    name: "Michael Becker",
    initials: "MB",
    geburtsdatum: "30.05.1968",
    alter: 57,
    geschlecht: "Männlich",
    versicherung: "DAK",
    versicherungsnummer: "D789456123",
    telefon: "+49 89 456 7890",
    email: "m.becker@email.de",
    adresse: "Schwabing-West 23, 80796 München",
    allergien: ["Latex"],
  },
  "5": {
    id: "5",
    name: "Sophie Klein",
    initials: "SK",
    geburtsdatum: "14.09.1995",
    alter: 30,
    geschlecht: "Weiblich",
    versicherung: "AOK Nordost",
    versicherungsnummer: "A321654987",
    telefon: "+49 89 567 8901",
    email: "sophie.klein@email.de",
    adresse: "Isarvorstadt 56, 80469 München",
  },
  "6": {
    id: "6",
    name: "Hans Fischer",
    initials: "HF",
    geburtsdatum: "03.12.1958",
    alter: 67,
    geschlecht: "Männlich",
    versicherung: "TK",
    versicherungsnummer: "T654987321",
    telefon: "+49 89 678 9012",
    email: "h.fischer@email.de",
    adresse: "Bogenhausen 89, 81675 München",
    triage: "notfall",
    allergien: ["Aspirin", "Ibuprofen"],
  },
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const patient = patientsData[id]

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
