import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { StatsCards } from './stats-cards'

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

// Mock the API functions
vi.mock('@/lib/api', () => ({
  getQueueStats: vi.fn(() => Promise.resolve({
    total: 24,
    wartend: 3,
    aufgerufen: 2,
    inBehandlung: 5,
    dringend: 1,
    notfall: 1,
  })),
  getTodayAppointments: vi.fn(() => Promise.resolve([
    { id: '1', status: 'booked' },
    { id: '2', status: 'booked' },
    { id: '3', status: 'booked' },
    { id: '4', status: 'booked' },
    { id: '5', status: 'arrived' },
    { id: '6', status: 'fulfilled' },
    { id: '7', status: 'fulfilled' },
    { id: '8', status: 'fulfilled' },
    { id: '9', status: 'fulfilled' },
    { id: '10', status: 'fulfilled' },
    { id: '11', status: 'fulfilled' },
    { id: '12', status: 'fulfilled' },
    { id: '13', status: 'fulfilled' },
    { id: '14', status: 'fulfilled' },
    { id: '15', status: 'fulfilled' },
    { id: '16', status: 'fulfilled' },
    { id: '17', status: 'fulfilled' },
    { id: '18', status: 'fulfilled' },
  ])),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StatsCards', () => {
  it('renders all four stat cards', async () => {
    render(<StatsCards />)

    await waitFor(() => {
      expect(screen.getByText('Patienten heute')).toBeInTheDocument()
    })
    expect(screen.getByText('Termine heute')).toBeInTheDocument()
    expect(screen.getByText('Wartezimmer')).toBeInTheDocument()
    expect(screen.getByText('Dringend')).toBeInTheDocument()
  })

  it('displays the correct values from API', async () => {
    render(<StatsCards />)

    await waitFor(() => {
      expect(screen.getByText('24')).toBeInTheDocument() // total queue
    })
    expect(screen.getByText('18')).toBeInTheDocument() // appointments
    expect(screen.getByText('3')).toBeInTheDocument() // waiting
    expect(screen.getByText('2')).toBeInTheDocument() // urgent (dringend + notfall)
  })

  it('displays change descriptions', async () => {
    render(<StatsCards />)

    await waitFor(() => {
      expect(screen.getByText('5 in Behandlung')).toBeInTheDocument()
    })
    expect(screen.getByText('4 noch offen')).toBeInTheDocument()
    expect(screen.getByText('2 aufgerufen')).toBeInTheDocument()
    expect(screen.getByText('Triage erforderlich')).toBeInTheDocument()
  })

  it('shows loading state initially', async () => {
    render(<StatsCards />)

    // Should show skeleton cards during loading
    const skeletonCards = document.querySelectorAll('.animate-pulse')
    expect(skeletonCards.length).toBeGreaterThan(0)

    // Wait for loading to complete to avoid act() warning
    await waitFor(() => {
      expect(screen.getByText('Patienten heute')).toBeInTheDocument()
    })
  })
})
