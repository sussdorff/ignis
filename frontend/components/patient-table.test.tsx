import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatientTable } from './patient-table'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}))

const mockGetPatients = vi.fn()
const mockGetQuestionnaireResponsesByPatient = vi.fn()

vi.mock('@/lib/api', () => ({
  getPatients: (...args: unknown[]) => mockGetPatients(...args),
  getQuestionnaireResponsesByPatient: (...args: unknown[]) =>
    mockGetQuestionnaireResponsesByPatient(...args),
}))

// Mock the QuestionnaireResponseModal to simplify testing
vi.mock('./questionnaire-response-modal', () => ({
  QuestionnaireResponseModal: ({
    patientId,
    isOpen,
    onClose,
  }: {
    patientId: string
    isOpen: boolean
    onClose: () => void
  }) =>
    isOpen ? (
      <div data-testid="questionnaire-modal" data-patient-id={patientId}>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}))

const fakePatients = [
  {
    id: 'p1',
    resourceType: 'Patient' as const,
    name: [{ family: 'Mueller', given: ['Anna'] }],
    birthDate: '1990-05-10',
    gender: 'female' as const,
  },
  {
    id: 'p2',
    resourceType: 'Patient' as const,
    name: [{ family: 'Schmidt', given: ['Hans'] }],
    birthDate: '1985-03-22',
    gender: 'male' as const,
  },
  {
    id: 'p3',
    resourceType: 'Patient' as const,
    name: [{ family: 'Weber', given: ['Lena'] }],
    birthDate: '2000-11-01',
    gender: 'female' as const,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPatients.mockResolvedValue(fakePatients)
  // Default: no responses for any patient
  mockGetQuestionnaireResponsesByPatient.mockResolvedValue([])
})

describe('PatientTable', () => {
  it('renders the patient table with status column header', async () => {
    render(<PatientTable />)

    await waitFor(() => {
      expect(screen.getByText('Anna Mueller')).toBeInTheDocument()
    })

    expect(screen.getByText('Fragebogen')).toBeInTheDocument()
  })

  it('shows "Ausgefuellt" badge when patient has completed response', async () => {
    mockGetQuestionnaireResponsesByPatient.mockImplementation(
      (patientId: string) => {
        if (patientId === 'p1') {
          return Promise.resolve([
            {
              resourceType: 'QuestionnaireResponse',
              id: 'qr1',
              status: 'completed',
              authored: '2026-01-15',
            },
          ])
        }
        return Promise.resolve([])
      }
    )

    render(<PatientTable />)

    await waitFor(() => {
      expect(screen.getByText('Anna Mueller')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('Ausgefuellt')).toBeInTheDocument()
    })
  })

  it('shows "In Bearbeitung" badge when patient has in-progress response', async () => {
    mockGetQuestionnaireResponsesByPatient.mockImplementation(
      (patientId: string) => {
        if (patientId === 'p2') {
          return Promise.resolve([
            {
              resourceType: 'QuestionnaireResponse',
              id: 'qr2',
              status: 'in-progress',
              authored: '2026-01-15',
            },
          ])
        }
        return Promise.resolve([])
      }
    )

    render(<PatientTable />)

    await waitFor(() => {
      expect(screen.getByText('Hans Schmidt')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('In Bearbeitung')).toBeInTheDocument()
    })
  })

  it('shows "Ausstehend" badge when patient has no responses', async () => {
    render(<PatientTable />)

    await waitFor(() => {
      expect(screen.getByText('Anna Mueller')).toBeInTheDocument()
    })

    await waitFor(() => {
      const badges = screen.getAllByText('Ausstehend')
      expect(badges.length).toBe(3) // all three patients have no responses
    })
  })

  it('shows loading spinner for questionnaire status', async () => {
    // Delay the responses so we can see loading state
    mockGetQuestionnaireResponsesByPatient.mockImplementation(
      () => new Promise(() => {}) // never resolves
    )

    render(<PatientTable />)

    await waitFor(() => {
      expect(screen.getByText('Anna Mueller')).toBeInTheDocument()
    })

    // The status cells should show loading indicators
    const loadingIndicators = document.querySelectorAll('[data-testid="status-loading"]')
    expect(loadingIndicators.length).toBeGreaterThan(0)
  })

  it('opens QuestionnaireResponseModal on status badge click', async () => {
    const user = userEvent.setup()

    mockGetQuestionnaireResponsesByPatient.mockImplementation(
      (patientId: string) => {
        if (patientId === 'p1') {
          return Promise.resolve([
            {
              resourceType: 'QuestionnaireResponse',
              id: 'qr1',
              status: 'completed',
              authored: '2026-01-15',
            },
          ])
        }
        return Promise.resolve([])
      }
    )

    render(<PatientTable />)

    await waitFor(() => {
      expect(screen.getByText('Ausgefuellt')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Ausgefuellt'))

    await waitFor(() => {
      const modal = screen.getByTestId('questionnaire-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveAttribute('data-patient-id', 'p1')
    })
  })

  it('clicking badge does not navigate to patient page', async () => {
    const user = userEvent.setup()

    mockGetQuestionnaireResponsesByPatient.mockImplementation(() =>
      Promise.resolve([
        {
          resourceType: 'QuestionnaireResponse',
          id: 'qr1',
          status: 'completed',
          authored: '2026-01-15',
        },
      ])
    )

    render(<PatientTable />)

    await waitFor(() => {
      expect(screen.getAllByText('Ausgefuellt').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('Ausgefuellt')[0])

    // Should NOT navigate
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('table still renders patient data correctly with status column', async () => {
    render(<PatientTable />)

    await waitFor(() => {
      expect(screen.getByText('Anna Mueller')).toBeInTheDocument()
    })

    expect(screen.getByText('Hans Schmidt')).toBeInTheDocument()
    expect(screen.getByText('Lena Weber')).toBeInTheDocument()
    expect(screen.getByText('10.05.1990')).toBeInTheDocument()
    expect(screen.getByText('22.03.1985')).toBeInTheDocument()
    expect(screen.getAllByText('Weiblich').length).toBe(2)
    expect(screen.getByText('Männlich')).toBeTruthy()
  })
})
