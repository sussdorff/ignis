/**
 * In-memory waiting queue store for tracking patient status in the practice.
 * 
 * Status workflow:
 * - erwartet: Patient has appointment, hasn't arrived yet
 * - wartend: Patient arrived, waiting in waiting room
 * - aufgerufen: Patient called to treatment room
 * - in_behandlung: Patient is being treated
 * - fertig: Treatment complete
 */

export type QueueStatus = 'erwartet' | 'wartend' | 'aufgerufen' | 'in_behandlung' | 'fertig'
export type Priority = 'normal' | 'dringend' | 'notfall'

export interface QueueEntry {
  id: string
  patientId: string
  patientName: string
  appointmentId?: string
  status: QueueStatus
  priority: Priority
  arrivalTime?: string
  reason?: string
  room?: string
  doctor?: string
  createdAt: string
  updatedAt: string
}

// In-memory store (would be database in production)
const queueStore = new Map<string, QueueEntry>()

/**
 * Generate a unique queue entry ID
 */
function generateId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Add a patient to the waiting queue
 */
export function addToQueue(entry: {
  patientId: string
  patientName: string
  appointmentId?: string
  status?: QueueStatus
  priority?: Priority
  reason?: string
  doctor?: string
}): QueueEntry {
  const now = new Date().toISOString()
  const queueEntry: QueueEntry = {
    id: generateId(),
    patientId: entry.patientId,
    patientName: entry.patientName,
    appointmentId: entry.appointmentId,
    status: entry.status ?? 'erwartet',
    priority: entry.priority ?? 'normal',
    reason: entry.reason,
    doctor: entry.doctor,
    arrivalTime: entry.status === 'wartend' ? now : undefined,
    createdAt: now,
    updatedAt: now,
  }
  queueStore.set(queueEntry.id, queueEntry)
  return queueEntry
}

/**
 * Get all queue entries for today
 */
