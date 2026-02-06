import { describe, it, expect, beforeAll } from 'bun:test'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

// Use a known patient ID from seed data
const PATIENT_ID = 'patient-2'
const NONEXISTENT_PATIENT_ID = 'patient-999-nonexistent'

interface NoteResponse {
  id: string
  content: string
  author: string
  date: string
  time: string
  aiGenerated?: boolean
}

interface NotesListResponse {
  notes: NoteResponse[]
}

let createdNoteId: string

describe('Patient Notes API', () => {
  // =========================================================================
  // POST /api/patients/:id/notes - Create a note
  // =========================================================================
  describe('POST /api/patients/:id/notes', () => {
    it('creates a note and returns 201', async () => {
      const res = await fetch(`${BASE}/api/patients/${PATIENT_ID}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Patient klagt ueber Kopfschmerzen seit 3 Tagen.',
          author: 'Dr. Schmidt',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json() as NoteResponse
      expect(data.id).toBeDefined()
      expect(data.content).toBe('Patient klagt ueber Kopfschmerzen seit 3 Tagen.')
      expect(data.author).toBe('Dr. Schmidt')
      expect(data.date).toBeDefined()
      expect(data.time).toBeDefined()

      // Save for later tests
      createdNoteId = data.id
    })

    it('validates required field: content', async () => {
      const res = await fetch(`${BASE}/api/patients/${PATIENT_ID}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: 'Dr. Schmidt',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('validation_failed')
    })

    it('uses default author when not provided', async () => {
      const res = await fetch(`${BASE}/api/patients/${PATIENT_ID}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Blutdruck 120/80 mmHg.',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json() as NoteResponse
      expect(data.author).toBeDefined()
      expect(data.author.length).toBeGreaterThan(0)
    })

    it('returns 404 for non-existent patient', async () => {
      const res = await fetch(`${BASE}/api/patients/${NONEXISTENT_PATIENT_ID}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'This should fail.',
          author: 'Dr. Test',
        }),
      })

      expect(res.status).toBe(404)
    })
  })

  // =========================================================================
  // GET /api/patients/:id/notes - List notes
  // =========================================================================
  describe('GET /api/patients/:id/notes', () => {
    it('returns created notes for patient', async () => {
      const res = await fetch(`${BASE}/api/patients/${PATIENT_ID}/notes`)
      expect(res.ok).toBe(true)

      const data = await res.json() as NotesListResponse
      expect(Array.isArray(data.notes)).toBe(true)
      expect(data.notes.length).toBeGreaterThan(0)

      // Verify note structure
      const note = data.notes[0]
      expect(note.id).toBeDefined()
      expect(note.content).toBeDefined()
      expect(note.author).toBeDefined()
      expect(note.date).toBeDefined()
      expect(note.time).toBeDefined()
    })

    it('returns notes sorted by date (newest first)', async () => {
      // Create a second note to verify ordering
      await fetch(`${BASE}/api/patients/${PATIENT_ID}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Zweite Notiz - neuere.',
          author: 'Dr. Mueller',
        }),
      })

      const res = await fetch(`${BASE}/api/patients/${PATIENT_ID}/notes`)
      const data = await res.json() as NotesListResponse

      expect(data.notes.length).toBeGreaterThanOrEqual(2)
      // The newest note should be first
      const first = data.notes[0]
      expect(first.content).toBe('Zweite Notiz - neuere.')
    })

    it('returns 404 for non-existent patient', async () => {
      const res = await fetch(`${BASE}/api/patients/${NONEXISTENT_PATIENT_ID}/notes`)
      expect(res.status).toBe(404)
    })
  })

  // =========================================================================
  // PUT /api/patients/:id/notes/:noteId - Update a note
  // =========================================================================
  describe('PUT /api/patients/:id/notes/:noteId', () => {
    it('updates a note', async () => {
      const res = await fetch(`${BASE}/api/patients/${PATIENT_ID}/notes/${createdNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Aktualisiert: Patient klagt ueber starke Kopfschmerzen.',
        }),
      })

      expect(res.ok).toBe(true)
      const data = await res.json() as NoteResponse
      expect(data.content).toBe('Aktualisiert: Patient klagt ueber starke Kopfschmerzen.')
      expect(data.id).toBe(createdNoteId)
    })

    it('returns 404 for non-existent note', async () => {
      const res = await fetch(`${BASE}/api/patients/${PATIENT_ID}/notes/nonexistent-note-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'This should fail.',
        }),
      })

      expect(res.status).toBe(404)
    })

    it('validates required field: content', async () => {
      const res = await fetch(`${BASE}/api/patients/${PATIENT_ID}/notes/${createdNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('validation_failed')
    })
  })
})
