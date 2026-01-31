export type QuestionType =
  | "text"
  | "number"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "date"
  | "textarea"

export interface QuestionOption {
  id: string
  label: string
  value: string | number
  nextQuestionId?: string // For conditional logic
  triageWeight?: number // Weight for triage calculation
}

export interface Question {
  id: string
  type: QuestionType
  text: string
  description?: string
  options?: QuestionOption[]
  required: boolean
  nextQuestionId?: string // Default next question if no conditional logic
  placeholder?: string
  min?: number
  max?: number
  triageField?: string // Maps to triage assessment fields
}

export interface QuestionnaireFlow {
  id: string
  name: string
  description: string
  startingQuestionId: string
  questions: Question[]
  category: "patient" | "symptom" | "intake" | "feedback" | "triage"
}

export interface QuestionnaireResponse {
  questionId: string
  answer: string | number | string[] | boolean
  timestamp: Date
}

// Triage questionnaire with conditional flow
export const mockQuestionnaire: QuestionnaireFlow = {
  id: "triage-assessment",
  name: "Online-Triage",
  description: "Bitte beantworten Sie einige Fragen zu Ihren Beschwerden",
  startingQuestionId: "name",
  category: "triage",
  questions: [
    {
      id: "name",
      type: "text",
      text: "Wie heißen Sie?",
      required: true,
      placeholder: "Vor- und Nachname",
      nextQuestionId: "birthdate",
      triageField: "patientName",
    },
    {
      id: "birthdate",
      type: "date",
      text: "Wann wurden Sie geboren?",
      required: true,
      nextQuestionId: "reason",
      triageField: "birthdate",
    },
    {
      id: "reason",
      type: "radio",
      text: "Was ist der Hauptgrund für Ihren Besuch?",
      required: true,
      triageField: "visitReason",
      options: [
        {
          id: "acute",
          label: "Akute Beschwerden",
          value: "acute",
          nextQuestionId: "emergency_check",
          triageWeight: 2,
        },
        {
          id: "routine",
          label: "Vorsorgeuntersuchung",
          value: "routine",
          nextQuestionId: "routine_type",
          triageWeight: 0,
        },
        {
          id: "followup",
          label: "Kontrolltermin",
          value: "followup",
          nextQuestionId: "followup_reason",
          triageWeight: 0,
        },
        {
          id: "prescription",
          label: "Rezept / Überweisung",
          value: "prescription",
          nextQuestionId: "prescription_type",
          triageWeight: 0,
        },
      ],
    },
    // Emergency check branch
    {
      id: "emergency_check",
      type: "checkbox",
      text: "Haben Sie eines der folgenden Symptome?",
      description: "Bitte alle zutreffenden auswählen",
      required: true,
      triageField: "emergencySymptoms",
      options: [
        { id: "chest_pain", label: "Starke Brustschmerzen", value: "chest_pain", triageWeight: 10 },
        { id: "breathing", label: "Atemnot", value: "breathing_difficulty", triageWeight: 10 },
        { id: "consciousness", label: "Bewusstseinsveränderungen", value: "consciousness", triageWeight: 10 },
        { id: "severe_bleeding", label: "Starke Blutung", value: "severe_bleeding", triageWeight: 10 },
        { id: "none", label: "Keines der oben genannten", value: "none", triageWeight: 0 },
      ],
      nextQuestionId: "symptoms",
    },
    {
      id: "symptoms",
      type: "multiselect",
      text: "Welche Beschwerden haben Sie?",
      description: "Mehrfachauswahl möglich",
      required: true,
      triageField: "symptoms",
      options: [
        { id: "headache", label: "Kopfschmerzen", value: "headache" },
        { id: "fever", label: "Fieber", value: "fever", nextQuestionId: "temperature" },
        { id: "cough", label: "Husten", value: "cough", nextQuestionId: "cough_type" },
        { id: "sore_throat", label: "Halsschmerzen", value: "sore_throat" },
        { id: "stomach", label: "Bauchschmerzen", value: "stomach_pain" },
        { id: "nausea", label: "Übelkeit / Erbrechen", value: "nausea" },
        { id: "back_pain", label: "Rückenschmerzen", value: "back_pain" },
        { id: "joint_pain", label: "Gelenkschmerzen", value: "joint_pain" },
        { id: "skin", label: "Hautprobleme", value: "skin_issues" },
        { id: "other", label: "Andere", value: "other" },
      ],
      nextQuestionId: "duration",
    },
    {
      id: "temperature",
      type: "number",
      text: "Wie hoch ist Ihre Temperatur?",
      description: "In Grad Celsius",
      required: true,
      min: 35,
      max: 42,
      placeholder: "z.B. 38.5",
      triageField: "temperature",
      nextQuestionId: "duration",
    },
    {
      id: "cough_type",
      type: "radio",
      text: "Welche Art von Husten haben Sie?",
      required: true,
      triageField: "coughType",
      options: [
        { id: "dry", label: "Trockener Reizhusten", value: "dry" },
        { id: "productive", label: "Husten mit Auswurf", value: "productive" },
        { id: "bloody", label: "Husten mit Blut", value: "bloody", triageWeight: 5 },
      ],
      nextQuestionId: "duration",
    },
    {
      id: "duration",
      type: "radio",
      text: "Seit wann haben Sie diese Beschwerden?",
      required: true,
      triageField: "symptomDuration",
      options: [
        { id: "hours", label: "Seit einigen Stunden", value: "hours", triageWeight: 3 },
        { id: "days", label: "Seit 1-3 Tagen", value: "days", triageWeight: 2 },
        { id: "week", label: "Seit etwa einer Woche", value: "week", triageWeight: 1 },
        { id: "longer", label: "Länger als eine Woche", value: "longer", triageWeight: 0 },
      ],
      nextQuestionId: "severity",
    },
    {
      id: "severity",
      type: "radio",
      text: "Wie stark sind Ihre Beschwerden?",
      description: "Auf einer Skala von leicht bis sehr stark",
      required: true,
      triageField: "severity",
      options: [
        { id: "mild", label: "Leicht - ich kann meinen Alltag bewältigen", value: "mild", triageWeight: 0 },
        { id: "moderate", label: "Mäßig - ich bin etwas eingeschränkt", value: "moderate", triageWeight: 1 },
        { id: "severe", label: "Stark - ich bin deutlich eingeschränkt", value: "severe", triageWeight: 3 },
        { id: "very_severe", label: "Sehr stark - ich kann kaum noch etwas tun", value: "very_severe", triageWeight: 5 },
      ],
      nextQuestionId: "chronic",
    },
    {
      id: "chronic",
      type: "checkbox",
      text: "Haben Sie bekannte Vorerkrankungen?",
      required: false,
      triageField: "chronicConditions",
      options: [
        { id: "diabetes", label: "Diabetes", value: "diabetes", triageWeight: 1 },
        { id: "hypertension", label: "Bluthochdruck", value: "hypertension", triageWeight: 1 },
        { id: "heart", label: "Herzerkrankung", value: "heart_disease", triageWeight: 2 },
        { id: "lung", label: "Lungenerkrankung (z.B. Asthma, COPD)", value: "lung_disease", triageWeight: 2 },
        { id: "immune", label: "Immunschwäche", value: "immunodeficiency", triageWeight: 2 },
        { id: "none", label: "Keine bekannten Vorerkrankungen", value: "none" },
      ],
      nextQuestionId: "medications",
    },
    {
      id: "medications",
      type: "textarea",
      text: "Welche Medikamente nehmen Sie regelmäßig ein?",
      required: false,
      placeholder: "z.B. Aspirin 100mg täglich, Metformin 500mg...",
      triageField: "medications",
      nextQuestionId: "allergies",
    },
    {
      id: "allergies",
      type: "textarea",
      text: "Haben Sie bekannte Allergien?",
      required: false,
      placeholder: "z.B. Penicillin, Pollen, Hausstaubmilben...",
      triageField: "allergies",
      nextQuestionId: "notes",
    },
    {
      id: "notes",
      type: "textarea",
      text: "Möchten Sie noch etwas hinzufügen?",
      required: false,
      placeholder: "Weitere Informationen für den Arzt...",
      triageField: "additionalNotes",
    },
    // Routine branch
    {
      id: "routine_type",
      type: "radio",
      text: "Um welche Art von Vorsorge handelt es sich?",
      required: true,
      triageField: "routineType",
      options: [
        { id: "checkup", label: "Allgemeiner Gesundheitscheck", value: "general_checkup" },
        { id: "vaccination", label: "Impfung", value: "vaccination" },
        { id: "screening", label: "Krebsvorsorge", value: "cancer_screening" },
        { id: "other", label: "Andere Vorsorge", value: "other" },
      ],
      nextQuestionId: "chronic",
    },
    // Followup branch
    {
      id: "followup_reason",
      type: "text",
      text: "Wegen welcher Erkrankung ist der Kontrolltermin?",
      required: true,
      placeholder: "z.B. Bluthochdruck, Diabetes...",
      triageField: "followupReason",
      nextQuestionId: "followup_status",
    },
    {
      id: "followup_status",
      type: "radio",
      text: "Wie geht es Ihnen seit dem letzten Besuch?",
      required: true,
      triageField: "followupStatus",
      options: [
        { id: "better", label: "Besser", value: "better" },
        { id: "same", label: "Unverändert", value: "same" },
        { id: "worse", label: "Schlechter", value: "worse", triageWeight: 2 },
      ],
      nextQuestionId: "notes",
    },
    // Prescription branch
    {
      id: "prescription_type",
      type: "radio",
      text: "Was benötigen Sie?",
      required: true,
      triageField: "prescriptionType",
      options: [
        { id: "repeat", label: "Folgerezept für bekanntes Medikament", value: "repeat_prescription" },
        { id: "referral", label: "Überweisung zum Facharzt", value: "referral" },
        { id: "certificate", label: "Attest / Bescheinigung", value: "certificate" },
      ],
      nextQuestionId: "prescription_details",
    },
    {
      id: "prescription_details",
      type: "textarea",
      text: "Bitte geben Sie weitere Details an",
      description: "z.B. Medikamentenname, gewünschter Facharzt...",
      required: true,
      placeholder: "Details...",
      triageField: "prescriptionDetails",
    },
  ],
}

