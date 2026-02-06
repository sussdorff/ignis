/**
 * Seed script to create QuestionnaireResponse resources for today's patients.
 *
 * For each patient (patient-10 through patient-20), this script:
 * 1. Fetches their Conditions and MedicationRequests from Aidbox
 * 2. Maps SNOMED conditions to questionnaire chronic-condition codes
 * 3. Maps MedicationRequests to medication text
 * 4. Builds a full QuestionnaireResponse with realistic dummy data
 * 5. PUTs it to Aidbox (idempotent)
 *
 * ~60-70% of patients get responses; ~20% are "in-progress".
 *
 * Run with: bun run scripts/seed-questionnaire-responses.ts
 */

import { fhirClient } from '../src/lib/fhir-client'
import type { FHIRQuestionnaireResponse, QuestionnaireResponseItem } from '../src/lib/aidbox-questionnaire-responses'

// ---------------------------------------------------------------------------
// Types for Synthea FHIR resources
// ---------------------------------------------------------------------------

export interface SyntheaCondition {
  code: {
    coding: Array<{ system?: string; code?: string; display?: string }>
  }
}

export interface SyntheaMedicationRequest {
  medicationCodeableConcept: {
    coding: Array<{ system?: string; code?: string; display?: string }>
  }
}

// ---------------------------------------------------------------------------
// SNOMED condition → questionnaire code mapping
// ---------------------------------------------------------------------------

const CONDITION_MAP: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /diabetes|prediabetes/i, code: 'diabetes' },
  { pattern: /hypertension/i, code: 'hypertension' },
  { pattern: /heart|coronary|cardiac/i, code: 'heart-disease' },
  { pattern: /asthma/i, code: 'asthma' },
  { pattern: /copd|chronic obstructive/i, code: 'copd' },
  { pattern: /neoplasm|cancer|malignant/i, code: 'cancer' },
  { pattern: /thyroid/i, code: 'thyroid' },
  { pattern: /kidney|renal/i, code: 'kidney' },
  { pattern: /liver|hepatic/i, code: 'liver' },
  { pattern: /depression|depressive|anxiety/i, code: 'depression' },
]

/**
 * Map FHIR Conditions to questionnaire chronic-condition answer codes.
 */
export function mapConditionsToAnswers(
  conditions: SyntheaCondition[]
): Array<{ valueCoding: { code: string } }> {
  const matched = new Set<string>()

  for (const cond of conditions) {
    const display = cond.code?.coding?.[0]?.display ?? ''
    for (const { pattern, code } of CONDITION_MAP) {
      if (pattern.test(display)) {
        matched.add(code)
        break
      }
    }
  }

  return Array.from(matched).map((code) => ({ valueCoding: { code } }))
}

/**
 * Map FHIR MedicationRequests to a medication details text string.
 */
export function mapMedicationsToAnswers(meds: SyntheaMedicationRequest[]): string {
  if (meds.length === 0) return ''
  return meds
    .map((m) => m.medicationCodeableConcept?.coding?.[0]?.display ?? m.medicationCodeableConcept?.coding?.[0]?.code ?? '')
    .filter(Boolean)
    .join(', ')
}

// ---------------------------------------------------------------------------
// Realistic dummy data pools
// ---------------------------------------------------------------------------

const VISIT_REASONS = ['acute', 'chronic', 'preventive', 'followup', 'other'] as const
const INSURANCE_TYPES = ['gesetzlich', 'privat'] as const
const PAIN_LOCATIONS = ['Kopf', 'Rücken', 'Bauch', 'Brust', 'Gelenke', 'Hals'] as const
const SMOKING = ['never', 'former', 'current'] as const
const ALCOHOL = ['never', 'occasionally', 'moderate', 'daily'] as const
const EXERCISE = ['never', 'rarely', 'weekly', 'daily'] as const
const SLEEP = ['good', 'moderate', 'poor', 'very-poor'] as const
const STRESS = ['low', 'moderate', 'high', 'very-high'] as const
const DIET = ['mixed', 'vegetarian', 'vegan', 'other'] as const
const CONTRACEPTION = ['none', 'pill', 'iud', 'other'] as const
const ALLERGY_TYPES = ['Medikamente', 'Nahrungsmittel', 'Pollen', 'Hausstaubmilben', 'Tierhaare'] as const
const OCCUPATIONS = ['Büroangestellte/r', 'Lehrer/in', 'Ingenieur/in', 'Krankenpfleger/in', 'Selbstständig', 'Rentner/in', 'Student/in'] as const

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ---------------------------------------------------------------------------
// Build QuestionnaireResponse
// ---------------------------------------------------------------------------

