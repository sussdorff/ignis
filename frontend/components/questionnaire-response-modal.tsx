"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Loader2, FileText, ClipboardList } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  getQuestionnaireResponsesByPatient,
  type FHIRQuestionnaireResponse,
  type FHIRQuestionnaireResponseItem,
  type QuestionnaireResponseAnswer,
} from "@/lib/api"

interface QuestionnaireResponseModalProps {
  patientId: string
  isOpen: boolean
  onClose: () => void
}

function formatAnswer(answer: QuestionnaireResponseAnswer): string {
  if (answer.valueString != null) return answer.valueString
  if (answer.valueBoolean != null) return answer.valueBoolean ? "Ja" : "Nein"
  if (answer.valueInteger != null) return String(answer.valueInteger)
  if (answer.valueCoding != null) return answer.valueCoding.display || answer.valueCoding.code
  return "-"
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function statusLabel(status: FHIRQuestionnaireResponse["status"]): string {
  switch (status) {
    case "completed":
      return "Abgeschlossen"
    case "in-progress":
      return "In Bearbeitung"
    case "amended":
      return "Geaendert"
    default:
      return status
  }
}

function statusVariant(status: FHIRQuestionnaireResponse["status"]): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed":
      return "default"
    case "in-progress":
      return "secondary"
    default:
      return "outline"
  }
}

function AnswerRow({ item }: { item: FHIRQuestionnaireResponseItem }) {
  if (!item.answer || item.answer.length === 0) return null
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{item.text || item.linkId}</span>
      <span className="text-sm font-medium text-right ml-4">
        {item.answer.map((a, i) => (
          <span key={i}>{formatAnswer(a)}</span>
        ))}
      </span>
    </div>
  )
}

function SectionBlock({ item }: { item: FHIRQuestionnaireResponseItem }) {
  // Section group: has nested items
  if (item.item && item.item.length > 0) {
    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2 text-foreground">{item.text || item.linkId}</h4>
        <div className="rounded-lg bg-muted/30 p-3">
          {item.item.map((child) => (
            <AnswerRow key={child.linkId} item={child} />
          ))}
        </div>
      </div>
    )
  }

  // Flat item with answer directly
  return <AnswerRow item={item} />
}

export function QuestionnaireResponseModal({
  patientId,
  isOpen,
  onClose,
}: QuestionnaireResponseModalProps) {
  const [responses, setResponses] = useState<FHIRQuestionnaireResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResponses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getQuestionnaireResponsesByPatient(patientId)
      setResponses(data)
    } catch (err) {
      console.error("Failed to fetch questionnaire responses:", err)
      setError("Fehler beim Laden der Antworten")
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (isOpen) {
      fetchResponses()
    }
  }, [isOpen, fetchResponses])

  // Most recent response first
  const sorted = [...responses].sort((a, b) => {
    const da = a.authored ? new Date(a.authored).getTime() : 0
    const db = b.authored ? new Date(b.authored).getTime() : 0
    return db - da
  })

  const mostRecent = sorted[0]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            Fragebogen-Antworten
          </DialogTitle>
          <DialogDescription>
            Eingereichte Fragebogen-Antworten des Patienten
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Lade...</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={fetchResponses}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {!loading && !error && responses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileText className="size-10 mb-2 opacity-50" />
            <p className="text-sm">Keine Antworten vorhanden</p>
          </div>
        )}

        {!loading && !error && mostRecent && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={statusVariant(mostRecent.status)}>
                {statusLabel(mostRecent.status)}
              </Badge>
              {mostRecent.authored && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(mostRecent.authored)}
                </span>
              )}
            </div>

            <div className="space-y-1">
              {mostRecent.item?.map((item) => (
                <SectionBlock key={item.linkId} item={item} />
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
