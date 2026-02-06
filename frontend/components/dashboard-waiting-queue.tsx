"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Play, User, CheckCircle, Loader2, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { QuestionnaireStatusBadge } from "@/components/questionnaire-status-badge"
import {
  getQueue,
  updateQueueEntry,
  finishQueueEntry as apiFinishQueueEntry,
  type QueueEntry,
  type QueueStatus as APIQueueStatus,
  type Priority as APIPriority,
} from "@/lib/api"

type Priority = "notfall" | "dringend" | "normal"
type Status = "wartend" | "aufgerufen" | "in_behandlung"
type FilterType = "alle" | "dringend" | "aufgerufen"

interface WaitingPatient {
  id: string
  patientId: string
  name: string
  initials: string
  reason: string
  priority: Priority
  status: Status
  waitTime: number
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
    reason: entry.reason || '',
    priority,
    status,
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

export function DashboardWaitingQueue() {
  const router = useRouter()
  const [patients, setPatients] = useState<WaitingPatient[]>([])
  const [filter, setFilter] = useState<FilterType>("alle")
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
      setError('Fehler beim Laden')
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

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const priorityOrder = { notfall: 0, dringend: 1, normal: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return b.waitTime - a.waitTime
  })

  const waitingCount = patients.filter((p) => p.status === "wartend").length
  const urgentCount = patients.filter((p) => p.priority === "notfall").length
  const aufgerufenCount = patients.filter((p) => p.status === "aufgerufen").length

  const handlePatientClick = (patientId: string) => {
    router.push(`/patient/${patientId}`)
  }

  const progressStatus = async (patient: WaitingPatient) => {
    try {
      if (patient.status === "wartend") {
        // Assign to first available room
        const usedRooms = patients.filter(p => p.room && p.status !== "wartend").map(p => p.room)
        const availableRoom = rooms.find(r => !usedRooms.includes(r)) || "Raum 1"
        
        // Optimistic update
        setPatients((prev) =>
          prev.map((p) =>
            p.id === patient.id
              ? { ...p, status: "aufgerufen" as Status, room: availableRoom }
              : p
          )
        )
        
        // Update backend
        await updateQueueEntry(patient.id, { status: 'aufgerufen', room: availableRoom })
      } else if (patient.status === "aufgerufen") {
        // Optimistic update
        setPatients((prev) =>
          prev.map((p) => (p.id === patient.id ? { ...p, status: "in_behandlung" as Status } : p))
        )
        
        // Update backend
        await updateQueueEntry(patient.id, { status: 'in_behandlung' })
      } else if (patient.status === "in_behandlung") {
        // Optimistic update
        setPatients((prev) => prev.filter((p) => p.id !== patient.id))
        
        // Finish on backend
        await apiFinishQueueEntry(patient.id)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
      // Refresh to get correct state
      fetchQueue()
    }
  }

  const cyclePriority = async (e: React.MouseEvent, patient: WaitingPatient) => {
    e.stopPropagation()
    const order: Priority[] = ["normal", "dringend", "notfall"]
    const currentIndex = order.indexOf(patient.priority)
    const nextPriority = order[(currentIndex + 1) % order.length]
    
    // Optimistic update
    setPatients((prev) =>
      prev.map((p) => (p.id === patient.id ? { ...p, priority: nextPriority } : p))
    )
    
    try {
      // Update backend
      await updateQueueEntry(patient.id, { priority: nextPriority as APIPriority })
    } catch (err) {
      console.error('Failed to update priority:', err)
      // Refresh to get correct state
      fetchQueue()
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Warteschlange</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Lade Warteschlange...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Warteschlange</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-destructive">
            <AlertTriangle className="size-8 mb-2" />
            <p>{error}</p>
            <button 
              type="button"
              onClick={() => { setLoading(true); fetchQueue(); }}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Erneut versuchen
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Warteschlange</CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Wartend:</span>
              <span className="font-semibold">{waitingCount}</span>
            </div>
            {urgentCount > 0 && (
              <div className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-4" />
                <span className="font-semibold">{urgentCount}</span>
              </div>
            )}
          </div>
        </div>
        {/* Filter buttons */}
        <div className="flex gap-2 mt-3">
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
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-muted/30">
          {sortedPatients.slice(0, 5).map((patient) => (
            <div key={patient.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors group">
              {/* Priority indicator bar */}
              <div className={`w-1 self-stretch rounded-full ${priorityConfig[patient.priority].barColor}`} />

              {/* Patient info */}
              <button
                type="button"
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
                onClick={() => handlePatientClick(patient.patientId)}
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {patient.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {patient.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{patient.reason}</p>
                  {patient.doctor && (
                    <p className="text-xs text-muted-foreground">
                      Behandelnde Person: <span className="font-medium">{patient.doctor}</span>
                    </p>
                  )}
                </div>
              </button>

              {/* Questionnaire status */}
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <QuestionnaireStatusBadge patientId={patient.patientId} compact />
              </div>

              {/* Wait time */}
              <div className="w-14 text-center shrink-0">
                {patient.status === "wartend" ? (
                  <div
                    className={`text-sm font-semibold ${
                      patient.waitTime > 30
                        ? "text-destructive"
                        : patient.waitTime > 15
                          ? "text-warning"
                          : "text-foreground"
                    }`}
                  >
                    {patient.waitTime}m
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">{patient.room}</div>
                )}
              </div>

              {/* Priority badge */}
              <button
                type="button"
                onClick={(e) => cyclePriority(e, patient)}
                className="shrink-0"
              >
                <Badge className={`${priorityConfig[patient.priority].className} cursor-pointer hover:opacity-80 transition-opacity text-xs`}>
                  {priorityConfig[patient.priority].label}
                </Badge>
              </button>

              {/* Status badge */}
              <Badge className={`${statusConfig[patient.status].className} shrink-0 text-xs`}>
                {statusConfig[patient.status].label}
              </Badge>

              {/* Action button */}
              <button
                type="button"
                onClick={() => progressStatus(patient)}
                className={`size-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  patient.status === "wartend"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : patient.status === "aufgerufen"
                      ? "bg-info/10 text-info hover:bg-info/20"
                      : "bg-success/10 text-success hover:bg-success/20"
                }`}
              >
                {patient.status === "wartend" && <Play className="size-4" />}
                {patient.status === "aufgerufen" && <User className="size-4" />}
                {patient.status === "in_behandlung" && <CheckCircle className="size-4" />}
              </button>
            </div>
          ))}
          {sortedPatients.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="size-8 mx-auto mb-2 opacity-50" />
              <p>Keine Patienten in der Warteschlange</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