interface BuildOptions {
  patientId: string
  status: 'completed' | 'in-progress'
  conditionAnswers: Array<{ valueCoding: { code: string } }>
  medicationText: string
  gender: 'male' | 'female'
}

/**
 * Build a full FHIR QuestionnaireResponse for patient-intake-de.
 */
export function buildQuestionnaireResponse(options: BuildOptions): FHIRQuestionnaireResponse {
  const { patientId, status, conditionAnswers, medicationText, gender } = options

  const allSections = buildAllSections(conditionAnswers, medicationText, gender)

  // For in-progress: include only a subset of sections (personal, symptoms, consent)
  let sections: QuestionnaireResponseItem[]
  if (status === 'in-progress') {
    const keep = ['section-personal', 'section-symptoms', 'section-consent']
    sections = allSections.filter((s) => keep.includes(s.linkId))
  } else {
    sections = allSections
  }

  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: 'Questionnaire/patient-intake-de',
    status,
    subject: { reference: patientId.startsWith('Patient/') ? patientId : `Patient/${patientId}` },
    authored: new Date().toISOString(),
    item: sections,
  }
}

function buildAllSections(
  conditionAnswers: Array<{ valueCoding: { code: string } }>,
  medicationText: string,
  gender: 'male' | 'female'
): QuestionnaireResponseItem[] {
  const hasPain = Math.random() > 0.3
  const hasAllergies = Math.random() > 0.6
  const hasFamilyHistory = Math.random() > 0.5
  const hasConditions = conditionAnswers.length > 0
  const hasMeds = medicationText.length > 0

  return [
    // section-personal
    {
      linkId: 'section-personal',
      item: [
        { linkId: 'insurance-type', answer: [{ valueCoding: { code: pick(INSURANCE_TYPES) } }] },
        { linkId: 'visit-reason', answer: [{ valueCoding: { code: pick(VISIT_REASONS) } }] },
      ],
    },
    // section-symptoms
    {
      linkId: 'section-symptoms',
      item: [
        { linkId: 'has-pain', answer: [{ valueBoolean: hasPain }] },
        ...(hasPain
          ? [
              { linkId: 'pain-location', answer: [{ valueString: pick(PAIN_LOCATIONS) }] },
              { linkId: 'pain-intensity', answer: [{ valueInteger: randomInt(1, 10) }] },
              { linkId: 'pain-duration', answer: [{ valueString: `${randomInt(1, 14)} Tage` }] },
            ]
          : []),
        { linkId: 'symptom-onset', answer: [{ valueString: `Vor ${randomInt(1, 30)} Tagen` }] },
        { linkId: 'symptom-description', answer: [{ valueString: 'Beschwerden seit einigen Tagen' }] },
        { linkId: 'fever', answer: [{ valueBoolean: Math.random() > 0.7 }] },
      ],
    },
    // section-medical-history
    {
      linkId: 'section-medical-history',
      item: [
        { linkId: 'has-chronic-conditions', answer: [{ valueBoolean: hasConditions }] },
        ...(hasConditions
          ? [{ linkId: 'chronic-conditions', answer: conditionAnswers }]
          : []),
      ],
    },
    // section-medications
    {
      linkId: 'section-medications',
      item: [
        { linkId: 'takes-medications', answer: [{ valueBoolean: hasMeds }] },
        ...(hasMeds
          ? [{ linkId: 'medication-details', answer: [{ valueString: medicationText }] }]
          : []),
      ],
    },
    // section-allergies
    {
      linkId: 'section-allergies',
      item: [
        { linkId: 'has-allergies', answer: [{ valueBoolean: hasAllergies }] },
        ...(hasAllergies
          ? [
              { linkId: 'allergy-types', answer: [{ valueString: pick(ALLERGY_TYPES) }] },
              { linkId: 'allergy-details', answer: [{ valueString: 'Leichte Reaktion' }] },
              { linkId: 'allergy-severity', answer: [{ valueString: pick(['mild', 'moderate', 'severe'] as const) }] },
            ]
          : []),
        { linkId: 'has-intolerances', answer: [{ valueBoolean: Math.random() > 0.7 }] },
      ],
    },
    // section-lifestyle
    {
      linkId: 'section-lifestyle',
      item: [
        { linkId: 'smoking-status', answer: [{ valueCoding: { code: pick(SMOKING) } }] },
        { linkId: 'alcohol-consumption', answer: [{ valueCoding: { code: pick(ALCOHOL) } }] },
        { linkId: 'exercise-frequency', answer: [{ valueCoding: { code: pick(EXERCISE) } }] },
        { linkId: 'sleep-quality', answer: [{ valueCoding: { code: pick(SLEEP) } }] },
        { linkId: 'stress-level', answer: [{ valueCoding: { code: pick(STRESS) } }] },
        { linkId: 'diet-type', answer: [{ valueCoding: { code: pick(DIET) } }] },
        { linkId: 'occupation', answer: [{ valueString: pick(OCCUPATIONS) }] },
      ],
    },
    // section-family-history
    {
      linkId: 'section-family-history',
      item: [
        { linkId: 'has-family-history', answer: [{ valueBoolean: hasFamilyHistory }] },
        ...(hasFamilyHistory
          ? [{ linkId: 'family-conditions', answer: [{ valueString: 'Herz-Kreislauf-Erkrankungen' }] }]
          : []),
      ],
    },
    // section-women
    {
      linkId: 'section-women',
      item:
        gender === 'female'
          ? [
              { linkId: 'is-pregnant', answer: [{ valueBoolean: Math.random() > 0.85 }] },
              { linkId: 'contraception', answer: [{ valueCoding: { code: pick(CONTRACEPTION) } }] },
            ]
          : [{ linkId: 'is-pregnant', answer: [{ valueBoolean: false }] }],
    },
    // section-emergency
    {
      linkId: 'section-emergency',
      item: [
        { linkId: 'emergency-contact-name', answer: [{ valueString: 'Max Mustermann' }] },
        { linkId: 'emergency-contact-phone', answer: [{ valueString: '+49 170 1234567' }] },
        { linkId: 'emergency-contact-relationship', answer: [{ valueString: pick(['Ehepartner/in', 'Elternteil', 'Kind', 'Freund/in'] as const) }] },
      ],
    },
    // section-consent
    {
      linkId: 'section-consent',
      item: [
        { linkId: 'data-processing-consent', answer: [{ valueBoolean: true }] },
        { linkId: 'treatment-consent', answer: [{ valueBoolean: true }] },
      ],
    },
  ]
}

