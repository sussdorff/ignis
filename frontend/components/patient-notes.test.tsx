import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatientNotes } from './patient-notes'

const mockGetPatientNotes = vi.fn()
const mockCreatePatientNote = vi.fn()
const mockUpdatePatientNote = vi.fn()

vi.mock('@/lib/api', () => ({
  getPatientNotes: (...args: unknown[]) => mockGetPatientNotes(...args),
  createPatientNote: (...args: unknown[]) => mockCreatePatientNote(...args),
  updatePatientNote: (...args: unknown[]) => mockUpdatePatientNote(...args),
}))

const existingNotes = [
  {
    id: 'note-1',
    content: 'Kopfschmerzen seit 3 Tagen',
    author: 'Dr. Schmidt',
    date: '06.02.2026',
    time: '09:00',
  },
  {
    id: 'note-2',
    content: 'Blutdruck normal',
    author: 'Dr. Mueller',
    date: '05.02.2026',
    time: '14:30',
    aiGenerated: true,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPatientNotes.mockResolvedValue(existingNotes)
  mockCreatePatientNote.mockResolvedValue({
    id: 'note-new',
    content: 'Neue Notiz',
    author: 'Arzt',
    date: '06.02.2026',
    time: '10:00',
  })
  mockUpdatePatientNote.mockResolvedValue({
    id: 'note-1',
    content: 'Aktualisiert',
    author: 'Dr. Schmidt',
    date: '06.02.2026',
    time: '09:00',
  })
})

describe('PatientNotes', () => {
  it('renders notes from API', async () => {
    render(<PatientNotes patientId="patient-2" />)

    await waitFor(() => {
      expect(screen.getByText('Kopfschmerzen seit 3 Tagen')).toBeInTheDocument()
    })
    expect(screen.getByText('Blutdruck normal')).toBeInTheDocument()
    expect(mockGetPatientNotes).toHaveBeenCalledWith('patient-2')
  })

  it('shows loading state initially', () => {
    mockGetPatientNotes.mockReturnValue(new Promise(() => {})) // never resolves
    render(<PatientNotes patientId="patient-2" />)

    expect(screen.getByText('Lade...')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    mockGetPatientNotes.mockRejectedValue(new Error('Network error'))
    render(<PatientNotes patientId="patient-2" />)

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Laden')).toBeInTheDocument()
    })
  })

  it('POSTs new note to API on blur', async () => {
    render(<PatientNotes patientId="patient-2" expanded />)

    await waitFor(() => {
      expect(screen.getByText('Kopfschmerzen seit 3 Tagen')).toBeInTheDocument()
    })

    // Click the add note button
    const addButton = screen.getByText('Neue Notiz hinzufügen...')
    fireEvent.click(addButton)

    // Type in the textarea
    const textarea = screen.getByPlaceholderText('Notiz eingeben...')
    await userEvent.type(textarea, 'Neue Notiz')

    // Blur to save
    fireEvent.blur(textarea)

    await waitFor(() => {
      expect(mockCreatePatientNote).toHaveBeenCalledWith('patient-2', 'Neue Notiz')
    })
  })

  it('PUTs updated note to API on edit blur', async () => {
    render(<PatientNotes patientId="patient-2" expanded />)

    await waitFor(() => {
      expect(screen.getByText('Kopfschmerzen seit 3 Tagen')).toBeInTheDocument()
    })

    // Click on existing note to edit
    const noteText = screen.getByText('Kopfschmerzen seit 3 Tagen')
    fireEvent.click(noteText.closest('[class*="rounded-lg"]')!)

    // Find the textarea (editing mode)
    await waitFor(() => {
      const editTextarea = screen.getByDisplayValue('Kopfschmerzen seit 3 Tagen')
      expect(editTextarea).toBeInTheDocument()
    })

    const editTextarea = screen.getByDisplayValue('Kopfschmerzen seit 3 Tagen')
    await userEvent.clear(editTextarea)
    await userEvent.type(editTextarea, 'Aktualisiert')

    // Blur to save
    fireEvent.blur(editTextarea)

    await waitFor(() => {
      expect(mockUpdatePatientNote).toHaveBeenCalledWith('patient-2', 'note-1', 'Aktualisiert')
    })
  })

  it('shows save indicator during save', async () => {
    // Make createPatientNote slow
    mockCreatePatientNote.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        id: 'note-new',
        content: 'Saving note',
        author: 'Arzt',
        date: '06.02.2026',
        time: '10:00',
      }), 100))
    )

    render(<PatientNotes patientId="patient-2" expanded />)

    await waitFor(() => {
      expect(screen.getByText('Kopfschmerzen seit 3 Tagen')).toBeInTheDocument()
    })

    const addButton = screen.getByText('Neue Notiz hinzufügen...')
    fireEvent.click(addButton)

    const textarea = screen.getByPlaceholderText('Notiz eingeben...')
    await userEvent.type(textarea, 'Saving note')
    fireEvent.blur(textarea)

    // Should show saving indicator
    await waitFor(() => {
      expect(screen.getByText('Speichern...')).toBeInTheDocument()
    })

    // Eventually resolves
    await waitFor(() => {
      expect(screen.queryByText('Speichern...')).not.toBeInTheDocument()
    })
  })

  it('shows error on save failure', async () => {
    mockCreatePatientNote.mockRejectedValue(new Error('Save failed'))

    render(<PatientNotes patientId="patient-2" expanded />)

    await waitFor(() => {
      expect(screen.getByText('Kopfschmerzen seit 3 Tagen')).toBeInTheDocument()
    })

    const addButton = screen.getByText('Neue Notiz hinzufügen...')
    fireEvent.click(addButton)

    const textarea = screen.getByPlaceholderText('Notiz eingeben...')
    await userEvent.type(textarea, 'Failing note')
    fireEvent.blur(textarea)

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Speichern')).toBeInTheDocument()
    })
  })
})