// Helper to calculate triage from responses
export function calculateTriageFromResponses(
  responses: QuestionnaireResponse[],
  questions: Question[]
): { level: "notfall" | "dringend" | "normal"; score: number; factors: string[] } {
  let score = 0
  const factors: string[] = []

  for (const response of responses) {
    const question = questions.find((q) => q.id === response.questionId)
    if (!question?.options) continue

    const answers = Array.isArray(response.answer) ? response.answer : [response.answer]

    for (const answer of answers) {
      const option = question.options.find((o) => String(o.value) === String(answer))
      if (option?.triageWeight) {
        score += option.triageWeight
        if (option.triageWeight >= 5) {
          factors.push(option.label)
        }
      }
    }
  }

  // Check temperature if present
  const tempResponse = responses.find((r) => r.questionId === "temperature")
  if (tempResponse) {
    const temp = Number(tempResponse.answer)
    if (temp >= 40) {
      score += 5
      factors.push(`Hohes Fieber (${temp}°C)`)
    } else if (temp >= 39) {
      score += 2
      factors.push(`Fieber (${temp}°C)`)
    }
  }

  let level: "notfall" | "dringend" | "normal"
  if (score >= 8) {
    level = "notfall"
  } else if (score >= 3) {
    level = "dringend"
  } else {
    level = "normal"
  }

  return { level, score, factors }
}
