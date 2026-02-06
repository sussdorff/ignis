"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, Clock, Minus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getQuestionnaireResponsesByPatient } from "@/lib/api"
import { QuestionnaireResponseModal } from "./questionnaire-response-modal"

type QuestionnaireStatus = "completed" | "in-progress" | "none" | "loading"

interface QuestionnaireStatusBadgeProps {
  patientId: string
  compact?: boolean
}

export function QuestionnaireStatusBadge({
  patientId,
  compact = false,
}: QuestionnaireStatusBadgeProps) {
  const [status, setStatus] = useState<QuestionnaireStatus>("loading")
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    setStatus("loading")
    getQuestionnaireResponsesByPatient(patientId)
      .then((responses) => {
        const hasCompleted = responses.some((r) => r.status === "completed")
        const hasInProgress = responses.some((r) => r.status === "in-progress")
        if (hasCompleted) setStatus("completed")
        else if (hasInProgress) setStatus("in-progress")
        else setStatus("none")
      })
      .catch(() => {
        setStatus("none")
      })
  }, [patientId])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setModalOpen(true)
  }

  if (status === "loading") {
    return (
      <span data-testid="status-loading" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
      </span>
    )
  }

  const statusConfig = {
    completed: {
      label: "Ausgefuellt",
      icon: CheckCircle2,
      className: "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer border-transparent",
    },
    "in-progress": {
      label: "In Bearbeitung",
      icon: Clock,
      className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 cursor-pointer border-transparent",
    },
    none: {
      label: "Ausstehend",
      icon: Minus,
      className: "cursor-pointer",
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  if (compact) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="badge-compact"
                onClick={handleClick}
                className="inline-flex items-center justify-center"
              >
                <Icon className={`size-4 ${
                  status === "completed" ? "text-green-600" :
                  status === "in-progress" ? "text-yellow-600" :
                  "text-muted-foreground"
                }`} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{config.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {modalOpen && (
          <QuestionnaireResponseModal
            patientId={patientId}
            isOpen={true}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <Badge
        className={status === "none" ? undefined : config.className}
        variant={status === "none" ? "secondary" : undefined}
        onClick={handleClick}
      >
        <Icon className="size-3" />
        {config.label}
      </Badge>
      {modalOpen && (
        <QuestionnaireResponseModal
          patientId={patientId}
          isOpen={true}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
