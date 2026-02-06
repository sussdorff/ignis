import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionnaireStatusBadge } from './questionnaire-status-badge'

const mockGetQuestionnaireResponsesByPatient = vi.fn()

vi.mock('@/lib/api', () => ({
  getQuestionnaireResponsesByPatient: (...args: unknown[]) =>
    mockGetQuestionnaireResponsesByPatient(...args),
}))

// Mock the QuestionnaireResponseModal
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

beforeEach(() => {
  vi.clearAllMocks()
  mockGetQuestionnaireResponsesByPatient.mockResolvedValue([])
})

describe('QuestionnaireStatusBadge', () => {
  it('renders "Ausgefuellt" badge for completed responses', async () => {
    mockGetQuestionnaireResponsesByPatient.mockResolvedValue([
      { resourceType: 'QuestionnaireResponse', id: 'qr1', status: 'completed', authored: '2026-01-15' },
    ])

    render(<QuestionnaireStatusBadge patientId="p1" />)

    await waitFor(() => {
      expect(screen.getByText('Ausgefuellt')).toBeInTheDocument()
    })
  })

  it('renders "In Bearbeitung" badge for in-progress responses', async () => {
    mockGetQuestionnaireResponsesByPatient.mockResolvedValue([
      { resourceType: 'QuestionnaireResponse', id: 'qr2', status: 'in-progress', authored: '2026-01-15' },
    ])

    render(<QuestionnaireStatusBadge patientId="p1" />)

    await waitFor(() => {
      expect(screen.getByText('In Bearbeitung')).toBeInTheDocument()
    })
  })

  it('renders "Ausstehend" badge when no responses exist', async () => {
    mockGetQuestionnaireResponsesByPatient.mockResolvedValue([])

    render(<QuestionnaireStatusBadge patientId="p1" />)

    await waitFor(() => {
      expect(screen.getByText('Ausstehend')).toBeInTheDocument()
    })
  })

  it('shows loading spinner while fetching', async () => {
    mockGetQuestionnaireResponsesByPatient.mockImplementation(
      () => new Promise(() => {}) // never resolves
    )

    render(<QuestionnaireStatusBadge patientId="p1" />)

    expect(screen.getByTestId('status-loading')).toBeInTheDocument()
  })

  it('opens QuestionnaireResponseModal on badge click', async () => {
    const user = userEvent.setup()

    mockGetQuestionnaireResponsesByPatient.mockResolvedValue([
      { resourceType: 'QuestionnaireResponse', id: 'qr1', status: 'completed', authored: '2026-01-15' },
    ])

    render(<QuestionnaireStatusBadge patientId="p1" />)

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

  it('renders compact mode with just an icon', async () => {
    mockGetQuestionnaireResponsesByPatient.mockResolvedValue([
      { resourceType: 'QuestionnaireResponse', id: 'qr1', status: 'completed', authored: '2026-01-15' },
    ])

    render(<QuestionnaireStatusBadge patientId="p1" compact />)

    await waitFor(() => {
      expect(screen.getByTestId('badge-compact')).toBeInTheDocument()
    })

    // Should not render the text label in compact mode
    expect(screen.queryByText('Ausgefuellt')).not.toBeInTheDocument()
  })

  it('calls getQuestionnaireResponsesByPatient with correct patientId', async () => {
    render(<QuestionnaireStatusBadge patientId="test-patient-42" />)

    await waitFor(() => {
      expect(mockGetQuestionnaireResponsesByPatient).toHaveBeenCalledWith('test-patient-42')
    })
  })

  it('handles API error gracefully by showing Ausstehend', async () => {
    mockGetQuestionnaireResponsesByPatient.mockRejectedValue(new Error('Network error'))

    render(<QuestionnaireStatusBadge patientId="p1" />)

    await waitFor(() => {
      expect(screen.getByText('Ausstehend')).toBeInTheDocument()
    })
  })
})
