"use client"

import React from "react"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { CalendarAppointment as Appointment } from "@/lib/use-appointments"

interface CalendarDayViewProps {
  currentDate: Date
  appointments: Appointment[]
  onAppointmentClick: (appointment: Appointment) => void
  onSlotClick: (date: Date, hour: number) => void
  onAppointmentMove: (appointmentId: string, newHour: number) => void
}

const hours = Array.from({ length: 11 }, (_, i) => i + 8)

const typeColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  routine: { 
    bg: "bg-sky-50", 
    border: "border-sky-200", 
    text: "text-sky-900",
    badge: "bg-sky-100 text-sky-700"
  },
  followup: { 
    bg: "bg-emerald-50", 
    border: "border-emerald-200", 
    text: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-700"
  },
  urgent: { 
    bg: "bg-amber-50", 
    border: "border-amber-200", 
    text: "text-amber-900",
    badge: "bg-amber-100 text-amber-700"
  },
  new: { 
    bg: "bg-primary/5", 
    border: "border-primary/20", 
    text: "text-primary",
    badge: "bg-primary/10 text-primary"
  },
  triage: { 
    bg: "bg-violet-50", 
    border: "border-violet-200", 
    text: "text-violet-900",
    badge: "bg-violet-100 text-violet-700"
  },
}

const typeLabels: Record<string, string> = {
  routine: "Routineuntersuchung",
  followup: "Nachsorge",
  urgent: "Dringend",
  new: "Erstbesuch",
  triage: "Online-Triage",
}

export function CalendarDayView({
  currentDate,
  appointments,
  onAppointmentClick,
  onSlotClick,
  onAppointmentMove,
}: CalendarDayViewProps) {
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null)
  const [dropTargetHour, setDropTargetHour] = useState<number | null>(null)
  const dragPreviewRef = useRef<HTMLDivElement>(null)

  const getAppointmentsForHour = (hour: number) => {
    return appointments.filter(apt => {
      const [aptHour] = apt.time.split(':').map(Number)
      return aptHour === hour
    })
  }

  const handleDragStart = (e: React.DragEvent, appointment: Appointment) => {
    e.stopPropagation()
    setDraggedAppointment(appointment)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', appointment.id)
    
    if (dragPreviewRef.current) {
      dragPreviewRef.current.textContent = appointment.patientName
      e.dataTransfer.setDragImage(dragPreviewRef.current, 0, 0)
    }
  }

  const handleDragEnd = () => {
    setDraggedAppointment(null)
    setDropTargetHour(null)
  }

  const handleDragOver = (e: React.DragEvent, hour: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetHour(hour)
  }

  const handleDragLeave = () => {
    setDropTargetHour(null)
  }

  const handleDrop = (e: React.DragEvent, hour: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (draggedAppointment) {
      onAppointmentMove(draggedAppointment.id, hour)
    }
    
    setDraggedAppointment(null)
    setDropTargetHour(null)
  }

  return (
    <>
      {/* Hidden drag preview element */}
      <div
        ref={dragPreviewRef}
        className="fixed -left-[9999px] bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium shadow-lg"
      />

      <div className="flex gap-6">
        {/* Main timeline */}
        <div className="flex-1 rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {hours.map((hour) => {
              const hourAppointments = getAppointmentsForHour(hour)
              const isDropTarget = dropTargetHour === hour
              
              return (
                <div
                  key={hour}
                  className={cn(
                    "flex min-h-24 cursor-pointer transition-colors",
                    isDropTarget && "bg-primary/10 ring-2 ring-primary ring-inset",
                    !isDropTarget && "hover:bg-muted/10"
                  )}
                  onClick={() => onSlotClick(currentDate, hour)}
                  onDragOver={(e) => handleDragOver(e, hour)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, hour)}
                >
                  {/* Time label */}
                  <div className="w-20 flex-shrink-0 border-r bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {hour}:00
                  </div>
                  
                  {/* Appointments */}
                  <div className="flex-1 p-2 space-y-2">
                    {hourAppointments.map((apt) => {
                      const colors = typeColors[apt.type]
                      const isDragging = draggedAppointment?.id === apt.id
                      return (
                        <div
                          key={apt.id}
                          draggable
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all",
                            colors.bg,
                            colors.border,
                            isDragging && "opacity-50 scale-[0.98]"
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            onAppointmentClick(apt)
                          }}
                          onDragStart={(e) => handleDragStart(e, apt)}
                          onDragEnd={handleDragEnd}
                        >
                          <Avatar className="size-10 flex-shrink-0">
                            <AvatarFallback className="bg-white text-sm font-medium">
                              {apt.patientInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn("font-medium", colors.text)}>
                                {apt.patientName}
                              </span>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full", colors.badge)}>
                                {typeLabels[apt.type]}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span>{apt.time} - {apt.duration} Min.</span>
                              <span>{apt.doctor}</span>
                            </div>
                            {apt.notes && (
                              <p className="mt-1 text-sm text-muted-foreground truncate">
                                {apt.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Side panel - Today's summary */}
        <div className="w-72 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-3">Tagesübersicht</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Termine gesamt</span>
                <span className="font-medium">{appointments.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Erstbesuche</span>
                <span className="font-medium text-primary">
                  {appointments.filter(a => a.type === 'new').length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dringend</span>
                <span className="font-medium text-amber-600">
                  {appointments.filter(a => a.type === 'urgent').length}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold mb-3">Nächster Termin</h3>
            {appointments.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {appointments[0].patientInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">{appointments[0].patientName}</div>
                    <div className="text-xs text-muted-foreground">{appointments[0].time}</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine weiteren Termine heute</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
