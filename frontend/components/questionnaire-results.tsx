import { CheckCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type QuestionnaireResponse } from "@/lib/questionnaire-data"

interface QuestionnaireResultsProps {
  responses: QuestionnaireResponse[]
  questionnaireName: string
  onReset: () => void
}

export function QuestionnaireResults({
  responses,
  questionnaireName,
  onReset,
}: QuestionnaireResultsProps) {
  const downloadPDF = () => {
    // Mock download - in production, generate actual PDF
    const text = responses
      .map((r) => `Q${r.questionId}: ${r.answer}`)
      .join("\n")
    const element = document.createElement("a")
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(text)
    )
    element.setAttribute("download", `${questionnaireName}.txt`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center space-y-3 text-center py-8">
        <div className="rounded-full bg-success/10 p-4">
          <CheckCircle className="size-12 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Fragebogen abgeschlossen</h2>
          <p className="text-base text-muted-foreground mt-2">
            Vielen Dank für Ihre Antworten. Ihre Informationen wurden erfasst.
          </p>
        </div>
      </div>

      {responses.length > 0 && (
        <div className="space-y-4 rounded-xl bg-card p-6">
          <h3 className="font-semibold text-lg">Zusammenfassung</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {responses.map((response, index) => (
              <div key={index} className="flex flex-col gap-1 pb-3 border-b last:border-0">
                <div className="text-sm font-medium text-muted-foreground">
                  Frage {index + 1}
                </div>
                <div className="text-base">
                  {Array.isArray(response.answer)
                    ? response.answer.join(", ")
                    : String(response.answer)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button onClick={downloadPDF} variant="outline" className="gap-2 bg-transparent">
          <Download className="size-4" />
          Exportieren
        </Button>
        <Button onClick={onReset} className="gap-2">
          Neuer Fragebogen
        </Button>
      </div>
    </div>
  )
}
