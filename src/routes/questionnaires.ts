import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  getQuestionnaireById,
  searchQuestionnaires,
  getActiveQuestionnaires,
  getPatientIntakeQuestionnaire,
} from '../lib/aidbox-questionnaires'
import {
  createQuestionnaireResponse,
  getQuestionnaireResponsesByPatient,
} from '../lib/aidbox-questionnaire-responses'
import {
  QuestionnaireResponseSubmitSchema,
  WrappedQuestionnaireResponseSchema,
} from '../lib/schemas'
import type { CreateQuestionnaireResponseInput } from '../lib/aidbox-questionnaire-responses'

const questionnaires = new Hono()

// =============================================================================
// GET /api/questionnaires - list all questionnaires or search
// Query params: name, status, title
// =============================================================================
questionnaires.get('/', async (c) => {
  const { name, status, title } = c.req.query()

  // If any search params provided, perform filtered search
  if (name || status || title) {
    const results = await searchQuestionnaires({
      name: name || undefined,
      status: status as 'draft' | 'active' | 'retired' | undefined,
      title: title || undefined,
    })
    return c.json(results, 200)
  }

  // Default: return all active questionnaires
  const active = await getActiveQuestionnaires()
  return c.json(active, 200)
})

// =============================================================================
// POST /api/questionnaires/responses - store chat/voice collected questionnaire
// Accepts either API-friendly format or wrapped { questionnaireResponse: {...} }
// =============================================================================
const QuestionnaireResponseBodySchema = z.union([
  QuestionnaireResponseSubmitSchema,
  WrappedQuestionnaireResponseSchema,
])

function normalizeToInput(body: z.infer<typeof QuestionnaireResponseBodySchema>): CreateQuestionnaireResponseInput {
  if ('questionnaireResponse' in body) {
    const qr = body.questionnaireResponse
    const subjectRef = qr.subject?.reference
    const patientId = subjectRef?.startsWith('Patient/')
      ? subjectRef.slice('Patient/'.length)
      : subjectRef
    const encounterRef = qr.encounter?.reference
    const encounterId = encounterRef?.startsWith('Encounter/')
      ? encounterRef.slice('Encounter/'.length)
      : encounterRef
    return {
      patientId: patientId ?? undefined,
      questionnaire: qr.questionnaire,
      status: qr.status,
      item: (qr.item ?? []) as CreateQuestionnaireResponseInput['item'],
      encounterId: encounterId ?? undefined,
      authored: qr.authored,
      author: qr.author?.reference,
    }
  }
  return {
    patientId: body.patientId,
    questionnaire: body.questionnaire,
    status: body.status,
    item: (body.item ?? []) as CreateQuestionnaireResponseInput['item'],
    encounterId: body.encounterId,
    authored: body.authored,
    author: body.author,
  }
}

// =============================================================================
// GET /api/questionnaires/responses?patientId=xxx - fetch by patient (ig-1nb)
// =============================================================================
questionnaires.get('/responses', async (c) => {
  const patientId = c.req.query('patientId')
  if (!patientId || patientId.trim() === '') {
    return c.json(
      { error: 'validation_failed', message: 'patientId query parameter is required' },
      400
    )
  }

  try {
    const responses = await getQuestionnaireResponsesByPatient(patientId)
    return c.json({ responses }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404') || message.includes('not found')) {
      return c.json({ error: 'not_found', message }, 404)
    }
    throw err
  }
})

questionnaires.post(
  '/responses',
  zValidator('json', QuestionnaireResponseBodySchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join('; ')
      return c.json({ error: 'validation_failed', message }, 400)
    }
  }),
  async (c) => {
    const body = c.req.valid('json')
    const input = normalizeToInput(body)

    try {
      const created = await createQuestionnaireResponse(input)
      return c.json(created, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('not found') || message.includes('404')) {
        return c.json({ error: 'not_found', message }, 404)
      }
      throw err
    }
  }
)

// =============================================================================
// GET /api/questionnaires/patient-intake - convenience endpoint
// Returns the patient intake questionnaire directly
// =============================================================================
questionnaires.get('/patient-intake', async (c) => {
  const questionnaire = await getPatientIntakeQuestionnaire()

  if (!questionnaire) {
    return c.json(
      { error: 'not_found', message: 'Patient intake questionnaire not found' },
      404
    )
  }

  return c.json(questionnaire, 200)
})

// =============================================================================
// GET /api/questionnaires/:id - get a specific questionnaire by ID
// =============================================================================
questionnaires.get('/:id', async (c) => {
  const id = c.req.param('id')
  const questionnaire = await getQuestionnaireById(id)

  if (!questionnaire) {
    return c.json({ error: 'not_found', message: `Questionnaire '${id}' not found` }, 404)
  }

  return c.json(questionnaire, 200)
})

export default questionnaires
