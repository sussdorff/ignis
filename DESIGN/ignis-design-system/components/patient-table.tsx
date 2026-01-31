"use client"

import { useRouter } from "next/navigation"
import { MoreHorizontal, Phone, FileText, Calendar } from "lucide-react"
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

interface Patient {
  id: string
  name: string
  initials: string
  geburtsdatum: string
  versicherung: string
  letzterBesuch: string
  status: "wartend" | "in-behandlung" | "abgeschlossen"
  triage?: "notfall" | "dringend" | "normal"
}

const patients: Patient[] = [
  {
    id: "1",
    name: "Anna Müller",
    initials: "AM",
    geburtsdatum: "15.03.1985",
    versicherung: "AOK Bayern",
    letzterBesuch: "Heute, 09:30",
    status: "wartend",
    triage: "dringend",
  },
  {
    id: "2",
    name: "Thomas Weber",
    initials: "TW",
    geburtsdatum: "22.07.1972",
    versicherung: "TK",
    letzterBesuch: "Heute, 10:00",
    status: "in-behandlung",
  },
  {
    id: "3",
    name: "Lisa Schneider",
    initials: "LS",
    geburtsdatum: "08.11.1990",
    versicherung: "Barmer",
    letzterBesuch: "Heute, 10:30",
    status: "wartend",
  },
  {
    id: "4",
    name: "Michael Becker",
    initials: "MB",
    geburtsdatum: "30.05.1968",
    versicherung: "DAK",
    letzterBesuch: "Heute, 11:00",
    status: "abgeschlossen",
  },
  {
    id: "5",
    name: "Sophie Klein",
    initials: "SK",
    geburtsdatum: "14.09.1995",
    versicherung: "AOK Nordost",
    letzterBesuch: "Gestern",
    status: "abgeschlossen",
  },
  {
    id: "6",
    name: "Hans Fischer",
    initials: "HF",
    geburtsdatum: "03.12.1958",
    versicherung: "TK",
    letzterBesuch: "25.01.2026",
    status: "abgeschlossen",
    triage: "notfall",
  },
]

function getStatusBadge(status: Patient["status"]) {
  switch (status) {
    case "wartend":
      return (
        <Badge variant="secondary" className="bg-warning/10 text-warning border-0">
          Wartend
        </Badge>
      )
    case "in-behandlung":
      return (
        <Badge variant="secondary" className="bg-info/10 text-info border-0">
          In Behandlung
        </Badge>
      )
    case "abgeschlossen":
      return (
        <Badge variant="secondary" className="bg-success/10 text-success border-0">
          Abgeschlossen
        </Badge>
      )
  }
}

function getTriageBadge(triage: Patient["triage"]) {
  if (!triage) return null
  
  switch (triage) {
    case "notfall":
      return (
        <Badge className="bg-destructive text-destructive-foreground">
          Notfall
        </Badge>
      )
    case "dringend":
      return (
        <Badge className="bg-warning text-warning-foreground">
          Dringend
        </Badge>
      )
    case "normal":
      return (
        <Badge variant="secondary">
          Normal
        </Badge>
      )
  }
}

export function PatientTable() {
  const router = useRouter()

  const handlePatientClick = (patientId: string) => {
    router.push(`/patient/${patientId}`)
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Patient</TableHead>
            <TableHead>Geburtsdatum</TableHead>
            <TableHead>Versicherung</TableHead>
            <TableHead>Letzter Besuch</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Triage</TableHead>
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
                {patient.versicherung}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {patient.letzterBesuch}
              </TableCell>
              <TableCell>{getStatusBadge(patient.status)}</TableCell>
              <TableCell>{getTriageBadge(patient.triage) || "—"}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Aktionen</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <FileText className="mr-2 size-4" />
                      Akte öffnen
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Calendar className="mr-2 size-4" />
                      Termin buchen
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Phone className="mr-2 size-4" />
                      Anrufen
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      Patient entfernen
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
