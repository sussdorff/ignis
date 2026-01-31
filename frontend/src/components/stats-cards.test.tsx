import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCards } from './stats-cards'

describe('StatsCards', () => {
  it('renders all four stat cards', () => {
    render(<StatsCards />)

    expect(screen.getByText('Patienten heute')).toBeInTheDocument()
    expect(screen.getByText('Termine heute')).toBeInTheDocument()
    expect(screen.getByText('Wartezimmer')).toBeInTheDocument()
    expect(screen.getByText('Dringend')).toBeInTheDocument()
  })

  it('displays the correct values', () => {
    render(<StatsCards />)

    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('displays change descriptions', () => {
    render(<StatsCards />)

    expect(screen.getByText('+3 seit gestern')).toBeInTheDocument()
    expect(screen.getByText('4 noch offen')).toBeInTheDocument()
    expect(screen.getByText('~12 Min. Wartezeit')).toBeInTheDocument()
    expect(screen.getByText('Triage erforderlich')).toBeInTheDocument()
  })
})
