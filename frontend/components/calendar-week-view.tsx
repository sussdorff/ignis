"use client"

import React from "react"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import type { CalendarAppointment as Appointment } from "@/lib/use-appointments"

interface CalendarWeekViewProps {
  currentDate: Date
  appointments: Record<string, Appointment[]>
  onAppointmentClick: (appointment: Appointment) => void
  onSlotClick: (date: Date, hour: number) => void
  onAppointmentMove: (appointmentId: string, fromDateKey: string, toDateKey: string, newHour: number) => void
}

const germanWeekdaysShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]

const hours = Array.from({ length: 11 }, (_, i) => i + 8) // 8:00 - 18:00

const typeColors: Record<string, string> = {
  routine: "bg-sky-100 border-sky-300 text-sky-900",
  followup: "bg-emerald-100 border-emerald-300 text-emerald-900",
  urgent: "bg-amber-100 border-amber-300 text-amber-900",
  new: "bg-primary/10 border-primary/30 text-primary",
  triage: "bg-violet-100 border-violet-300 text-violet-900",
}

export function CalendarWeekView({
  currentDate,
  appointments,
  onAppointmentClick,
  onSlotClick,
  onAppointmentMove,
}: CalendarWeekViewProps) {
  const [draggedAppointment, setDraggedAppointment] = useState<{ appointment: Appointment; dateKey: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ dateKey: string; hour: number } | null>(null)
  const dragPreviewRef = useRef<HTMLDivElement>(null)

  // Calculate week days
  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return date
    })
  }

  const weekDays = getWeekDays()
  const today = new Date()

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString()
  }

  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const getAppointmentsForSlot = (date: Date, hour: number) => {
    const dateKey = formatDateKey(date)
    const dayAppointments = appointments[dateKey] || []
    return dayAppointments.filter(apt => {
      const [aptHour] = apt.time.split(':').map(Number)
      return aptHour === hour
    })
  }

  const handleDragStart = (e: React.DragEvent, appointment: Appointment, dateKey: string) => {
    e.stopPropagation()
    setDraggedAppointment({ appointment, dateKey })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', appointment.id)
    
    // Create custom drag image
    if (dragPreviewRef.current) {
      dragPreviewRef.current.textContent = appointment.patientName
      e.dataTransfer.setDragImage(dragPreviewRef.current, 0, 0)
    }
  }

  const handleDragEnd = () => {
    setDraggedAppointment(null)
    setDropTarget(null)
  }

  const handleDragOver = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    
    const dateKey = formatDateKey(date)
    setDropTarget({ dateKey, hour })
  }

  const handleDragLeave = () => {
    setDropTarget(null)
  }

  const handleDrop = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (draggedAppointment) {
      const toDateKey = formatDateKey(date)
      onAppointmentMove(
        draggedAppointment.appointment.id,
        draggedAppointment.dateKey,
        toDateKey,
        hour
      )
    }
    
    setDraggedAppointment(null)
    setDropTarget(null)
  }

  return (
    <>
      {/* Hidden drag preview element */}
      <div
        ref={dragPreviewRef}
        className="fixed -left-[9999px] bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium shadow-lg"
      />
      
      <div className="flex flex-col rounded-xl border bg-card overflow-hidden">
        {/* Header with days */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
          <div className="border-r bg-muted/30" />
          {weekDays.map((date, i) => (
            <div
              key={i}
              className={cn(
                "px-2 py-3 text-center border-r last:border-r-0",
                isToday(date) && "bg-primary/5"
              )}
            >
              <div className="text-xs text-muted-foreground">
                {germanWeekdaysShort[date.getDay()]}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold mt-1",
                  isToday(date) && "text-primary"
                )}
              >
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-auto max-h-[600px]">
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {hours.map((hour) => (
              <div key={hour} className="contents">
                {/* Time label */}
                <div className="border-r border-b bg-muted/30 px-2 py-1 text-xs text-muted-foreground text-right pr-3 h-20 flex items-start justify-end pt-0">
                  <span className="-mt-2">{hour}:00</span>
                </div>
                
                {/* Day columns */}
                {weekDays.map((date, dayIndex) => {
                  const slotAppointments = getAppointmentsForSlot(date, hour)
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6
                  const dateKey = formatDateKey(date)
                  const isDropTarget = dropTarget?.dateKey === dateKey && dropTarget?.hour === hour
                  
                  return (
                    <div
                      key={dayIndex}
                      className={cn(
                        "border-r border-b last:border-r-0 h-20 p-0.5 relative cursor-pointer transition-colors",
                        isToday(date) && "bg-primary/5",
                        isWeekend && "bg-muted/10",
                        isDropTarget && "bg-primary/20 ring-2 ring-primary ring-inset",
                        !isDropTarget && "hover:bg-muted/20"
                      )}
                      onClick={() => onSlotClick(date, hour)}
                      onDragOver={(e) => handleDragOver(e, date, hour)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, date, hour)}
                    >
                      {slotAppointments.map((apt) => {
                        const isDragging = draggedAppointment?.appointment.id === apt.id
                        return (
                          <div
                            key={apt.id}
                            draggable
                            className={cn(
                              "absolute inset-x-0.5 rounded-md border px-1.5 py-1 text-xs cursor-grab active:cursor-grabbing hover:shadow-sm transition-all overflow-hidden",
                              typeColors[apt.type],
                              isDragging && "opacity-50 scale-95"
                            )}
                            style={{
                              top: '2px',
                              height: `${Math.min((apt.duration / 60) * 80 - 4, 76)}px`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onAppointmentClick(apt)
                            }}
                            onDragStart={(e) => handleDragStart(e, apt, dateKey)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="font-medium truncate overflow-hidden text-ellipsis whitespace-nowrap">{apt.patientName}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
