"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Clock,
  AlertTriangle,
  User,
  Play,
  CheckCircle,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

type Priority = "notfall" | "dringend" | "normal"
type Status = "wartend" | "aufgerufen" | "in_behandlung"

interface WaitingPatient {
  id: string
  patientId: string
  name: string
  initials: string
  birthDate: string
  reason: string
  priority: Priority
  status: Status
  arrivalTime: string
  waitTime: number
  appointmentTime?: string
  room?: string
  doctor?: string
}

const initialPatients: WaitingPatient[] = [
  {
    id: "w1",
    patientId: "1",
    name: "Hans Weber",
    initials: "HW",
    birthDate: "15.03.1958",
    reason: "Brustschmerzen, Atemnot",
    priority: "notfall",
    status: "aufgerufen",
    arrivalTime: "08:45",
    waitTime: 5,
    room: "Raum 1",
    doctor: "Dr. Schmidt",
  },
  {
    id: "w2",
    patientId: "3",
    name: "Peter Bauer",
    initials: "PB",
    birthDate: "22.11.1975",
    reason: "Starke Kopfschmerzen seit 3 Tagen",
    priority: "dringend",
    status: "wartend",
    arrivalTime: "08:30",
    waitTime: 20,
  },
  {
    id: "w3",
    patientId: "2",
    name: "Anna Müller",
    initials: "AM",
    birthDate: "08.07.1985",
    reason: "Kontrolluntersuchung Blutdruck",
    priority: "normal",
    status: "wartend",
    arrivalTime: "08:15",
    waitTime: 35,
    appointmentTime: "09:00",
  },
  {
    id: "w4",
    patientId: "4",
    name: "Maria Fischer",
    initials: "MF",
    birthDate: "30.04.1990",
    reason: "Grippesymptome, Fieber",
    priority: "normal",
    status: "wartend",
    arrivalTime: "08:40",
    waitTime: 10,
    appointmentTime: "09:15",
  },
  {
    id: "w5",
    patientId: "5",
    name: "Klaus Hoffmann",
    initials: "KH",
    birthDate: "12.09.1962",
    reason: "Nachsorge Operation",
    priority: "normal",
    status: "in_behandlung",
    arrivalTime: "08:00",
    waitTime: 0,
    room: "Raum 2",
    doctor: "Dr. Weber",
  },
]

const priorityConfig = {
  notfall: {
    label: "Notfall",
    className: "bg-destructive text-destructive-foreground",
    barColor: "bg-destructive",
  },
  dringend: {
    label: "Dringend",
    className: "bg-warning text-warning-foreground",
    barColor: "bg-warning",
  },
  normal: {
    label: "Normal",
    className: "bg-secondary text-secondary-foreground",
    barColor: "bg-muted",
  },
}

const statusConfig = {
  wartend: {
    label: "Wartend",
    className: "bg-muted text-muted-foreground",
  },
  aufgerufen: {
    label: "Aufgerufen",
    className: "bg-info text-info-foreground",
  },
  in_behandlung: {
    label: "In Behandlung",
    className: "bg-success text-success-foreground",
  },
}

