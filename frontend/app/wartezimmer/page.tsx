"use client"

import React, { useEffect, useCallback } from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Clock,
  AlertTriangle,
  User,
  Play,
  CheckCircle,
  Loader2,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { QuestionnaireStatusBadge } from "@/components/questionnaire-status-badge"
import {
  getQueue,
  updateQueueEntry,
  finishQueueEntry,
  type QueueEntry,
  type QueueStatus as APIQueueStatus,
  type Priority as APIPriority
} from "@/lib/api"

type Priority = "notfall" | "dringend" | "normal"
type Status = "wartend" | "aufgerufen" | "in_behandlung"
type FilterType = "alle" | "dringend" | "aufgerufen"
type ViewMode = "list" | "rooms"

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

// Transform API queue entry to frontend WaitingPatient format
function transformQueueEntry(entry: QueueEntry): WaitingPatient {
  const name = entry.patientName
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  
  // Calculate wait time in minutes
  let waitTime = 0
  if (entry.arrivalTime) {
    const arrivalDate = new Date(entry.arrivalTime)
    waitTime = Math.floor((Date.now() - arrivalDate.getTime()) / 60000)
  } else if (entry.createdAt) {
    const createdDate = new Date(entry.createdAt)
    waitTime = Math.floor((Date.now() - createdDate.getTime()) / 60000)
  }
  
  // Map status - filter out 'erwartet' and 'fertig' since UI doesn't show them
  let status: Status = 'wartend'
  if (entry.status === 'aufgerufen') status = 'aufgerufen'
  else if (entry.status === 'in_behandlung') status = 'in_behandlung'
  
  // Map priority
  let priority: Priority = 'normal'
  if (entry.priority === 'notfall') priority = 'notfall'
  else if (entry.priority === 'dringend') priority = 'dringend'
  
  return {
    id: entry.id,
    patientId: entry.patientId,
    name,
    initials,
    birthDate: '', // Not available from queue API
    reason: entry.reason || '',
    priority,
    status,
    arrivalTime: entry.arrivalTime ? new Date(entry.arrivalTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
    waitTime: Math.max(0, waitTime),
    room: entry.room,
    doctor: entry.doctor,
  }
}

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

const rooms = ["Raum 1", "Raum 2", "Raum 3"]

export default function WartezimmerPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<WaitingPatient[]>([])
  const [filter, setFilter] = useState<FilterType>("alle")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch queue data from API
  const fetchQueue = useCallback(async () => {
    try {
      const data = await getQueue()
      // Filter out 'erwartet' and 'fertig' entries - only show active patients
      const activeEntries = data.queue.filter(e => 
        e.status === 'wartend' || e.status === 'aufgerufen' || e.status === 'in_behandlung'
      )
      setPatients(activeEntries.map(transformQueueEntry))
      setError(null)
    } catch (err) {
      console.error('Failed to fetch queue:', err)
      setError('Fehler beim Laden der Warteschlange')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch and polling
  useEffect(() => {
    fetchQueue()
    // Poll every 10 seconds for updates
    const interval = setInterval(fetchQueue, 10000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  // Filter patients based on selected filter
  const filteredPatients = patients.filter((p) => {
    if (filter === "dringend") return p.priority === "notfall"
    if (filter === "aufgerufen") return p.status === "aufgerufen"
    return true
  })

  // Sort by priority, then wait time
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const priorityOrder = { notfall: 0, dringend: 1, normal: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return b.waitTime - a.waitTime
  })

  // Group patients by room for room view
  const patientsByRoom = rooms.reduce((acc, room) => {
    acc[room] = patients.filter((p) => p.room === room && (p.status === "aufgerufen" || p.status === "in_behandlung"))
    return acc
  }, {} as Record<string, WaitingPatient[]>)

  const waitingPatients = patients.filter((p) => p.status === "wartend")

  const waitingCount = patients.filter((p) => p.status === "wartend").length
  const inTreatmentCount = patients.filter((p) => p.status === "in_behandlung").length
  const urgentCount = patients.filter((p) => p.priority === "notfall").length
  const aufgerufenCount = patients.filter((p) => p.status === "aufgerufen").length
  const avgWaitTime = Math.round(
    patients.filter((p) => p.status === "wartend").reduce((acc, p) => acc + p.waitTime, 0) / 
    Math.max(waitingCount, 1)
  )

  const handlePatientClick = (patientId: string) => {
    router.push(`/patient/${patientId}`)
  }

  // Single-tap status progression: wartend -> aufgerufen -> in_behandlung -> complete
  const progressStatus = async (patient: WaitingPatient) => {
    try {
      if (patient.status === "wartend") {
        // Assign to first available room
        const usedRooms = patients.filter(p => p.room && p.status !== "wartend").map(p => p.room)
        const availableRoom = rooms.find(r => !usedRooms.includes(r)) || "Raum 1"
        
        // Optimistic update
        setPatients(prev => prev.map(p => 
          p.id === patient.id 
            ? { ...p, status: "aufgerufen" as Status, room: availableRoom }
            : p
        ))
        
        // Update backend
        await updateQueueEntry(patient.id, { status: 'aufgerufen', room: availableRoom })
      } else if (patient.status === "aufgerufen") {
        // Optimistic update
        setPatients(prev => prev.map(p => 
          p.id === patient.id ? { ...p, status: "in_behandlung" as Status } : p
        ))
        
        // Update backend
        await updateQueueEntry(patient.id, { status: 'in_behandlung' })
      } else if (patient.status === "in_behandlung") {
        // Optimistic update
        setPatients(prev => prev.filter(p => p.id !== patient.id))
        
        // Finish on backend (marks as 'fertig')
        await finishQueueEntry(patient.id)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
      // Refresh to get correct state
      fetchQueue()
    }
  }

  // Tap on priority badge cycles priority
  const cyclePriority = async (e: React.MouseEvent, patient: WaitingPatient) => {
    e.stopPropagation()
    const order: Priority[] = ["normal", "dringend", "notfall"]
    const currentIndex = order.indexOf(patient.priority)
    const nextPriority = order[(currentIndex + 1) % order.length]
    
    // Optimistic update
    setPatients(prev => prev.map(p => 
      p.id === patient.id ? { ...p, priority: nextPriority } : p
    ))
    
    try {
      // Update backend
      await updateQueueEntry(patient.id, { priority: nextPriority as APIPriority })
    } catch (err) {
      console.error('Failed to update priority:', err)
      // Refresh to get correct state
      fetchQueue()
    }
  }

  const PatientRow = ({ patient }: { patient: WaitingPatient }) => (
    <div
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
          {patient.doctor && (
            <p className="text-sm text-muted-foreground">
              Behandelnde Person: <span className="font-medium text-foreground">{patient.doctor}</span>
            </p>
          )}
        </div>
      </button>

      {/* Questionnaire status */}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <QuestionnaireStatusBadge patientId={patient.patientId} compact />
      </div>

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
  )

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

      {/* View mode and Filter tabs */}
      <div className="flex items-center gap-4 px-6 pb-4">
        {/* View mode toggle */}
        <div className="flex gap-2 bg-secondary/30 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "list"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Liste
          </button>
          <button
            type="button"
            onClick={() => setViewMode("rooms")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "rooms"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Nach Raum
          </button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Filter buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("alle")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === "alle"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}
          >
            Alle ({patients.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("dringend")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === "dringend"
                ? "bg-destructive text-destructive-foreground"
                : "bg-destructive/10 text-destructive hover:bg-destructive/20"
            }`}
          >
            Dringend ({urgentCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("aufgerufen")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === "aufgerufen"
                ? "bg-info text-info-foreground"
                : "bg-info/10 text-info hover:bg-info/20"
            }`}
          >
            Aufgerufen ({aufgerufenCount})
          </button>
        </div>
      </div>

      {/* Patient Queue */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Lade Warteschlange...</span>
          </div>
        )}
        
        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertTriangle className="size-12 mb-4" />
            <p className="text-lg font-medium">{error}</p>
            <button 
              type="button"
              onClick={() => { setLoading(true); fetchQueue(); }}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Erneut versuchen
            </button>
          </div>
        )}
        
        {!loading && !error && viewMode === "list" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Warteschlange</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-muted/30">
                {sortedPatients.map((patient) => (
                  <PatientRow key={patient.id} patient={patient} />
                ))}

                {sortedPatients.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground">
                    <Clock className="size-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Keine Patienten in dieser Ansicht</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {!loading && !error && viewMode === "rooms" && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Room columns */}
            {rooms.map((room) => (
              <Card key={room}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">{room}</CardTitle>
                    <Badge variant="outline">
                      {patientsByRoom[room]?.length || 0} Patienten
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-muted/30">
                    {patientsByRoom[room]?.map((patient) => (
                      <PatientRow key={patient.id} patient={patient} />
                    ))}
                    {(!patientsByRoom[room] || patientsByRoom[room].length === 0) && (
                      <div className="p-8 text-center text-muted-foreground">
                        <p className="text-sm">Raum frei</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Waiting patients column */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">Wartende Patienten</CardTitle>
                  <Badge variant="outline">
                    {waitingPatients.length} wartend
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-muted/30">
                  {waitingPatients.sort((a, b) => {
                    const priorityOrder = { notfall: 0, dringend: 1, normal: 2 }
                    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                      return priorityOrder[a.priority] - priorityOrder[b.priority]
                    }
                    return b.waitTime - a.waitTime
                  }).map((patient) => (
                    <PatientRow key={patient.id} patient={patient} />
                  ))}
                  {waitingPatients.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      <p className="text-sm">Keine wartenden Patienten</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
