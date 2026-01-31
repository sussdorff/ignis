"use client"

import { create } from "zustand"

export interface Appointment {
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

export interface AppointmentSlot {
  date: string
  time: string
  doctor: string
  available: boolean
}

interface AppointmentsState {
  appointments: Record<string, Appointment[]>
  addAppointment: (dateKey: string, appointment: Appointment) => void
  removeAppointment: (dateKey: string, appointmentId: string) => void
  moveAppointment: (fromDateKey: string, toDateKey: string, appointmentId: string, newTime: string) => void
  getAvailableSlots: (date: string) => AppointmentSlot[]
}

// Initial mock data
const createInitialAppointments = (): Record<string, Appointment[]> => {
  const today = new Date().toISOString().split("T")[0]
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().split("T")[0]
  const dayAfter = new Date()
  dayAfter.setDate(dayAfter.getDate() + 2)
  const dayAfterKey = dayAfter.toISOString().split("T")[0]

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
        source: "manual",
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
        source: "manual",
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
        source: "manual",
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
        source: "manual",
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
        source: "manual",
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
        source: "manual",
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
        source: "manual",
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
        source: "manual",
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
        source: "manual",
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
        source: "manual",
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
        source: "manual",
      },
    ],
  }
}

// Available time slots
const WORKING_HOURS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"
]

const DOCTORS = ["Dr. Schmidt", "Dr. Müller", "Dr. Weber"]

export const useAppointmentsStore = create<AppointmentsState>((set, get) => ({
  appointments: createInitialAppointments(),

  addAppointment: (dateKey, appointment) => {
    set((state) => {
      const dayAppointments = [...(state.appointments[dateKey] || [])]
      dayAppointments.push(appointment)
      dayAppointments.sort((a, b) => a.time.localeCompare(b.time))
      return {
        appointments: {
          ...state.appointments,
          [dateKey]: dayAppointments,
        },
      }
    })
  },

  removeAppointment: (dateKey, appointmentId) => {
    set((state) => ({
      appointments: {
        ...state.appointments,
        [dateKey]: (state.appointments[dateKey] || []).filter(
          (a) => a.id !== appointmentId
        ),
      },
    }))
  },

  moveAppointment: (fromDateKey, toDateKey, appointmentId, newTime) => {
    set((state) => {
      const fromAppointments = [...(state.appointments[fromDateKey] || [])]
      const appointmentIndex = fromAppointments.findIndex(
        (a) => a.id === appointmentId
      )

      if (appointmentIndex === -1) return state

      const [movedAppointment] = fromAppointments.splice(appointmentIndex, 1)
      const updatedAppointment = { ...movedAppointment, time: newTime }

      const toAppointments = [...(state.appointments[toDateKey] || [])]
      toAppointments.push(updatedAppointment)
      toAppointments.sort((a, b) => a.time.localeCompare(b.time))

      return {
        appointments: {
          ...state.appointments,
          [fromDateKey]: fromAppointments,
          [toDateKey]: toAppointments,
        },
      }
    })
  },

  getAvailableSlots: (date) => {
    const state = get()
    const dayAppointments = state.appointments[date] || []
    const slots: AppointmentSlot[] = []

    for (const doctor of DOCTORS) {
      for (const time of WORKING_HOURS) {
        const isBooked = dayAppointments.some(
          (a) => a.time === time && a.doctor === doctor
        )
        slots.push({
          date,
          time,
          doctor,
          available: !isBooked,
        })
      }
    }

    return slots
  },
}))

// Triage assessment helper
export interface TriageAssessment {
  level: "notfall" | "dringend" | "normal"
  suggestedTimeframe: string
  reason: string
}

export function assessTriage(responses: Record<string, unknown>): TriageAssessment {
  // Mock triage logic - in production, this would be more sophisticated
  const severity = responses.severity as string
  const symptoms = responses.symptoms as string[] | undefined
  const temperature = responses.temperature as number | undefined

  // Emergency indicators
  if (
    symptoms?.includes("chest_pain") ||
    symptoms?.includes("breathing_difficulty") ||
    (temperature && temperature >= 40)
  ) {
    return {
      level: "notfall",
      suggestedTimeframe: "Sofort",
      reason: "Kritische Symptome erfordern sofortige Behandlung",
    }
  }

  // Urgent indicators
  if (
    severity === "severe" ||
    (temperature && temperature >= 39) ||
    symptoms?.includes("severe_pain")
  ) {
    return {
      level: "dringend",
      suggestedTimeframe: "Heute",
      reason: "Erhebliche Symptome erfordern zeitnahe Behandlung",
    }
  }

  // Normal
  return {
    level: "normal",
    suggestedTimeframe: "Innerhalb von 2-3 Tagen",
    reason: "Routinemäßige Untersuchung empfohlen",
  }
}

// Get suggested appointment slots based on triage
export function getSuggestedSlots(
  triage: TriageAssessment,
  availableSlots: AppointmentSlot[]
): AppointmentSlot[] {
  const now = new Date()
  const todayKey = now.toISOString().split("T")[0]

  let filteredSlots = availableSlots.filter((s) => s.available)

  if (triage.level === "notfall") {
    // Next available slot today
    filteredSlots = filteredSlots
      .filter((s) => s.date === todayKey)
      .slice(0, 3)
  } else if (triage.level === "dringend") {
    // Today or tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowKey = tomorrow.toISOString().split("T")[0]
    filteredSlots = filteredSlots
      .filter((s) => s.date === todayKey || s.date === tomorrowKey)
      .slice(0, 5)
  } else {
    // Within next 3 days
    filteredSlots = filteredSlots.slice(0, 6)
  }

  return filteredSlots
}