// ---------------------------------------------------------------------------
// Patient data matching seed-patients-today.ts
// ---------------------------------------------------------------------------

const SEED_PATIENTS = [
  { id: 'patient-10', gender: 'female' as const },
  { id: 'patient-11', gender: 'male' as const },
  { id: 'patient-12', gender: 'female' as const },
  { id: 'patient-13', gender: 'male' as const },
  { id: 'patient-14', gender: 'female' as const },
  { id: 'patient-15', gender: 'male' as const },
  { id: 'patient-16', gender: 'female' as const },
  { id: 'patient-17', gender: 'male' as const },
  { id: 'patient-18', gender: 'female' as const },
  { id: 'patient-19', gender: 'male' as const },
  { id: 'patient-20', gender: 'female' as const },
]

// Predefined conditions per patient for deterministic-ish seeding
const PATIENT_CONDITIONS: Record<string, SyntheaCondition[]> = {
  'patient-10': [], // Sabine Hoffmann - healthy
  'patient-11': [
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertension' }] } },
  ],
  'patient-12': [], // Claudia Richter - healthy
  'patient-13': [
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertension' }] } },
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Diabetes mellitus type 2 (disorder)' }] } },
  ],
  'patient-14': [
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '195967001', display: 'Asthma' }] } },
  ],
  'patient-15': [
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '53741008', display: 'Coronary Heart Disease' }] } },
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertension' }] } },
  ],
  'patient-16': [
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '40930008', display: 'Hypothyroidism (disorder)' }] } },
  ],
  'patient-17': [
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Diabetes mellitus type 2 (disorder)' }] } },
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '53741008', display: 'Coronary Heart Disease' }] } },
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '35489007', display: 'Depressive disorder' }] } },
  ],
  'patient-18': [], // Karin Werner - healthy (allergies only)
  'patient-19': [
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '53741008', display: 'Coronary Heart Disease' }] } },
  ],
  'patient-20': [
    { code: { coding: [{ system: 'http://snomed.info/sct', code: '35489007', display: 'Depressive disorder' }] } },
  ],
}

