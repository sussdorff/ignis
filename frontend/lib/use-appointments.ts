"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  getTodayAppointments,
  rescheduleAppointment,
  subscribeToAppointmentEvents,
  type Appointment as APIAppointment,
  type AppointmentSSEEvent,
} from "./api"

export interface CalendarAppointment {
  id: string
  patientId: string
  patientName: string
  patientInitials: string
  time: string
  duration: number
  type: "routine" | "followup" | "urgent" | "new" | "triage"
  doctor: string
  notes?: string
  source?: "manual" | "online" | "voice"
  triageLevel?: "notfall" | "dringend" | "normal"
}

interface UseAppointmentsResult {
  appointments: Record<string, CalendarAppointment[]>
  loading: boolean
  error: string | null
  connected: boolean
  refetch: () => Promise<void>
  moveAppointment: (
    fromDateKey: string,
    toDateKey: string,
    appointmentId: string,
    newTime: string
  ) => Promise<void>
}

/**
 * Convert API appointment to calendar format
 */
function toCalendarAppointment(appt: APIAppointment): CalendarAppointment {
  const startDate = new Date(appt.start)
  const endDate = new Date(appt.end)
  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000)

  // Get time in HH:MM format
  const time = startDate.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  // Generate initials from patient name
  const nameParts = appt.patientName.split(" ")
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : appt.patientName.slice(0, 2)

  // Map status to type
  let type: CalendarAppointment["type"] = "routine"
  if (appt.status === "arrived") type = "followup"
  if (appt.description?.toLowerCase().includes("dringend")) type = "urgent"
  if (appt.description?.toLowerCase().includes("neu")) type = "new"

  return {
    id: appt.id,
    patientId: appt.patientId,
    patientName: appt.patientName,
    patientInitials: initials.toUpperCase(),
    time,
    duration: durationMinutes || 30,
    type,
    doctor: appt.practitioner || "Dr. Schmidt",
    notes: appt.description,
    source: "manual",
  }
}

/**
 * Group appointments by date key (YYYY-MM-DD)
 */
function groupByDate(appointments: APIAppointment[]): Record<string, CalendarAppointment[]> {
  const grouped: Record<string, CalendarAppointment[]> = {}

  for (const appt of appointments) {
    const dateKey = appt.start.split("T")[0]
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(toCalendarAppointment(appt))
  }

  // Sort each day's appointments by time
  for (const dateKey of Object.keys(grouped)) {
    grouped[dateKey].sort((a, b) => a.time.localeCompare(b.time))
  }

  return grouped
}

/**
 * Hook for managing appointments with real-time SSE updates
 */
export function useAppointments(): UseAppointmentsResult {
  const [appointments, setAppointments] = useState<Record<string, CalendarAppointment[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getTodayAppointments()
      setAppointments(groupByDate(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch appointments")
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle SSE events
  const handleSSEEvent = useCallback((event: AppointmentSSEEvent) => {
    console.log("[SSE] Received event:", event.type, event)

    switch (event.type) {
      case "connected":
        setConnected(true)
        console.log(`[SSE] Connected, ${event.clients} clients total`)
        break

      case "created":
      case "updated":
      case "rescheduled":
      case "cancelled":
        // Refetch all appointments on any change
        // This is simpler than trying to patch the local state
        fetchAppointments()
        break
    }
  }, [fetchAppointments])

  // Set up SSE connection
  useEffect(() => {
    // Initial fetch
    fetchAppointments()

    // Subscribe to real-time updates
    const eventSource = subscribeToAppointmentEvents(
      handleSSEEvent,
      () => {
        setConnected(false)
        // Try to reconnect after 5 seconds
        setTimeout(() => {
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
          }
          eventSourceRef.current = subscribeToAppointmentEvents(handleSSEEvent)
        }, 5000)
      }
    )
    eventSourceRef.current = eventSource

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [fetchAppointments, handleSSEEvent])

  // Move appointment to a new time/date
  const moveAppointment = useCallback(
    async (
      fromDateKey: string,
      toDateKey: string,
      appointmentId: string,
      newTime: string
    ) => {
      // Find the appointment
      const appointment = appointments[fromDateKey]?.find((a) => a.id === appointmentId)
      if (!appointment) {
        console.error("[moveAppointment] Appointment not found:", appointmentId)
        return
      }

      // Build new start/end times
      const [hours, minutes] = newTime.split(":").map(Number)
      const newStart = new Date(toDateKey)
      newStart.setHours(hours, minutes, 0, 0)
      const newEnd = new Date(newStart.getTime() + appointment.duration * 60000)

      // Optimistic update
      setAppointments((prev) => {
        const fromAppointments = [...(prev[fromDateKey] || [])]
        const index = fromAppointments.findIndex((a) => a.id === appointmentId)
        if (index === -1) return prev

        const [moved] = fromAppointments.splice(index, 1)
        const updatedAppointment = { ...moved, time: newTime }

        const toAppointments = [...(prev[toDateKey] || [])]
        toAppointments.push(updatedAppointment)
        toAppointments.sort((a, b) => a.time.localeCompare(b.time))

        return {
          ...prev,
          [fromDateKey]: fromAppointments,
          [toDateKey]: toAppointments,
        }
      })

      try {
        // Call backend API
        await rescheduleAppointment(
          appointmentId,
          newStart.toISOString(),
          newEnd.toISOString()
        )
        // SSE will trigger refetch, but optimistic update already shows the change
      } catch (err) {
        console.error("[moveAppointment] Failed to reschedule:", err)
        // Revert optimistic update on error
        fetchAppointments()
      }
    },
    [appointments, fetchAppointments]
  )

  return {
    appointments,
    loading,
    error,
    connected,
    refetch: fetchAppointments,
    moveAppointment,
  }
}
