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

  describe('POST /api/questionnaires/responses', () => {
    it('stores API-friendly questionnaire response and returns 201', async () => {
      const body = {
        status: 'completed' as const,
        item: [
          { linkId: 'visit-reason', answer: [{ valueCoding: { code: 'acute' } }] },
          { linkId: 'symptom-location', answer: [{ valueCoding: { code: 'head' } }] },
        ],
      }
      const res = await fetch(`${BASE}/api/questionnaires/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.resourceType).toBe('QuestionnaireResponse')
      expect(data.status).toBe('completed')
      expect(data.questionnaire).toContain('patient-intake')
      expect(Array.isArray(data.item)).toBe(true)
      expect(data.item).toHaveLength(2)
      expect(data.item[0].linkId).toBe('visit-reason')
      expect(data.item[0].answer[0].valueCoding.code).toBe('acute')
      expect(data.id).toBeDefined()
    })

    it('stores wrapped questionnaireResponse format', async () => {
      const body = {
        questionnaireResponse: {
          questionnaire: 'Questionnaire/patient-intake-de',
          status: 'completed',
          item: [
            { linkId: 'visit-reason', answer: [{ valueCoding: { code: 'checkup' } }] },
          ],
        },
      }
      const res = await fetch(`${BASE}/api/questionnaires/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.resourceType).toBe('QuestionnaireResponse')
      expect(data.status).toBe('completed')
      expect(data.questionnaire).toBe('Questionnaire/patient-intake-de')
      expect(data.item[0].answer[0].valueCoding.code).toBe('checkup')
    })

    it('stores response with patientId (subject reference)', async () => {
      // Use existing patient from Aidbox seed data (patient-2 exists)
      const body = {
        patientId: 'patient-2',
        status: 'completed',
        item: [{ linkId: 'visit-reason', answer: [{ valueString: 'Routine checkup' }] }],
      }
      const res = await fetch(`${BASE}/api/questionnaires/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.subject?.reference).toBe('Patient/patient-2')
    })

    it('rejects invalid status with 400', async () => {
      const res = await fetch(`${BASE}/api/questionnaires/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid-status', item: [] }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('validation_failed')
    })

    it('rejects missing status with 400', async () => {
      const res = await fetch(`${BASE}/api/questionnaires/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: [] }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('validation_failed')
    })
  })
})
