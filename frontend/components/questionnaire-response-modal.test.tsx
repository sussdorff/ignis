import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionnaireResponseModal } from './questionnaire-response-modal'
import type { FHIRQuestionnaireResponse } from '@/lib/api'

const mockResponses: FHIRQuestionnaireResponse[] = [
  {
    resourceType: 'QuestionnaireResponse',
    id: 'resp-1',
    questionnaire: 'Questionnaire/patient-intake',
    status: 'completed',
    subject: { reference: 'Patient/p-123' },
    authored: '2026-02-05T10:30:00Z',
    item: [
      {
        linkId: 'section-personal',
        text: 'Persoenliche Daten',
        item: [
          {
            linkId: 'name',
            text: 'Name',
            answer: [{ valueString: 'Max Mustermann' }],
          },
          {
            linkId: 'age',
            text: 'Alter',
            answer: [{ valueInteger: 42 }],
          },
        ],
      },
      {
        linkId: 'section-medical',
        text: 'Medizinische Angaben',
        item: [
          {
            linkId: 'allergies',
            text: 'Bekannte Allergien',
            answer: [{ valueBoolean: true }],
          },
          {
            linkId: 'blood-type',
            text: 'Blutgruppe',
            answer: [{ valueCoding: { code: 'A+', display: 'A positiv' } }],
          },
        ],
      },
    ],
  },
]

const mockInProgressResponse: FHIRQuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  id: 'resp-2',
  questionnaire: 'Questionnaire/patient-intake',
  status: 'in-progress',
  subject: { reference: 'Patient/p-123' },
  authored: '2026-02-04T08:00:00Z',
  item: [
    {
      linkId: 'section-personal',
      text: 'Persoenliche Daten',
      item: [
        {
          linkId: 'name',
          text: 'Name',
          answer: [{ valueString: 'Max Mustermann' }],
        },
      ],
    },
  ],
}

// Mock the API
const mockGetResponses = vi.fn()
vi.mock('@/lib/api', () => ({
  getQuestionnaireResponsesByPatient: (...args: unknown[]) => mockGetResponses(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QuestionnaireResponseModal', () => {
  it('shows loading state while fetching', async () => {
    mockGetResponses.mockReturnValue(new Promise(() => {})) // never resolves

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    expect(screen.getByText('Lade...')).toBeInTheDocument()
  })

  it('shows empty state when no responses exist', async () => {
    mockGetResponses.mockResolvedValue([])

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Keine Antworten vorhanden')).toBeInTheDocument()
    })
  })

  it('renders FHIR responses grouped by section', async () => {
    mockGetResponses.mockResolvedValue(mockResponses)

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Persoenliche Daten')).toBeInTheDocument()
    })
    expect(screen.getByText('Medizinische Angaben')).toBeInTheDocument()
  })

  it('displays answers in human-readable format', async () => {
    mockGetResponses.mockResolvedValue(mockResponses)

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      // valueString
      expect(screen.getByText('Max Mustermann')).toBeInTheDocument()
    })
    // valueInteger
    expect(screen.getByText('42')).toBeInTheDocument()
    // valueBoolean true -> "Ja"
    expect(screen.getByText('Ja')).toBeInTheDocument()
    // valueCoding -> display text
    expect(screen.getByText('A positiv')).toBeInTheDocument()
  })

  it('shows response status badge', async () => {
    mockGetResponses.mockResolvedValue(mockResponses)

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Abgeschlossen')).toBeInTheDocument()
    })
  })

  it('shows in-progress status badge for incomplete response', async () => {
    mockGetResponses.mockResolvedValue([mockInProgressResponse])

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('In Bearbeitung')).toBeInTheDocument()
    })
  })

  it('shows authored date', async () => {
    mockGetResponses.mockResolvedValue(mockResponses)

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/05\.02\.2026/)).toBeInTheDocument()
    })
  })

  it('shows valueBoolean false as Nein', async () => {
    const responseWithFalse: FHIRQuestionnaireResponse[] = [
      {
        resourceType: 'QuestionnaireResponse',
        id: 'resp-3',
        status: 'completed',
        authored: '2026-02-05T10:30:00Z',
        item: [
          {
            linkId: 'section-test',
            text: 'Testabschnitt',
            item: [
              {
                linkId: 'smoker',
                text: 'Raucher',
                answer: [{ valueBoolean: false }],
              },
            ],
          },
        ],
      },
    ]
    mockGetResponses.mockResolvedValue(responseWithFalse)

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Nein')).toBeInTheDocument()
    })
  })

  it('calls onClose when close button is clicked', async () => {
    mockGetResponses.mockResolvedValue(mockResponses)
    const onClose = vi.fn()

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={onClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Persoenliche Daten')).toBeInTheDocument()
    })

    const closeButton = screen.getByRole('button', { name: /close/i })
    await userEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when isOpen is false', () => {
    mockGetResponses.mockResolvedValue(mockResponses)

    const { container } = render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={false}
        onClose={() => {}}
      />
    )

    expect(container.querySelector('[data-slot="dialog"]')).toBeNull()
    expect(screen.queryByText('Fragebogen-Antworten')).not.toBeInTheDocument()
  })

  it('displays flat items (no nested sections) correctly', async () => {
    const flatResponse: FHIRQuestionnaireResponse[] = [
      {
        resourceType: 'QuestionnaireResponse',
        id: 'resp-flat',
        status: 'completed',
        authored: '2026-02-05T10:30:00Z',
        item: [
          {
            linkId: 'q1',
            text: 'Vorname',
            answer: [{ valueString: 'Anna' }],
          },
          {
            linkId: 'q2',
            text: 'Nachname',
            answer: [{ valueString: 'Schmidt' }],
          },
        ],
      },
    ]
    mockGetResponses.mockResolvedValue(flatResponse)

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Anna')).toBeInTheDocument()
    })
    expect(screen.getByText('Schmidt')).toBeInTheDocument()
  })

  it('shows valueCoding code when display is not available', async () => {
    const codingResponse: FHIRQuestionnaireResponse[] = [
      {
        resourceType: 'QuestionnaireResponse',
        id: 'resp-coding',
        status: 'completed',
        authored: '2026-02-05T10:30:00Z',
        item: [
          {
            linkId: 'section-test',
            text: 'Test',
            item: [
              {
                linkId: 'code-q',
                text: 'Code-Frage',
                answer: [{ valueCoding: { code: 'XYZ-123' } }],
              },
            ],
          },
        ],
      },
    ]
    mockGetResponses.mockResolvedValue(codingResponse)

    render(
      <QuestionnaireResponseModal
        patientId="p-123"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('XYZ-123')).toBeInTheDocument()
    })
  })
})
