"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { CalendarHeader } from "@/components/calendar-header"
import { CalendarWeekView } from "@/components/calendar-week-view"
import { CalendarDayView } from "@/components/calendar-day-view"
import { NewAppointmentDialog } from "@/components/new-appointment-dialog"

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientInitials: string
  time: string
  duration: number
  type: "routine" | "followup" | "urgent" | "new"
  doctor: string
  notes?: string
}

// Mock appointment data
const createMockAppointments = (): Record<string, Appointment[]> => {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().split('T')[0]
  const dayAfter = new Date()
  dayAfter.setDate(dayAfter.getDate() + 2)
  const dayAfterKey = dayAfter.toISOString().split('T')[0]

  return {
    [today]: [
      {
        id: "1",
        patientId: "1",
        patientName: "Anna Müller",
        patientInitials: "AM",
        time: "08:30",
        duration: 30,
        type: "routine",
        doctor: "Dr. Schmidt",
        notes: "Blutdruckkontrolle",
      },
      {
        id: "2",
        patientId: "2",
        patientName: "Thomas Weber",
        patientInitials: "TW",
        time: "09:00",
        duration: 45,
        type: "new",
        doctor: "Dr. Schmidt",
        notes: "Erstuntersuchung",
      },
      {
        id: "3",
        patientId: "3",
        patientName: "Lisa Schneider",
        patientInitials: "LS",
        time: "10:00",
        duration: 30,
        type: "followup",
        doctor: "Dr. Schmidt",
      },
      {
        id: "4",
        patientId: "4",
        patientName: "Michael Becker",
        patientInitials: "MB",
        time: "11:00",
        duration: 30,
        type: "urgent",
        doctor: "Dr. Schmidt",
        notes: "Akute Beschwerden",
      },
      {
        id: "5",
        patientId: "5",
        patientName: "Sophie Klein",
        patientInitials: "SK",
        time: "14:00",
        duration: 30,
        type: "routine",
        doctor: "Dr. Müller",
      },
      {
        id: "6",
        patientId: "6",
        patientName: "Hans Fischer",
        patientInitials: "HF",
        time: "15:00",
        duration: 45,
        type: "followup",
        doctor: "Dr. Schmidt",
      },
    ],
    [tomorrowKey]: [
      {
        id: "7",
        patientId: "1",
        patientName: "Anna Müller",
        patientInitials: "AM",
        time: "09:00",
        duration: 30,
        type: "routine",
        doctor: "Dr. Schmidt",
      },
      {
        id: "8",
        patientId: "4",
        patientName: "Michael Becker",
        patientInitials: "MB",
        time: "10:30",
        duration: 30,
        type: "new",
        doctor: "Dr. Müller",
      },
      {
        id: "9",
        patientId: "5",
        patientName: "Sophie Klein",
        patientInitials: "SK",
        time: "14:00",
        duration: 45,
        type: "followup",
        doctor: "Dr. Schmidt",
      },
    ],
    [dayAfterKey]: [
      {
        id: "10",
        patientId: "6",
        patientName: "Hans Fischer",
        patientInitials: "HF",
        time: "08:00",
        duration: 30,
        type: "urgent",
        doctor: "Dr. Schmidt",
      },
      {
        id: "11",
        patientId: "3",
        patientName: "Lisa Schneider",
        patientInitials: "LS",
        time: "11:00",
        duration: 30,
        type: "routine",
        doctor: "Dr. Weber",
      },
    ],
  }
}

export default function TerminePage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"day" | "week">("week")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null)
  const [appointments, setAppointments] = useState<Record<string, Appointment[]>>(createMockAppointments)

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

  const handleAppointmentClick = (appointment: Appointment) => {
    router.push(`/patient/${appointment.patientId}`)
  }

  const handleAppointmentMove = useCallback((
    appointmentId: string,
    fromDateKey: string,
    toDateKey: string,
    newHour: number
  ) => {
    setAppointments(prev => {
      const updated = { ...prev }
      
      // Find and remove from original date
      const fromAppointments = [...(updated[fromDateKey] || [])]
      const appointmentIndex = fromAppointments.findIndex(a => a.id === appointmentId)
      
      if (appointmentIndex === -1) return prev
      
      const [movedAppointment] = fromAppointments.splice(appointmentIndex, 1)
      
      // Update time
      const newTime = `${newHour.toString().padStart(2, '0')}:00`
      const updatedAppointment = { ...movedAppointment, time: newTime }
      
      // Add to new date
      const toAppointments = [...(updated[toDateKey] || [])]
      toAppointments.push(updatedAppointment)
      
      // Sort by time
      toAppointments.sort((a, b) => a.time.localeCompare(b.time))
      
      updated[fromDateKey] = fromAppointments
      updated[toDateKey] = toAppointments
      
      return updated
    })
  }, [])

  const todayKey = currentDate.toISOString().split('T')[0]
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
