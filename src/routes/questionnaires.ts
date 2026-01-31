import { Hono } from 'hono'
import {
  getQuestionnaireById,
  searchQuestionnaires,
  getActiveQuestionnaires,
  getPatientIntakeQuestionnaire,
} from '../lib/aidbox-questionnaires'

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