export default function WartezimmerPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<WaitingPatient[]>(initialPatients)

  // Sort by priority, then wait time
  const sortedPatients = [...patients].sort((a, b) => {
    const priorityOrder = { notfall: 0, dringend: 1, normal: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return b.waitTime - a.waitTime
  })

  const waitingCount = patients.filter((p) => p.status === "wartend").length
  const inTreatmentCount = patients.filter((p) => p.status === "in_behandlung").length
  const urgentCount = patients.filter((p) => p.priority === "notfall" || p.priority === "dringend").length
  const avgWaitTime = Math.round(
    patients.filter((p) => p.status === "wartend").reduce((acc, p) => acc + p.waitTime, 0) / 
    Math.max(waitingCount, 1)
  )

  const handlePatientClick = (patientId: string) => {
    router.push(`/patient/${patientId}`)
  }

  // Single-tap status progression: wartend -> aufgerufen -> in_behandlung -> complete
  const progressStatus = (patient: WaitingPatient) => {
    if (patient.status === "wartend") {
      setPatients(prev => prev.map(p => 
        p.id === patient.id 
          ? { ...p, status: "aufgerufen" as Status, room: "Raum 1", doctor: "Dr. Schmidt" }
          : p
      ))
    } else if (patient.status === "aufgerufen") {
      setPatients(prev => prev.map(p => 
        p.id === patient.id ? { ...p, status: "in_behandlung" as Status } : p
      ))
    } else if (patient.status === "in_behandlung") {
      setPatients(prev => prev.filter(p => p.id !== patient.id))
    }
  }

  // Tap on priority badge cycles priority
  const cyclePriority = (e: React.MouseEvent, patient: WaitingPatient) => {
    e.stopPropagation()
    const order: Priority[] = ["normal", "dringend", "notfall"]
    const currentIndex = order.indexOf(patient.priority)
    const nextPriority = order[(currentIndex + 1) % order.length]
    setPatients(prev => prev.map(p => 
      p.id === patient.id ? { ...p, priority: nextPriority } : p
    ))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - minimal */}
      <header className="flex h-14 items-center gap-4 bg-card px-6">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">Wartezimmer</h1>
        </div>
        <Badge variant="outline" className="ml-auto gap-1">
          <span className="size-2 rounded-full bg-success animate-pulse" />
          Live
        </Badge>
      </header>

      {/* Compact stats row */}
      <div className="flex items-center gap-6 px-6 py-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Wartend:</span>
          <span className="font-semibold text-lg">{waitingCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">In Behandlung:</span>
          <span className="font-semibold text-lg">{inTreatmentCount}</span>
        </div>
        {urgentCount > 0 && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            <span className="font-semibold">{urgentCount} dringend</span>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-muted-foreground">Ø Wartezeit:</span>
          <span className="font-semibold">{avgWaitTime} min</span>
        </div>
      </div>

      {/* Patient Queue - streamlined */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Warteschlange</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-muted/30">
              {sortedPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors group"
                >
                  {/* Priority indicator bar */}
                  <div className={`w-1 self-stretch rounded-full ${priorityConfig[patient.priority].barColor}`} />

                  {/* Patient info - tap opens profile */}
                  <button
                    type="button"
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => handlePatientClick(patient.patientId)}
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {patient.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate group-hover:text-primary transition-colors">
                        {patient.name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {patient.reason}
                      </p>
                    </div>
                  </button>

                  {/* Wait time - prominent for waiting patients */}
                  <div className="w-20 text-center shrink-0">
                    {patient.status === "wartend" ? (
                      <div className={`text-xl font-semibold ${
                        patient.waitTime > 30 ? "text-destructive" : 
                        patient.waitTime > 15 ? "text-warning" : "text-foreground"
                      }`}>
                        {patient.waitTime}m
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">{patient.room}</div>
                    )}
                  </div>

                  {/* Priority badge - tap to cycle */}
                  <button
                    type="button"
                    onClick={(e) => cyclePriority(e, patient)}
                    className="shrink-0"
                  >
                    <Badge className={`${priorityConfig[patient.priority].className} cursor-pointer hover:opacity-80 transition-opacity`}>
                      {patient.priority === "notfall" && <AlertTriangle className="size-3 mr-1" />}
                      {priorityConfig[patient.priority].label}
                    </Badge>
                  </button>

                  {/* Status badge */}
                  <Badge className={`${statusConfig[patient.status].className} shrink-0`}>
                    {statusConfig[patient.status].label}
                  </Badge>

                  {/* Single action button - progresses status */}
                  <button
                    type="button"
                    onClick={() => progressStatus(patient)}
                    className={`size-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      patient.status === "wartend" 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : patient.status === "aufgerufen"
                        ? "bg-info/10 text-info hover:bg-info/20"
                        : "bg-success/10 text-success hover:bg-success/20"
                    }`}
                    title={
                      patient.status === "wartend" ? "Aufrufen" :
                      patient.status === "aufgerufen" ? "Behandlung starten" :
                      "Abschließen"
                    }
                  >
                    {patient.status === "wartend" && <Play className="size-5" />}
                    {patient.status === "aufgerufen" && <User className="size-5" />}
                    {patient.status === "in_behandlung" && <CheckCircle className="size-5" />}
                  </button>
                </div>
              ))}

              {patients.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <Clock className="size-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Wartezimmer leer</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
