"use client"

import React, { useState } from "react"
import { ChevronRight, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { type Question, type QuestionOption } from "@/lib/questionnaire-data"

interface QuestionnaireFormProps {
  question: Question
  onAnswer: (answer: string | number | string[] | boolean) => void
  onNext: () => void
  onPrev: () => void
  canGoBack: boolean
  isLoading?: boolean
}

export function QuestionnaireForm({
  question,
  onAnswer,
  onNext,
  onPrev,
  canGoBack,
  isLoading,
}: QuestionnaireFormProps) {
  const [answer, setAnswer] = useState<string | number | string[] | boolean>("")
  const [errors, setErrors] = useState<string>("")

  const handleSubmit = () => {
    if (question.required && !answer) {
      setErrors("Dieses Feld ist erforderlich")
      return
    }
    onAnswer(answer)
    setAnswer("")
    setErrors("")
    onNext()
  }

  const renderInput = () => {
    switch (question.type) {
      case "text":
        return (
          <Input
            type="text"
            placeholder={question.placeholder}
            value={answer as string}
            onChange={(e) => setAnswer(e.target.value)}
            className="text-base"
          />
        )
      case "number":
        return (
          <Input
            type="number"
            placeholder={question.placeholder}
            min={question.min}
            max={question.max}
            value={answer as number}
            onChange={(e) => setAnswer(e.target.value ? Number(e.target.value) : "")}
            className="text-base"
          />
        )
      case "date":
        return (
          <Input
            type="date"
            value={answer as string}
            onChange={(e) => setAnswer(e.target.value)}
            className="text-base"
          />
        )
      case "textarea":
        return (
          <Textarea
            placeholder={question.placeholder}
            value={answer as string}
            onChange={(e) => setAnswer(e.target.value)}
            className="min-h-32 resize-none text-base"
          />
        )
      case "select":
        return (
          <select
            value={answer as string}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full rounded-lg bg-secondary/50 px-3 py-2 text-base focus:ring-ring/50 focus:ring-[3px] outline-none"
          >
            <option value="">-- Bitte wählen --</option>
            {question.options?.map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )
      case "radio":
        return (
          <div className="space-y-3">
            {question.options?.map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={opt.value}
                  checked={answer === opt.value}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="size-4"
                />
                <span className="text-base">{opt.label}</span>
              </label>
            ))}
          </div>
        )
      case "checkbox":
        return (
          <div className="space-y-3">
            {question.options?.map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={(answer as string[]).includes(String(opt.value))}
                  onChange={(e) => {
                    const arr = answer as string[]
                    if (e.target.checked) {
                      setAnswer([...arr, String(opt.value)])
                    } else {
                      setAnswer(arr.filter((v) => v !== String(opt.value)))
                    }
                  }}
                  className="size-4"
                />
                <span className="text-base">{opt.label}</span>
              </label>
            ))}
          </div>
        )
      case "multiselect":
        return (
          <div className="space-y-3">
            {question.options?.map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={(answer as string[]).includes(String(opt.value))}
                  onChange={(e) => {
                    const arr = answer as string[]
                    if (e.target.checked) {
                      setAnswer([...arr, String(opt.value)])
                    } else {
                      setAnswer(arr.filter((v) => v !== String(opt.value)))
                    }
                  }}
                  className="size-4"
                />
                <span className="text-base">{opt.label}</span>
              </label>
            ))}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{question.text}</h2>
        {question.description && (
          <p className="text-base text-muted-foreground">{question.description}</p>
        )}
      </div>

      <div className="space-y-4">
        {renderInput()}
        {errors && <p className="text-sm text-destructive">{errors}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 pt-6">
        <Button
          onClick={onPrev}
          disabled={!canGoBack}
          variant="outline"
          className="gap-2 bg-transparent"
        >
          <ChevronLeft className="size-4" />
          Zurück
        </Button>
        <Button onClick={handleSubmit} className="gap-2" disabled={isLoading}>
          Weiter
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
