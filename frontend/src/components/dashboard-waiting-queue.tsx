import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, Play, User, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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

export function DashboardWaitingQueue() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<WaitingPatient[]>(initialPatients)

  const sortedPatients = [...patients].sort((a, b) => {
    const priorityOrder = { notfall: 0, dringend: 1, normal: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return b.waitTime - a.waitTime
  })

  const waitingCount = patients.filter((p) => p.status === "wartend").length
  const urgentCount = patients.filter((p) => p.priority === "notfall" || p.priority === "dringend").length

  const handlePatientClick = (patientId: string) => {
    navigate(`/patient/${patientId}`)
  }

  const progressStatus = (patient: WaitingPatient) => {
    if (patient.status === "wartend") {
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patient.id
            ? { ...p, status: "aufgerufen" as Status, room: "Raum 1", doctor: "Dr. Schmidt" }
            : p
        )
      )
    } else if (patient.status === "aufgerufen") {
      setPatients((prev) =>
        prev.map((p) => (p.id === patient.id ? { ...p, status: "in_behandlung" as Status } : p))
      )
    } else if (patient.status === "in_behandlung") {
      setPatients((prev) => prev.filter((p) => p.id !== patient.id))
    }
  }

  const cyclePriority = (e: React.MouseEvent, patient: WaitingPatient) => {
    e.stopPropagation()
    const order: Priority[] = ["normal", "dringend", "notfall"]
    const currentIndex = order.indexOf(patient.priority)
    const nextPriority = order[(currentIndex + 1) % order.length]
    setPatients((prev) =>
      prev.map((p) => (p.id === patient.id ? { ...p, priority: nextPriority } : p))
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
                </div>
              </button>

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
        </div>
      </CardContent>
    </Card>
  )
}