const PATIENT_MEDICATIONS: Record<string, SyntheaMedicationRequest[]> = {
  'patient-10': [],
  'patient-11': [
    { medicationCodeableConcept: { coding: [{ display: 'Ramipril 5 MG Oral Tablet' }] } },
  ],
  'patient-12': [],
  'patient-13': [
    { medicationCodeableConcept: { coding: [{ display: 'Metformin 500 MG Oral Tablet' }] } },
    { medicationCodeableConcept: { coding: [{ display: 'Ramipril 5 MG Oral Tablet' }] } },
  ],
  'patient-14': [
    { medicationCodeableConcept: { coding: [{ display: 'Salbutamol 100 MCG Inhalation' }] } },
  ],
  'patient-15': [
    { medicationCodeableConcept: { coding: [{ display: 'ASS 100 MG Oral Tablet' }] } },
    { medicationCodeableConcept: { coding: [{ display: 'Bisoprolol 5 MG Oral Tablet' }] } },
  ],
  'patient-16': [
    { medicationCodeableConcept: { coding: [{ display: 'L-Thyroxin 75 MCG Oral Tablet' }] } },
  ],
  'patient-17': [
    { medicationCodeableConcept: { coding: [{ display: 'Metformin 1000 MG Oral Tablet' }] } },
    { medicationCodeableConcept: { coding: [{ display: 'Citalopram 20 MG Oral Tablet' }] } },
    { medicationCodeableConcept: { coding: [{ display: 'ASS 100 MG Oral Tablet' }] } },
  ],
  'patient-18': [],
  'patient-19': [
    { medicationCodeableConcept: { coding: [{ display: 'Nitroglycerinspray 0.4 MG' }] } },
  ],
  'patient-20': [
    { medicationCodeableConcept: { coding: [{ display: 'Sertralin 50 MG Oral Tablet' }] } },
  ],
}

// Patients that will NOT get a response (~30% skip)
const SKIP_PATIENTS = new Set(['patient-12', 'patient-14', 'patient-18'])

// Patients that get in-progress responses (~20% of those with responses)
const IN_PROGRESS_PATIENTS = new Set(['patient-16', 'patient-20'])

// ---------------------------------------------------------------------------
// Main script
// ---------------------------------------------------------------------------

async function deleteExistingResponses() {
  console.log('Clearing existing seed QuestionnaireResponses...')
  let deleted = 0
  for (const p of SEED_PATIENTS) {
    const responseId = `qr-seed-${p.id}`
    try {
      await fhirClient.get(`QuestionnaireResponse/${responseId}`)
      // If it exists, delete by overwriting with entered-in-error then actually delete
      // Aidbox supports DELETE directly via fetch
      const url = `${process.env.AIDBOX_FHIR_URL ?? 'https://ignis.cognovis.de/fhir'}/QuestionnaireResponse/${responseId}`
      const credentials = `${process.env.AIDBOX_USER ?? 'admin'}:${process.env.AIDBOX_PASSWORD ?? 'ignis2026'}`
      const encoded = Buffer.from(credentials).toString('base64')
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${encoded}` },
      })
      if (res.ok || res.status === 204) {
        deleted++
      }
    } catch {
      // Resource doesn't exist, nothing to delete
    }
  }
  console.log(`  Deleted ${deleted} existing responses\n`)
}

async function seedQuestionnaireResponses() {
  console.log('Seeding QuestionnaireResponses for today\'s patients...\n')

  await deleteExistingResponses()

  let created = 0
  let skipped = 0
  let inProgress = 0

  for (const patient of SEED_PATIENTS) {
    if (SKIP_PATIENTS.has(patient.id)) {
      console.log(`  Skipping ${patient.id} (no response)`)
      skipped++
      continue
    }

    const conditions = PATIENT_CONDITIONS[patient.id] ?? []
    const medications = PATIENT_MEDICATIONS[patient.id] ?? []

    const conditionAnswers = mapConditionsToAnswers(conditions)
    const medicationText = mapMedicationsToAnswers(medications)

    const status = IN_PROGRESS_PATIENTS.has(patient.id) ? 'in-progress' : 'completed'
    if (status === 'in-progress') inProgress++

    const response = buildQuestionnaireResponse({
      patientId: patient.id,
      status,
      conditionAnswers,
      medicationText,
      gender: patient.gender,
    })

    const responseId = `qr-seed-${patient.id}`
    response.id = responseId

    try {
      await fhirClient.put(`QuestionnaireResponse/${responseId}`, response)
      const condCodes = conditionAnswers.map((a) => a.valueCoding.code).join(', ') || 'none'
      console.log(`  Created ${responseId} [${status}] conditions: [${condCodes}]`)
      created++
    } catch (err) {
      console.error(`  Failed to create response for ${patient.id}:`, err)
    }
  }

  console.log(`\nSeeding complete!`)
  console.log(`  ${created} responses created (${inProgress} in-progress)`)
  console.log(`  ${skipped} patients skipped`)
}

// Run when executed directly
seedQuestionnaireResponses()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seeding failed:', err)
    process.exit(1)
  })
