"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Phone, FileText, Calendar, Loader2, Users } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getPatients, type FHIRPatient } from "@/lib/api"

interface Patient {
  id: string
  name: string
  initials: string
  geburtsdatum: string
  gender: string
}

function formatGermanDate(isoDate?: string): string {
  if (!isoDate) return '—'
  const [year, month, day] = isoDate.split('-')
  return `${day}.${month}.${year}`
}

function getInitials(firstName: string, lastName: string): string {
  const first = firstName.charAt(0) || ''
  const last = lastName.charAt(0) || ''
  return `${first}${last}`.toUpperCase() || '??'
}

function transformPatient(fhir: FHIRPatient): Patient {
  const fhirName = fhir.name?.[0]
  const firstName = fhirName?.given?.join(' ') ?? ''
  const lastName = fhirName?.family ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unbekannt'
  
  const genderMap: Record<string, string> = {
    male: 'Männlich',
    female: 'Weiblich',
    other: 'Divers',
    unknown: 'Unbekannt',
  }

  return {
    id: fhir.id || '',
    name: fullName,
    initials: getInitials(firstName, lastName),
    geburtsdatum: formatGermanDate(fhir.birthDate),
    gender: genderMap[fhir.gender || 'unknown'] || 'Unbekannt',
  }
}

export function PatientTable() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPatients = useCallback(async () => {
    try {
      const data = await getPatients()
      setPatients(data.map(transformPatient))
      setError(null)
    } catch (err) {
      console.error('Failed to fetch patients:', err)
      setError('Fehler beim Laden der Patienten')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  const handlePatientClick = (patientId: string) => {
    router.push(`/patient/${patientId}`)
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Lade Patienten...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <div className="flex flex-col items-center justify-center text-destructive">
          <p>{error}</p>
          <button 
            type="button"
            onClick={() => { setLoading(true); fetchPatients(); }}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  if (patients.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <div className="flex flex-col items-center justify-center text-muted-foreground">
          <Users className="size-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Keine Patienten gefunden</p>
          <p className="text-sm">Es sind noch keine Patienten im System registriert.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Patient</TableHead>
            <TableHead>Geburtsdatum</TableHead>
            <TableHead>Geschlecht</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow 
              key={patient.id} 
              className="group cursor-pointer"
              onClick={() => handlePatientClick(patient.id)}
            >
              <TableCell className="pl-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {patient.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{patient.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {patient.geburtsdatum}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {patient.gender}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Aktionen</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePatientClick(patient.id); }}>
                      <FileText className="mr-2 size-4" />
                      Akte öffnen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/termine'); }}>
                      <Calendar className="mr-2 size-4" />
                      Termin buchen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                      <Phone className="mr-2 size-4" />
                      Anrufen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
