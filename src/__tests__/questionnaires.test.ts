import { describe, it, expect } from 'bun:test'

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

interface FHIRQuestionnaire {
  resourceType: 'Questionnaire'
  id: string
  title?: string
  status: string
  item?: Array<{ linkId: string; text?: string; type: string }>
}

describe('Questionnaires API', () => {
  it('GET /api/questionnaires returns active questionnaires', async () => {
    const res = await fetch(`${BASE}/api/questionnaires`)
    expect(res.ok).toBe(true)

    const data = await res.json() as FHIRQuestionnaire[]
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)

    for (const q of data) {
      expect(q.resourceType).toBe('Questionnaire')
      expect(q.status).toBe('active')
    }
  })

  it('GET /api/questionnaires?status=active filters by status', async () => {
    const res = await fetch(`${BASE}/api/questionnaires?status=active`)
    expect(res.ok).toBe(true)

    const data = await res.json() as FHIRQuestionnaire[]
    expect(Array.isArray(data)).toBe(true)

    for (const q of data) {
      expect(q.status).toBe('active')
    }
  })

  it('GET /api/questionnaires/patient-intake returns patient intake form', async () => {
    const res = await fetch(`${BASE}/api/questionnaires/patient-intake`)
    expect(res.ok).toBe(true)

    const data = await res.json() as FHIRQuestionnaire
    expect(data.resourceType).toBe('Questionnaire')
    expect(data.id).toBe('patient-intake-de')
    expect(data.title).toBe('Patientenaufnahme - Anamnese')
    expect(data.status).toBe('active')
    expect(Array.isArray(data.item)).toBe(true)
    expect(data.item!.length).toBe(10) // 10 sections
  })

  it('GET /api/questionnaires/patient-intake-de returns same questionnaire by ID', async () => {
    const res = await fetch(`${BASE}/api/questionnaires/patient-intake-de`)
    expect(res.ok).toBe(true)

    const data = await res.json() as FHIRQuestionnaire
    expect(data.id).toBe('patient-intake-de')
    expect(data.resourceType).toBe('Questionnaire')
  })

  it('GET /api/questionnaires/nonexistent returns 404', async () => {
    const res = await fetch(`${BASE}/api/questionnaires/nonexistent`)
    expect(res.status).toBe(404)

    const data = await res.json() as { error: string; message: string }
    expect(data.error).toBe('not_found')
    expect(data.message).toContain('nonexistent')
  })

  it('patient-intake questionnaire has expected sections', async () => {
    const res = await fetch(`${BASE}/api/questionnaires/patient-intake`)
    const data = await res.json() as FHIRQuestionnaire

    const sectionTexts = data.item!.map((item) => item.text)
    expect(sectionTexts).toContain('Persönliche Angaben')
    expect(sectionTexts).toContain('Aktuelle Beschwerden')
    expect(sectionTexts).toContain('Vorerkrankungen')
    expect(sectionTexts).toContain('Aktuelle Medikation')
    expect(sectionTexts).toContain('Allergien und Unverträglichkeiten')
    expect(sectionTexts).toContain('Lebensstil')
    expect(sectionTexts).toContain('Familiengeschichte')
    expect(sectionTexts).toContain('Fragen für Frauen')
    expect(sectionTexts).toContain('Notfallkontakt')
    expect(sectionTexts).toContain('Einwilligung')
  })
})
