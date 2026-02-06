"use client"

import React, { useState, useMemo, useEffect } from "react"
import { ArrowLeft, Mic, MicOff, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { QuestionnaireForm } from "@/components/questionnaire-form"
import { QuestionnaireProgress } from "@/components/questionnaire-progress"
import { AppointmentSuggestion } from "@/components/appointment-suggestion"
import {
  type Question,
  type QuestionnaireFlow,
  type QuestionnaireResponse,
  convertFHIRToQuestionnaireFlow,
  getVisibleQuestions,
  calculateTriageFromResponses,
  mockQuestionnaire,
} from "@/lib/questionnaire-data"
import {
  getPatientIntakeQuestionnaire,
  submitQuestionnaireResponse,
  type QuestionnaireResponseItem,
} from "@/lib/api"
import { type TriageAssessment } from "@/lib/appointments-store"

/**
 * Convert local QuestionnaireResponse[] to FHIR QuestionnaireResponse items
 */
export function convertResponsesToFHIRItems(
  responses: QuestionnaireResponse[]
): QuestionnaireResponseItem[] {
  return responses.map((r) => {
    const item: QuestionnaireResponseItem = { linkId: r.questionId }

    if (typeof r.answer === "boolean") {
      item.answer = [{ valueBoolean: r.answer }]
    } else if (typeof r.answer === "number") {
      item.answer = [{ valueInteger: r.answer }]
    } else if (Array.isArray(r.answer)) {
      item.answer = r.answer.map((code) => ({ valueCoding: { code } }))
    } else {
      item.answer = [{ valueString: r.answer }]
    }

    return item
  })
}

export default function FragebogenPage() {
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireFlow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [responses, setResponses] = useState<QuestionnaireResponse[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [appointmentBooked, setAppointmentBooked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Submit responses to FHIR when questionnaire is completed
  useEffect(() => {
    if (!isComplete || responses.length === 0) return

    async function submitResponses() {
      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const fhirItems = convertResponsesToFHIRItems(responses)
        await submitQuestionnaireResponse({
          status: "completed",
          item: fhirItems,
          questionnaire: "Questionnaire/patient-intake-de",
          authored: new Date().toISOString(),
        })
        setSubmitSuccess(true)
      } catch (err) {
        console.error("Failed to submit questionnaire response:", err)
        setSubmitError("Antworten konnten nicht gespeichert werden.")
      } finally {
        setIsSubmitting(false)
      }
    }

    submitResponses()
  }, [isComplete, responses])

  // Fetch the questionnaire from the API
  useEffect(() => {
    async function loadQuestionnaire() {
      try {
        setIsLoading(true)
        const fhirQuestionnaire = await getPatientIntakeQuestionnaire()
        const converted = convertFHIRToQuestionnaireFlow(fhirQuestionnaire)
        setQuestionnaire(converted)
        setLoadError(null)
      } catch (err) {
        console.error("Failed to load questionnaire:", err)
        // Fallback to mock questionnaire
        setQuestionnaire(mockQuestionnaire)
        setLoadError(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadQuestionnaire()
  }, [])

  // Get visible questions based on conditional logic
  const visibleQuestions = useMemo(() => {
    if (!questionnaire) return []
    return getVisibleQuestions(questionnaire.questions, responses)
  }, [questionnaire, responses])

  const currentQuestion = visibleQuestions[currentQuestionIndex]

  // Calculate triage assessment from responses
  const triageAssessment = useMemo((): TriageAssessment | null => {
    if (!isComplete || !questionnaire) return null

    const triage = calculateTriageFromResponses(responses, questionnaire.questions)

    const reasonMap = {
      notfall: "Ihre Angaben weisen auf dringende Symptome hin, die sofortige Aufmerksamkeit erfordern.",
      dringend: "Ihre Symptome sollten zeitnah von einem Arzt untersucht werden.",
      normal: "Ihre Angaben deuten auf einen regulären Arztbesuch hin.",
    }

    const timeframeMap = {
      notfall: "Sofort",
      dringend: "Heute oder morgen",
      normal: "Innerhalb der nächsten Tage",
    }

    return {
      level: triage.level,
      suggestedTimeframe: timeframeMap[triage.level],
      reason:
        triage.factors.length > 0
          ? `${reasonMap[triage.level]} Faktoren: ${triage.factors.join(", ")}`
          : reasonMap[triage.level],
    }
  }, [isComplete, responses, questionnaire])

  // Get patient name from responses (for FHIR questionnaire, we might not have this)
  const patientName = useMemo(() => {
    const nameResponse = responses.find((r) => r.questionId === "name")
    return nameResponse ? String(nameResponse.answer) : "Patient"
  }, [responses])

  // Track the pending answer that hasn't been committed to state yet
  const pendingResponseRef = React.useRef<QuestionnaireResponse | null>(null)

  const handleAnswer = (answer: string | number | string[] | boolean) => {
    if (!currentQuestion) return
    
    const newResponse: QuestionnaireResponse = {
      questionId: currentQuestion.id,
      answer,
      timestamp: new Date(),
    }

    // Store in ref for immediate use in handleNext
    pendingResponseRef.current = newResponse

    setResponses((prev) => {
      const filtered = prev.filter((r) => r.questionId !== currentQuestion.id)
      return [...filtered, newResponse]
    })
  }

  const handleNext = () => {
    if (!questionnaire) return

    // Include the pending response in visibility calculation
    let effectiveResponses = responses
    if (pendingResponseRef.current) {
      const filtered = responses.filter(
        (r) => r.questionId !== pendingResponseRef.current!.questionId
      )
      effectiveResponses = [...filtered, pendingResponseRef.current]
      pendingResponseRef.current = null
    }

    // Recalculate visible questions with the effective responses
    const updatedVisible = getVisibleQuestions(
      questionnaire.questions,
      effectiveResponses
    )

    const nextIndex = currentQuestionIndex + 1

    if (nextIndex < updatedVisible.length) {
      setCurrentQuestionIndex(nextIndex)
    } else {
      // No more visible questions, complete the questionnaire
      setIsComplete(true)
    }
  }

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleReset = () => {
    setCurrentQuestionIndex(0)
    setResponses([])
    setIsComplete(false)
    setAppointmentBooked(false)
    setIsSubmitting(false)
    setSubmitError(null)
    setSubmitSuccess(false)
  }

  const toggleVoiceMode = () => {
    setIsVoiceMode(!isVoiceMode)
    // Voice mode integration would go here
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="size-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Fragebogen wird geladen...</p>
        </div>
      </div>
    )
  }

  if (loadError || !questionnaire) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <p className="text-destructive font-medium">Fehler beim Laden</p>
          <p className="text-muted-foreground">{loadError || "Der Fragebogen konnte nicht geladen werden."}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Erneut versuchen
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Zurück
        </Link>
        <h1 className="text-lg font-semibold">{questionnaire.name}</h1>
        
        {/* Voice Mode Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleVoiceMode}
          className={`gap-2 bg-transparent ${isVoiceMode ? "text-primary" : ""}`}
        >
          {isVoiceMode ? (
            <>
              <Mic className="size-4" />
              Spracheingabe aktiv
            </>
          ) : (
            <>
              <MicOff className="size-4" />
              Spracheingabe
            </>
          )}
        </Button>
      </div>

      <main className="mx-auto max-w-2xl space-y-8 p-6">
        {/* Voice Mode Banner */}
        {isVoiceMode && (
          <div className="rounded-xl bg-primary/10 p-4 text-center">
            <p className="text-base font-medium">Spracheingabe aktiv</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sprechen Sie Ihre Antworten. Der Assistent wird sie für Sie eingeben.
            </p>
          </div>
        )}

        {!isComplete && currentQuestion && (
          <>
            <QuestionnaireProgress
              current={currentQuestionIndex + 1}
              total={Math.max(visibleQuestions.length, currentQuestionIndex + 2)}
            />

            <QuestionnaireForm
              question={currentQuestion}
              onAnswer={handleAnswer}
              onNext={handleNext}
              onPrev={handlePrev}
              canGoBack={currentQuestionIndex > 0}
            />
          </>
        )}

        {!isComplete && !currentQuestion && visibleQuestions.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">
              Der Fragebogen enthält keine Fragen oder alle Fragen wurden bereits beantwortet.
            </p>
            <Button onClick={handleReset} variant="outline">
              Neu starten
            </Button>
          </div>
        )}

        {isComplete && triageAssessment && (
          <div className="space-y-8">
            {/* Triage Result & Appointment Booking */}
            <AppointmentSuggestion
              triage={triageAssessment}
              patientName={patientName}
              onBooked={() => setAppointmentBooked(true)}
            />

            {/* Submission Status */}
            {isSubmitting && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Antworten werden gespeichert...</span>
              </div>
            )}
            {submitError && (
              <div className="rounded-lg bg-destructive/10 p-4 text-center text-destructive text-sm">
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="rounded-lg bg-green-500/10 p-4 text-center text-green-700 dark:text-green-400 text-sm">
                Ihre Antworten wurden erfolgreich gespeichert.
              </div>
            )}

            {/* Response Summary */}
            {appointmentBooked && (
              <div className="space-y-4 rounded-xl bg-card p-6">
                <h3 className="font-semibold text-lg">Ihre Angaben</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {responses.map((response, index) => {
                    const question = questionnaire.questions.find(
                      (q) => q.id === response.questionId
                    )
                    return (
                      <div
                        key={response.questionId}
                        className="flex flex-col gap-1 pb-3 border-b last:border-0"
                      >
                        <div className="text-sm text-muted-foreground">
                          {question?.text || `Frage ${index + 1}`}
                        </div>
                        <div className="text-base">
                          {formatAnswer(response.answer, question)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Start Over */}
            <div className="flex justify-center pt-4">
              <Button onClick={handleReset} variant="outline" className="bg-transparent">
                Neuer Fragebogen
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

/**
 * Format answer for display, showing labels instead of codes
 */
function formatAnswer(
  answer: string | number | string[] | boolean,
  question?: Question
): string {
  if (typeof answer === "boolean") {
    return answer ? "Ja" : "Nein"
  }

  if (Array.isArray(answer)) {
    // Map codes to labels if options exist
    if (question?.options) {
      const labels = answer.map((a) => {
        const opt = question.options?.find((o) => String(o.value) === String(a))
        return opt?.label || a
      })
      return labels.join(", ")
    }
    return answer.join(", ")
  }

  // Map single code to label
  if (question?.options) {
    const opt = question.options.find((o) => String(o.value) === String(answer))
    if (opt) return opt.label
  }

  return String(answer)
}
