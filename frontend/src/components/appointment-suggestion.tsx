import React, { useState, useMemo } from "react"
import { Calendar, Clock, User, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  useAppointmentsStore,
  type TriageAssessment,
  type AppointmentSlot,
  getSuggestedSlots,
} from "@/lib/appointments-store"

interface AppointmentSuggestionProps {
  triage: TriageAssessment
  patientName: string
  onBooked: (slot: AppointmentSlot) => void
}

export function AppointmentSuggestion({
  triage,
  patientName,
  onBooked,
}: AppointmentSuggestionProps) {
  const { appointments, addAppointment, getAvailableSlots } = useAppointmentsStore()
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null)
  const [isBooked, setIsBooked] = useState(false)

  // Get available slots for next 5 days
  const allAvailableSlots = useMemo(() => {
    const slots: AppointmentSlot[] = []
    for (let i = 0; i < 5; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      const dateKey = date.toISOString().split("T")[0]
      slots.push(...getAvailableSlots(dateKey))
    }
    return slots
  }, [appointments, getAvailableSlots])

  const suggestedSlots = useMemo(
    () => getSuggestedSlots(triage, allAvailableSlots),
    [triage, allAvailableSlots]
  )

  const triageConfig = {
    notfall: {
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      badgeClass: "bg-destructive text-destructive-foreground",
      label: "Notfall",
    },
    dringend: {
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10",
      badgeClass: "bg-warning text-warning-foreground",
      label: "Dringend",
    },
    normal: {
      icon: Calendar,
      color: "text-primary",
      bgColor: "bg-primary/10",
      badgeClass: "bg-secondary text-secondary-foreground",
      label: "Normal",
    },
  }

  const config = triageConfig[triage.level]
  const Icon = config.icon

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (dateStr === today.toISOString().split("T")[0]) {
      return "Heute"
    } else if (dateStr === tomorrow.toISOString().split("T")[0]) {
      return "Morgen"
    }
    return date.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
  }

  const handleBookAppointment = () => {
    if (!selectedSlot) return

    const initials = patientName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()

    const newAppointment = {
      id: `triage-${Date.now()}`,
      patientId: `new-${Date.now()}`,
      patientName,
      patientInitials: initials,
      time: selectedSlot.time,
      duration: 30,
      type: "triage" as const,
      doctor: selectedSlot.doctor,
      notes: `Online-Triage: ${triage.reason}`,
      source: "online" as const,
      triageLevel: triage.level,
    }

    addAppointment(selectedSlot.date, newAppointment)
    setIsBooked(true)
    onBooked(selectedSlot)
  }

  if (isBooked && selectedSlot) {
    return (
      <div className="space-y-4 rounded-xl bg-success/10 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-success/20 p-2">
            <CheckCircle className="size-6 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Termin bestätigt</h3>
            <p className="text-muted-foreground">
              Ihr Termin wurde erfolgreich gebucht
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-base">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="font-medium">{formatDate(selectedSlot.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-muted-foreground" />
            <span>{selectedSlot.time} Uhr</span>
          </div>
          <div className="flex items-center gap-2 text-base">
            <User className="size-4 text-muted-foreground" />
            <span>{selectedSlot.doctor}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Sie erhalten eine Bestätigungs-E-Mail mit allen Details.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Triage Assessment */}
      <div className={`rounded-xl ${config.bgColor} p-6`}>
        <div className="flex items-start gap-4">
          <div className={`rounded-full ${config.bgColor} p-2`}>
            <Icon className={`size-6 ${config.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg">Triage-Einschätzung</h3>
              <Badge className={config.badgeClass}>{config.label}</Badge>
            </div>
            <p className="text-muted-foreground">{triage.reason}</p>
            <p className="text-base font-medium mt-2">
              Empfohlener Zeitrahmen: {triage.suggestedTimeframe}
            </p>
          </div>
        </div>
      </div>

      {/* Suggested Appointments */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Verfügbare Termine</h3>

        {suggestedSlots.length === 0 ? (
          <div className="rounded-xl bg-muted/50 p-6 text-center">
            <p className="text-muted-foreground">
              Keine verfügbaren Termine im empfohlenen Zeitrahmen.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Bitte rufen Sie uns an unter 030-123456
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestedSlots.map((slot, index) => (
              <button
                key={`${slot.date}-${slot.time}-${slot.doctor}`}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-xl p-4 text-left transition-all ${
                  selectedSlot === slot
                    ? "bg-primary/10 ring-2 ring-primary"
                    : "bg-card hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-base">
                    {formatDate(slot.date)}
                  </span>
                  {index === 0 && triage.level !== "normal" && (
                    <Badge variant="outline" className="text-xs">
                      Empfohlen
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-4" />
                  <span>{slot.time} Uhr</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <User className="size-4" />
                  <span>{slot.doctor}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Book Button */}
      {selectedSlot && (
        <Button
          onClick={handleBookAppointment}
          size="lg"
          className="w-full"
        >
          <Calendar className="size-4 mr-2" />
          Termin buchen: {formatDate(selectedSlot.date)} um {selectedSlot.time} Uhr
        </Button>
      )}
    </div>
  )
}