export function getTodayQueue(): QueueEntry[] {
  const today = new Date().toDateString()
  return Array.from(queueStore.values())
    .filter(entry => {
      const entryDate = new Date(entry.createdAt).toDateString()
      return entryDate === today && entry.status !== 'fertig'
    })
    .sort((a, b) => {
      // Sort by priority first (notfall > dringend > normal)
      const priorityOrder = { notfall: 0, dringend: 1, normal: 2 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      // Then by arrival time
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
}

/**
 * Get waiting room patients (status = wartend)
 */
export function getWaitingPatients(): QueueEntry[] {
  return getTodayQueue().filter(entry => entry.status === 'wartend')
}

/**
 * Get urgent patients (priority = notfall or dringend)
 */
export function getUrgentPatients(): QueueEntry[] {
  return getTodayQueue().filter(entry => 
    entry.priority === 'notfall' || entry.priority === 'dringend'
  )
}

/**
 * Update queue entry status
 */
export function updateQueueStatus(
  queueId: string, 
  updates: Partial<Pick<QueueEntry, 'status' | 'priority' | 'room' | 'doctor'>>
): QueueEntry | null {
  const entry = queueStore.get(queueId)
  if (!entry) return null
  
  const now = new Date().toISOString()
  const updated: QueueEntry = {
    ...entry,
    ...updates,
    updatedAt: now,
    // Set arrival time when status changes to wartend
    arrivalTime: updates.status === 'wartend' && !entry.arrivalTime ? now : entry.arrivalTime,
  }
  queueStore.set(queueId, updated)
  return updated
}

/**
 * Get queue entry by ID
 */
export function getQueueEntry(queueId: string): QueueEntry | null {
  return queueStore.get(queueId) ?? null
}

/**
 * Get queue entry by patient ID
 */
export function getQueueEntryByPatient(patientId: string): QueueEntry | null {
  const today = new Date().toDateString()
  for (const entry of queueStore.values()) {
    const entryDate = new Date(entry.createdAt).toDateString()
    if (entry.patientId === patientId && entryDate === today && entry.status !== 'fertig') {
      return entry
    }
  }
  return null
}

/**
 * Remove entry from queue (mark as finished)
 */
export function finishQueueEntry(queueId: string): boolean {
  const entry = queueStore.get(queueId)
  if (!entry) return false
  entry.status = 'fertig'
  entry.updatedAt = new Date().toISOString()
  return true
}

/**
 * Get queue statistics for today
 */
export function getQueueStats(): {
  total: number
  erwartet: number
  wartend: number
  aufgerufen: number
  inBehandlung: number
  dringend: number
  notfall: number
} {
  const queue = getTodayQueue()
  return {
    total: queue.length,
    erwartet: queue.filter(e => e.status === 'erwartet').length,
    wartend: queue.filter(e => e.status === 'wartend').length,
    aufgerufen: queue.filter(e => e.status === 'aufgerufen').length,
    inBehandlung: queue.filter(e => e.status === 'in_behandlung').length,
    dringend: queue.filter(e => e.priority === 'dringend').length,
    notfall: queue.filter(e => e.priority === 'notfall').length,
  }
}

/**
 * Clear old entries (for testing/cleanup)
 */
export function clearQueue(): void {
  queueStore.clear()
}

/**
 * Initialize queue with demo data for testing - 11 patients with appointments today
 */
export function initializeDemoQueue(): void {
  // Clear existing
  clearQueue()
  
  // Add 11 patients matching the seeded FHIR data
  const demoEntries = [
    { patientId: 'patient-10', patientName: 'Sabine Hoffmann', status: 'wartend' as QueueStatus, priority: 'normal' as Priority, reason: 'Kopfschmerzen', doctor: 'Dr. Schmidt' },
    { patientId: 'patient-11', patientName: 'Michael Krause', status: 'wartend' as QueueStatus, priority: 'dringend' as Priority, reason: 'Rückenschmerzen', doctor: 'Dr. Müller' },
    { patientId: 'patient-12', patientName: 'Claudia Richter', status: 'erwartet' as QueueStatus, priority: 'normal' as Priority, reason: 'Hautausschlag', doctor: 'Dr. Weber' },
    { patientId: 'patient-13', patientName: 'Wolfgang Braun', status: 'wartend' as QueueStatus, priority: 'normal' as Priority, reason: 'Blutdruckkontrolle', doctor: 'Dr. Schmidt' },
    { patientId: 'patient-14', patientName: 'Lisa Zimmermann', status: 'erwartet' as QueueStatus, priority: 'normal' as Priority, reason: 'Halsschmerzen', doctor: 'Dr. Müller' },
    { patientId: 'patient-15', patientName: 'Andreas Koch', status: 'wartend' as QueueStatus, priority: 'dringend' as Priority, reason: 'Magenschmerzen', doctor: 'Dr. Weber' },
    { patientId: 'patient-16', patientName: 'Petra Lehmann', status: 'erwartet' as QueueStatus, priority: 'normal' as Priority, reason: 'Impfung', doctor: 'Dr. Schmidt' },
    { patientId: 'patient-17', patientName: 'Martin Schulze', status: 'wartend' as QueueStatus, priority: 'normal' as Priority, reason: 'EKG-Kontrolle', doctor: 'Dr. Müller' },
    { patientId: 'patient-18', patientName: 'Karin Werner', status: 'erwartet' as QueueStatus, priority: 'normal' as Priority, reason: 'Allergietest', doctor: 'Dr. Weber' },
    { patientId: 'patient-19', patientName: 'Frank Meyer', status: 'wartend' as QueueStatus, priority: 'notfall' as Priority, reason: 'Brustschmerzen', doctor: 'Dr. Schmidt' },
    { patientId: 'patient-20', patientName: 'Julia Neumann', status: 'wartend' as QueueStatus, priority: 'normal' as Priority, reason: 'Laborergebnisse', doctor: 'Dr. Müller' },
  ]
  
  demoEntries.forEach(entry => addToQueue(entry))
}

// Initialize with demo data on startup
initializeDemoQueue()
