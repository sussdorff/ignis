import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Phone, Mail, AlertTriangle, Play, User, CheckCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Priority = "notfall" | "dringend" | "normal"
type Status = "wartend" | "aufgerufen" | "in_behandlung"

interface PatientHeaderProps {
  patient: {
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
    triage?: Priority
    allergien?: string[]
    status?: Status
    waitTime?: number
    room?: string
  }
}

export function PatientProfileHeader({ patient }: PatientHeaderProps) {
  const navigate = useNavigate()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [patientData, setPatientData] = useState(patient)
  const [status, setStatus] = useState<Status>(patient.status || "wartend")
  const [priority, setPriority] = useState<Priority>(patient.triage || "normal")
  const inputRef = useRef<HTMLInputElement>(null)

  const priorityConfig = {
    notfall: {
      label: "Notfall",
      className: "bg-destructive text-destructive-foreground",
    },
    dringend: {
      label: "Dringend",
      className: "bg-warning text-warning-foreground",
    },
    normal: {
      label: "Normal",
      className: "bg-secondary text-secondary-foreground",
    },
  }

  const statusConfig = {
    wartend: {
      label: "Wartend",
      className: "bg-muted text-muted-foreground",
      nextAction: "Aufrufen",
      icon: Play,
    },
    aufgerufen: {
      label: "Aufgerufen",
      className: "bg-info text-info-foreground",
      nextAction: "Behandlung starten",
      icon: User,
    },
    in_behandlung: {
      label: "In Behandlung",
      className: "bg-success text-success-foreground",
      nextAction: "Abschließen",
      icon: CheckCircle,
    },
  }

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingField])

  const handleFieldClick = (field: string) => {
    setEditingField(field)
  }

  const handleBlur = () => {
    // Auto-save on blur
    setEditingField(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      setEditingField(null)
    }
  }

  const updateField = (field: string, value: string) => {
    setPatientData(prev => ({ ...prev, [field]: value }))
  }

  const progressStatus = () => {
    if (status === "wartend") {
      setStatus("aufgerufen")
      setPatientData(prev => ({ ...prev, room: "Raum 1" }))
    } else if (status === "aufgerufen") {
      setStatus("in_behandlung")
    } else {
      // Could navigate back or show completion message
      navigate(-1)
    }
  }

  const cyclePriority = () => {
    const order: Priority[] = ["normal", "dringend", "notfall"]
    const currentIndex = order.indexOf(priority)
    const nextPriority = order[(currentIndex + 1) % order.length]
    setPriority(nextPriority)
    setPatientData(prev => ({ ...prev, triage: nextPriority }))
  }

  // Inline editable field component
  const EditableField = ({ 
    field, 
    value, 
    label,
    mono = false 
  }: { 
    field: string
    value: string
    label: string
    mono?: boolean
  }) => {
    if (editingField === field) {
      return (
        <span>
          <span className="text-muted-foreground">{label}: </span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => updateField(field, e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`bg-primary/5 rounded px-1 outline-none ring-2 ring-primary/20 ${mono ? 'font-mono' : 'font-medium'}`}
          />
        </span>
      )
    }
    return (
      <span 
        className="cursor-text hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
        onClick={() => handleFieldClick(field)}
      >
        <span className="text-muted-foreground">{label}: </span>
        <span className={mono ? "font-mono" : "font-medium"}>{value}</span>
      </span>
    )
  }

  return (
    <div className="bg-card">
      <div className="p-6">
        {/* Back navigation */}
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Zurück
        </button>

        <div className="flex items-start justify-between gap-6">
          {/* Patient info */}
          <div className="flex items-start gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                {patientData.initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">{patientData.name}</h1>
                {priority !== "normal" && (
                  <Badge 
                    className={`${priorityConfig[priority].className}`}
                  >
                    <AlertTriangle className="size-3 mr-1" />
                    {priorityConfig[priority].label}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{patientData.geburtsdatum} ({patientData.alter} Jahre)</span>
                <span>•</span>
                <span>{patientData.geschlecht}</span>
                <span>•</span>
                <span>{patientData.versicherung}</span>
              </div>

              {patientData.allergien && patientData.allergien.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-sm font-medium text-destructive">Allergien:</span>
                  <div className="flex gap-1">
                    {patientData.allergien.map((allergie) => (
                      <Badge 
                        key={allergie} 
                        variant="outline" 
                        className="border-destructive/30 text-destructive bg-destructive/5"
                      >
                        {allergie}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Queue controls */}
          <div className="flex items-center gap-3">
            {/* Wait time or room */}
            {patientData.waitTime !== undefined && status === "wartend" && (
              <div className="text-center">
                <div
                  className={`text-lg font-semibold ${
                    patientData.waitTime > 30
                      ? "text-destructive"
                      : patientData.waitTime > 15
                        ? "text-warning"
                        : "text-foreground"
                  }`}
                >
                  {patientData.waitTime}m
                </div>
                <div className="text-xs text-muted-foreground">Wartezeit</div>
              </div>
            )}
            {patientData.room && status !== "wartend" && (
              <div className="text-center">
                <div className="text-sm font-medium">{patientData.room}</div>
                <div className="text-xs text-muted-foreground">Raum</div>
              </div>
            )}

            {/* Priority badge - clickable to cycle */}
            <button
              type="button"
              onClick={cyclePriority}
              className="flex flex-col items-center gap-1"
            >
              <Badge className={`${priorityConfig[priority].className} cursor-pointer hover:opacity-80 transition-opacity`}>
                {priorityConfig[priority].label}
              </Badge>
              <span className="text-xs text-muted-foreground">Priorität</span>
            </button>

            {/* Status badge */}
            <div className="flex flex-col items-center gap-1">
              <Badge className={statusConfig[status].className}>
                {statusConfig[status].label}
              </Badge>
              <span className="text-xs text-muted-foreground">Status</span>
            </div>

            {/* Action button */}
            <Button
              onClick={progressStatus}
              className={
                status === "wartend"
                  ? "bg-primary hover:bg-primary/90"
                  : status === "aufgerufen"
                    ? "bg-info hover:bg-info/90"
                    : "bg-success hover:bg-success/90"
              }
            >
              {(() => {
                const Icon = statusConfig[status].icon
                return <Icon className="size-4 mr-2" />
              })()}
              {statusConfig[status].nextAction}
            </Button>

            {/* Quick contact actions */}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l">
              <a 
                href={`tel:${patientData.telefon}`}
                className="size-9 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center text-primary"
                title="Anrufen"
              >
                <Phone className="size-4" />
              </a>
              <a 
                href={`mailto:${patientData.email}`}
                className="size-9 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center text-primary"
                title="E-Mail"
              >
                <Mail className="size-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Contact details row - tap to edit */}
        <div className="flex items-center gap-6 mt-4 pt-4 text-sm flex-wrap">
          <EditableField field="telefon" value={patientData.telefon} label="Tel" />
          <EditableField field="email" value={patientData.email} label="E-Mail" />
          <EditableField field="adresse" value={patientData.adresse} label="Adresse" />
          <EditableField field="versicherungsnummer" value={patientData.versicherungsnummer} label="Vers.-Nr" mono />
        </div>
      </div>
    </div>
  )
}
