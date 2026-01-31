import { Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface Appointment {
  id: string
  patient: string
  initials: string
  time: string
  type: string
  status: "bestaetigt" | "ausstehend"
}

const appointments: Appointment[] = [
  {
    id: "1",
    patient: "Anna Müller",
    initials: "AM",
    time: "11:30",
    type: "Nachuntersuchung",
    status: "bestaetigt",
  },
  {
    id: "2",
    patient: "Klaus Richter",
    initials: "KR",
    time: "12:00",
    type: "Erstberatung",
    status: "bestaetigt",
  },
  {
    id: "3",
    patient: "Emma Wagner",
    initials: "EW",
    time: "14:00",
    type: "Blutabnahme",
    status: "ausstehend",
  },
  {
    id: "4",
    patient: "Peter Hoffmann",
    initials: "PH",
    time: "14:30",
    type: "Impfung",
    status: "bestaetigt",
  },
]

export function UpcomingAppointments() {
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
        ))}
      </CardContent>
    </Card>
  )
}
