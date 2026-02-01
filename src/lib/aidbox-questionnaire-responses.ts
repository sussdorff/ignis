import { fhirClient } from './fhir-client'

/** FHIR R4 QuestionnaireResponse.item.answer - value types */
type QuestionnaireResponseAnswerValue =
  | { valueBoolean?: boolean }
  | { valueDecimal?: number }
  | { valueInteger?: number }
  | { valueDate?: string }
  | { valueDateTime?: string }
  | { valueTime?: string }
  | { valueString?: string }
  | { valueUri?: string }
  | { valueCoding?: { code: string; display?: string; system?: string } }
  | { valueQuantity?: { value: number; unit?: string; system?: string; code?: string } }
  | { valueReference?: { reference: string } }

/** FHIR R4 QuestionnaireResponse.item (input accepts flexible structure) */
export interface QuestionnaireResponseItem {
  linkId: string
  text?: string
  answer?: Array<QuestionnaireResponseAnswerValue | Record<string, unknown>>
  item?: QuestionnaireResponseItem[]
}

/** FHIR R4 QuestionnaireResponse resource */
export interface FHIRQuestionnaireResponse {
  resourceType: 'QuestionnaireResponse'
  id?: string
  questionnaire?: string
  status: 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped'
  subject?: { reference: string }
  encounter?: { reference: string }
  authored?: string
  author?: { reference: string }
  source?: { reference: string }
  item?: QuestionnaireResponseItem[]
}

/** Input for creating a QuestionnaireResponse (API-friendly) */
export interface CreateQuestionnaireResponseInput {
  patientId?: string
  questionnaire?: string
  status: 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped'
  item?: QuestionnaireResponseItem[]
  encounterId?: string
  authored?: string
  author?: string
}

const DEFAULT_QUESTIONNAIRE = 'Questionnaire/patient-intake-de'

/**
 * Create a FHIR QuestionnaireResponse in Aidbox.
 * @param input - Questionnaire response data
 * @returns The created FHIR QuestionnaireResponse
 */
export async function createQuestionnaireResponse(
  input: CreateQuestionnaireResponseInput
): Promise<FHIRQuestionnaireResponse> {
  const questionnaire = input.questionnaire ?? DEFAULT_QUESTIONNAIRE
  // Normalize questionnaire to canonical/Reference format (e.g. "patient-intake-de" -> "Questionnaire/patient-intake-de")
  const questionnaireRef = questionnaire.startsWith('Questionnaire/')
    ? questionnaire
    : `Questionnaire/${questionnaire}`

  const resource: FHIRQuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    questionnaire: questionnaireRef,
    status: input.status,
    authored: input.authored ?? new Date().toISOString(),
    item: input.item ?? [],
  }

  if (input.patientId) {
    resource.subject = {
      reference: input.patientId.startsWith('Patient/')
        ? input.patientId
        : `Patient/${input.patientId}`,
    }
  }

  if (input.encounterId) {
    resource.encounter = {
      reference: input.encounterId.startsWith('Encounter/')
        ? input.encounterId
        : `Encounter/${input.encounterId}`,
    }
  }

  if (input.author) {
    resource.author = {
      reference: input.author.startsWith('Patient/') || input.author.startsWith('Device/')
        ? input.author
        : `Device/${input.author}`,
    }
  }

  const created = await fhirClient.post<FHIRQuestionnaireResponse>(
    'QuestionnaireResponse',
    resource
  )
  return created
}
