import React from "react"

interface QuestionnaireProgressProps {
  current: number
  total: number
}

export function QuestionnaireProgress({
  current,
  total,
}: QuestionnaireProgressProps) {
  const percentage = (current / total) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Fortschritt</span>
        <span className="font-medium">
          {current} von {total}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary/50 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
