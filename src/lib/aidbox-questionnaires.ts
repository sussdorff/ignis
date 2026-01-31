import { fhirClient } from './fhir-client'

/** FHIR R4 Questionnaire resource (simplified type) */
export interface FHIRQuestionnaire {
  resourceType: 'Questionnaire'
  id?: string
  url?: string
  version?: string
  name?: string
  title?: string
  status: 'draft' | 'active' | 'retired' | 'unknown'
  subjectType?: string[]
  date?: string
  publisher?: string
  description?: string
  purpose?: string
  item?: QuestionnaireItem[]
  meta?: {
    lastUpdated?: string
    versionId?: string
  }
}

/** FHIR R4 Questionnaire.item */
export interface QuestionnaireItem {
  linkId: string
  text?: string
  type: 'group' | 'display' | 'boolean' | 'decimal' | 'integer' | 'date' | 'dateTime' | 'time' | 'string' | 'text' | 'url' | 'choice' | 'open-choice' | 'attachment' | 'reference' | 'quantity'
  required?: boolean
  repeats?: boolean
  enableWhen?: EnableWhen[]
  enableBehavior?: 'all' | 'any'
  answerOption?: AnswerOption[]
  item?: QuestionnaireItem[]
  extension?: Extension[]
}

interface EnableWhen {
  question: string
  operator: 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<='
  answerBoolean?: boolean
  answerCoding?: { code: string; display?: string }
  answerString?: string
  answerInteger?: number
}

interface AnswerOption {
  valueCoding?: { code: string; display?: string; system?: string }
  valueString?: string
  valueInteger?: number
}

interface Extension {
  url: string
  valueCodeableConcept?: { coding: Array<{ code: string; display?: string }> }
  valueInteger?: number
  valueString?: string
}

/** FHIR Bundle for search results */
interface FHIRBundle<T> {
  resourceType: 'Bundle'
  type: string
  total?: number
  entry?: Array<{ resource: T }>
}

/**
 * Fetch a Questionnaire by its logical ID.
 * @param id - Questionnaire logical ID (e.g., "patient-intake-de")
 * @returns The Questionnaire resource or null if not found
 */
export async function getQuestionnaireById(id: string): Promise<FHIRQuestionnaire | null> {
  try {
    const questionnaire = await fhirClient.get<FHIRQuestionnaire>(`Questionnaire/${id}`)
    return questionnaire
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('404') || message.includes('not found')) {
      return null
    }
    throw err
  }
}

/**
 * Search for Questionnaires by name or status.
 * @param params - Search parameters
 * @returns Array of matching Questionnaires
 */
export async function searchQuestionnaires(params?: {
  name?: string
  status?: 'draft' | 'active' | 'retired'
  title?: string
}): Promise<FHIRQuestionnaire[]> {
  const searchParams = new URLSearchParams()

  if (params?.name) {
    searchParams.set('name', params.name)
  }
  if (params?.status) {
    searchParams.set('status', params.status)
  }
  if (params?.title) {
    searchParams.set('title', params.title)
  }

  const query = searchParams.toString()
  const path = query ? `Questionnaire?${query}` : 'Questionnaire'

  const bundle = await fhirClient.get<FHIRBundle<FHIRQuestionnaire>>(path)
  return bundle.entry?.map((e) => e.resource) ?? []
}

/**
 * Get all active Questionnaires.
 * @returns Array of active Questionnaires
 */
export async function getActiveQuestionnaires(): Promise<FHIRQuestionnaire[]> {
  return searchQuestionnaires({ status: 'active' })
}

/**
 * Convenience function to get the patient intake questionnaire.
 * Uses the known ID "patient-intake-de".
 */
export async function getPatientIntakeQuestionnaire(): Promise<FHIRQuestionnaire | null> {
  return getQuestionnaireById('patient-intake-de')
}
