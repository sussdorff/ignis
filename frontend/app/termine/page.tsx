"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { CalendarHeader } from "@/components/calendar-header"
import { CalendarWeekView } from "@/components/calendar-week-view"
import { CalendarDayView } from "@/components/calendar-day-view"
import { NewAppointmentDialog } from "@/components/new-appointment-dialog"
import { useAppointments, type CalendarAppointment } from "@/lib/use-appointments"
import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, Loader2 } from "lucide-react"

export default function TerminePage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"day" | "week">("week")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null)

  // Use real appointments with SSE sync
  const { appointments, loading, error, connected, moveAppointment } = useAppointments()

  const handlePrevious = () => {
    const newDate = new Date(currentDate)
    if (view === "day") {
      newDate.setDate(newDate.getDate() - 1)
    } else {
      newDate.setDate(newDate.getDate() - 7)
    }
    setCurrentDate(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(currentDate)
    if (view === "day") {
      newDate.setDate(newDate.getDate() + 1)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleNewAppointment = () => {
    setSelectedSlot(null)
    setDialogOpen(true)
  }

  const handleSlotClick = (date: Date, hour: number) => {
    setSelectedSlot({ date, hour })
    setDialogOpen(true)
  }

  const handleAppointmentClick = (appointment: CalendarAppointment) => {
    router.push(`/patient/${appointment.patientId}`)
  }

  const handleAppointmentMove = useCallback(
    async (
      appointmentId: string,
      fromDateKey: string,
      toDateKey: string,
      newHour: number
    ) => {
      const newTime = `${newHour.toString().padStart(2, "0")}:00`
      await moveAppointment(fromDateKey, toDateKey, appointmentId, newTime)
    },
    [moveAppointment]
  )

  const todayKey = currentDate.toISOString().split("T")[0]
  const todayAppointments = appointments[todayKey] || []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <CalendarHeader
            currentDate={currentDate}
            view={view}
            onViewChange={setView}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onToday={handleToday}
            onNewAppointment={handleNewAppointment}
          />
        </div>
        {/* Connection status */}
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {error && (
            <Badge variant="destructive" className="text-xs">
              {error}
            </Badge>
          )}
          {connected ? (
            <Badge variant="outline" className="text-xs text-green-600 border-green-600">
              <Wifi className="h-3 w-3 mr-1" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <WifiOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}
        </div>
      </header>

      {/* Calendar Content */}
      <main className="flex-1 overflow-auto p-6 bg-muted/30">
        {view === "week" ? (
          <CalendarWeekView
            currentDate={currentDate}
            appointments={appointments}
            onAppointmentClick={handleAppointmentClick}
            onSlotClick={handleSlotClick}
            onAppointmentMove={handleAppointmentMove}
          />
        ) : (
          <CalendarDayView
            currentDate={currentDate}
            appointments={todayAppointments}
            onAppointmentClick={handleAppointmentClick}
            onSlotClick={handleSlotClick}
            onAppointmentMove={(appointmentId, newHour) => {
              handleAppointmentMove(appointmentId, todayKey, todayKey, newHour)
            }}
          />
        )}
      </main>

      {/* New Appointment Dialog */}
      <NewAppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedDate={selectedSlot?.date}
        selectedHour={selectedSlot?.hour}
      />
    </div>
  )
}
