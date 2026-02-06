import { describe, it, expect } from 'bun:test'
import {
  mapConditionsToAnswers,
  mapMedicationsToAnswers,
  buildQuestionnaireResponse,
  type SyntheaCondition,
  type SyntheaMedicationRequest,
} from '../../scripts/seed-questionnaire-responses'
import { fhirClient } from '../lib/fhir-client'

describe('seed-questionnaire-responses mapping functions', () => {
  describe('mapConditionsToAnswers', () => {
    it('maps Diabetes condition to diabetes code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Diabetes mellitus type 2 (disorder)' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'diabetes' } })
    })

    it('maps Hypertension condition to hypertension code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertension' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'hypertension' } })
    })

    it('maps Coronary Heart Disease to heart-disease code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '53741008', display: 'Coronary Heart Disease' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'heart-disease' } })
    })

    it('maps Asthma condition to asthma code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '195967001', display: 'Asthma' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'asthma' } })
    })

    it('maps COPD condition to copd code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '13645005', display: 'Chronic obstructive lung disease (COPD)' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'copd' } })
    })

    it('maps Malignant neoplasm to cancer code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '254837009', display: 'Malignant neoplasm of breast' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'cancer' } })
    })

    it('maps Hypothyroidism to thyroid code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '40930008', display: 'Hypothyroidism (disorder)' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'thyroid' } })
    })

    it('maps Chronic kidney disease to kidney code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '431855005', display: 'Chronic kidney disease stage 3' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'kidney' } })
    })

    it('maps Depression to depression code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '35489007', display: 'Depressive disorder' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'depression' } })
    })

    it('maps Anxiety to depression code', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '197480006', display: 'Generalized anxiety disorder' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toContainEqual({ valueCoding: { code: 'depression' } })
    })

    it('maps multiple conditions correctly', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Diabetes mellitus type 2' }] } },
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertension' }] } },
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '195967001', display: 'Asthma' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toHaveLength(3)
      const codes = answers.map((a: { valueCoding: { code: string } }) => a.valueCoding.code)
      expect(codes).toContain('diabetes')
      expect(codes).toContain('hypertension')
      expect(codes).toContain('asthma')
    })

    it('deduplicates mapped codes', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Diabetes mellitus type 2' }] } },
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '15777000', display: 'Prediabetes' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      const diabetesCodes = answers.filter((a: { valueCoding: { code: string } }) => a.valueCoding.code === 'diabetes')
      expect(diabetesCodes).toHaveLength(1)
    })

    it('returns empty array for unmapped conditions', () => {
      const conditions: SyntheaCondition[] = [
        { code: { coding: [{ system: 'http://snomed.info/sct', code: '999', display: 'Sprain of ankle' }] } },
      ]
      const answers = mapConditionsToAnswers(conditions)
      expect(answers).toHaveLength(0)
    })

    it('returns empty array for empty input', () => {
      const answers = mapConditionsToAnswers([])
      expect(answers).toHaveLength(0)
    })
  })

  describe('mapMedicationsToAnswers', () => {
    it('creates medication text from MedicationRequests', () => {
      const meds: SyntheaMedicationRequest[] = [
        { medicationCodeableConcept: { coding: [{ display: 'Metformin 500 MG Oral Tablet' }] } },
        { medicationCodeableConcept: { coding: [{ display: 'Lisinopril 10 MG Oral Tablet' }] } },
      ]
      const text = mapMedicationsToAnswers(meds)
      expect(text).toContain('Metformin 500 MG Oral Tablet')
      expect(text).toContain('Lisinopril 10 MG Oral Tablet')
    })

    it('returns empty string for no medications', () => {
      const text = mapMedicationsToAnswers([])
      expect(text).toBe('')
    })

    it('handles medication with missing display', () => {
      const meds: SyntheaMedicationRequest[] = [
        { medicationCodeableConcept: { coding: [{ code: '12345' }] } },
      ]
      const text = mapMedicationsToAnswers(meds)
      expect(text).toBe('12345')
    })
  })

  describe('buildQuestionnaireResponse', () => {
    it('produces valid FHIR QuestionnaireResponse structure', () => {
      const result = buildQuestionnaireResponse({
        patientId: 'patient-10',
        status: 'completed',
        conditionAnswers: [{ valueCoding: { code: 'diabetes' } }],
        medicationText: 'Metformin 500 MG Oral Tablet',
        gender: 'female',
      })

      expect(result.resourceType).toBe('QuestionnaireResponse')
      expect(result.questionnaire).toBe('Questionnaire/patient-intake-de')
      expect(result.status).toBe('completed')
      expect(result.subject?.reference).toBe('Patient/patient-10')
      expect(result.authored).toBeDefined()
      expect(Array.isArray(result.item)).toBe(true)
    })

    it('includes all 10 sections for completed response', () => {
      const result = buildQuestionnaireResponse({
        patientId: 'patient-10',
        status: 'completed',
        conditionAnswers: [],
        medicationText: '',
        gender: 'female',
      })

      const sectionLinkIds = result.item!.map((i) => i.linkId)
      expect(sectionLinkIds).toContain('section-personal')
      expect(sectionLinkIds).toContain('section-symptoms')
      expect(sectionLinkIds).toContain('section-medical-history')
      expect(sectionLinkIds).toContain('section-medications')
      expect(sectionLinkIds).toContain('section-allergies')
      expect(sectionLinkIds).toContain('section-lifestyle')
      expect(sectionLinkIds).toContain('section-family-history')
      expect(sectionLinkIds).toContain('section-women')
      expect(sectionLinkIds).toContain('section-emergency')
      expect(sectionLinkIds).toContain('section-consent')
    })

    it('includes fewer sections for in-progress response', () => {
      const result = buildQuestionnaireResponse({
        patientId: 'patient-11',
        status: 'in-progress',
        conditionAnswers: [],
        medicationText: '',
        gender: 'male',
      })

      expect(result.status).toBe('in-progress')
      // in-progress should have fewer items than completed
      expect(result.item!.length).toBeLessThan(10)
      // but should at least have personal and consent
      const sectionLinkIds = result.item!.map((i) => i.linkId)
      expect(sectionLinkIds).toContain('section-personal')
      expect(sectionLinkIds).toContain('section-consent')
    })

    it('maps chronic conditions into medical history section', () => {
      const result = buildQuestionnaireResponse({
        patientId: 'patient-10',
        status: 'completed',
        conditionAnswers: [
          { valueCoding: { code: 'diabetes' } },
          { valueCoding: { code: 'hypertension' } },
        ],
        medicationText: '',
        gender: 'female',
      })

      const medHistory = result.item!.find((i) => i.linkId === 'section-medical-history')
      expect(medHistory).toBeDefined()

      const hasChronicItem = medHistory!.item!.find((i) => i.linkId === 'has-chronic-conditions')
      expect(hasChronicItem?.answer).toEqual([{ valueBoolean: true }])

      const chronicItem = medHistory!.item!.find((i) => i.linkId === 'chronic-conditions')
      expect(chronicItem?.answer).toHaveLength(2)
    })

    it('maps medication text into medications section', () => {
      const result = buildQuestionnaireResponse({
        patientId: 'patient-10',
        status: 'completed',
        conditionAnswers: [],
        medicationText: 'Metformin 500 MG, Lisinopril 10 MG',
        gender: 'female',
      })

      const meds = result.item!.find((i) => i.linkId === 'section-medications')
      expect(meds).toBeDefined()

      const takesMeds = meds!.item!.find((i) => i.linkId === 'takes-medications')
      expect(takesMeds?.answer).toEqual([{ valueBoolean: true }])

      const medDetails = meds!.item!.find((i) => i.linkId === 'medication-details')
      expect(medDetails?.answer?.[0]).toHaveProperty('valueString', 'Metformin 500 MG, Lisinopril 10 MG')
    })

    it('skips women section for male patients', () => {
      const result = buildQuestionnaireResponse({
        patientId: 'patient-11',
        status: 'completed',
        conditionAnswers: [],
        medicationText: '',
        gender: 'male',
      })

      const womenSection = result.item!.find((i) => i.linkId === 'section-women')
      // For males, women section should have is-pregnant = false or be minimal
      if (womenSection) {
        const pregnant = womenSection.item!.find((i) => i.linkId === 'is-pregnant')
        expect(pregnant?.answer).toEqual([{ valueBoolean: false }])
      }
    })

    it('sets consent values to true', () => {
      const result = buildQuestionnaireResponse({
        patientId: 'patient-10',
        status: 'completed',
        conditionAnswers: [],
        medicationText: '',
        gender: 'female',
      })

      const consent = result.item!.find((i) => i.linkId === 'section-consent')
      expect(consent).toBeDefined()

      const dataConsent = consent!.item!.find((i) => i.linkId === 'data-processing-consent')
      expect(dataConsent?.answer).toEqual([{ valueBoolean: true }])

      const treatmentConsent = consent!.item!.find((i) => i.linkId === 'treatment-consent')
      expect(treatmentConsent?.answer).toEqual([{ valueBoolean: true }])
    })
  })

  describe('integration: script creates responses in Aidbox', () => {
    const testPatientId = 'patient-10'
    const responseId = `qr-seed-${testPatientId}`

    it('can create a QuestionnaireResponse via PUT', async () => {
      const response = buildQuestionnaireResponse({
        patientId: testPatientId,
        status: 'completed',
        conditionAnswers: [{ valueCoding: { code: 'hypertension' } }],
        medicationText: 'Ibuprofen 200 MG Oral Tablet',
        gender: 'female',
      })

      response.id = responseId

      const created = await fhirClient.put(`QuestionnaireResponse/${responseId}`, response)
      expect((created as { resourceType: string }).resourceType).toBe('QuestionnaireResponse')
      expect((created as { id: string }).id).toBe(responseId)
    })

    it('PUT is idempotent - second call updates same resource', async () => {
      const response = buildQuestionnaireResponse({
        patientId: testPatientId,
        status: 'completed',
        conditionAnswers: [{ valueCoding: { code: 'hypertension' } }],
        medicationText: 'Ibuprofen 200 MG Oral Tablet',
        gender: 'female',
      })

      response.id = responseId

      // Call twice
      await fhirClient.put(`QuestionnaireResponse/${responseId}`, response)
      const second = await fhirClient.put(`QuestionnaireResponse/${responseId}`, response)
      expect((second as { id: string }).id).toBe(responseId)

      // Verify only one resource with this ID exists
      const fetched = await fhirClient.get<{ resourceType: string; id: string }>(`QuestionnaireResponse/${responseId}`)
      expect(fetched.id).toBe(responseId)
    })
  })
})
