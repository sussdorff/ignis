"use client"

import { useEffect, useState, useCallback } from "react"
import { Clock, Loader2, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { QuestionnaireStatusBadge } from "@/components/questionnaire-status-badge"
import { getTodayAppointments, type Appointment as APIAppointment } from "@/lib/api"

interface DisplayAppointment {
  id: string
  patientId: string
  patient: string
  initials: string
  time: string
  type: string
  status: "bestaetigt" | "ausstehend"
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
}

function formatTime(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function transformAppointment(appt: APIAppointment): DisplayAppointment {
  // Map FHIR status to display status
  const confirmedStatuses = ['booked', 'arrived', 'fulfilled']
  const status = confirmedStatuses.includes(appt.status) ? 'bestaetigt' : 'ausstehend'
  
  return {
    id: appt.id,
    patientId: appt.patientId,
    patient: appt.patientName,
    initials: getInitials(appt.patientName),
    time: formatTime(appt.start),
    type: appt.description || 'Termin',
    status,
  }
}

export function UpcomingAppointments() {
  const [appointments, setAppointments] = useState<DisplayAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAppointments = useCallback(async () => {
    try {
      const data = await getTodayAppointments()
      // Filter to show only future appointments and sort by time
      const now = new Date()
      const upcoming = data
        .filter(appt => new Date(appt.start) > now)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .slice(0, 4) // Show max 4 upcoming
        .map(transformAppointment)
      setAppointments(upcoming)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch appointments:', err)
      setError('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAppointments()
    // Poll every 60 seconds
    const interval = setInterval(fetchAppointments, 60000)
    return () => clearInterval(interval)
  }, [fetchAppointments])

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Nächste Termine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Lade...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Nächste Termine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <button 
              type="button"
              onClick={() => { setLoading(true); fetchAppointments(); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Erneut versuchen
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (appointments.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Nächste Termine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Calendar className="size-10 mb-2 opacity-50" />
            <p className="text-sm">Keine weiteren Termine heute</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          Nächste Termine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {appointments.map((appointment) => (
          <div
            key={appointment.id}
            className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
          >
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {appointment.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{appointment.patient}</p>
                <p className="text-xs text-muted-foreground">{appointment.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div onClick={(e) => e.stopPropagation()}>
                <QuestionnaireStatusBadge patientId={appointment.patientId} compact />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-medium">{appointment.time}</span>
                <Badge
                  variant="secondary"
                  className={
                    appointment.status === "bestaetigt"
                      ? "bg-success/10 text-success border-0 text-xs"
                      : "bg-warning/10 text-warning border-0 text-xs"
                  }
                >
                  {appointment.status === "bestaetigt" ? "Bestätigt" : "Ausstehend"}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
