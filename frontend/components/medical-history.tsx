"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Stethoscope, Pill, Syringe, AlertTriangle, Sparkles, ChevronDown, Loader2, HeartPulse } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { 
  getPatientMedicalHistory, 
  type MedicalHistory as MedicalHistoryData,
  type Condition,
  type Medication,
  type Immunization,
} from "@/lib/api"

interface MedicalHistoryProps {
  patientId: string
  expanded?: boolean
}

interface DisplayCondition {
  id: string
  name: string
  icd10: string
  datum: string
  status: 'active' | 'chronic' | 'resolved'
  aiVorschlag?: boolean
}

interface DisplayMedication {
  id: string
  name: string
  dosierung: string
  haeufigkeit: string
  seit: string
}

interface DisplayImmunization {
  id: string
  name: string
  datum: string
  naechsteFaellig?: string
}

function transformCondition(condition: Condition): DisplayCondition {
  return {
    id: condition.id,
    name: condition.name,
    icd10: condition.icd10,
    datum: condition.date,
    status: condition.status,
    aiVorschlag: condition.aiSuggested,
  }
}

function transformMedication(med: Medication): DisplayMedication {
  return {
    id: med.id,
    name: med.name,
    dosierung: med.dosage,
    haeufigkeit: med.frequency,
    seit: med.since,
  }
}

function transformImmunization(imm: Immunization): DisplayImmunization {
  return {
    id: imm.id,
    name: imm.name,
    datum: imm.date,
    naechsteFaellig: imm.nextDue,
  }
}

interface CollapsibleCardProps {
  title: string
  icon: React.ReactNode
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
  isEmpty?: boolean
  emptyMessage?: string
}

function CollapsibleCard({ title, icon, count, defaultOpen = true, children, isEmpty, emptyMessage }: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                {icon}
                {title}
                {count !== undefined && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {count}
                  </Badge>
                )}
              </div>
              <ChevronDown 
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {isEmpty ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                {emptyMessage || 'Keine Einträge'}
              </div>
            ) : children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export function MedicalHistory({ patientId, expanded }: MedicalHistoryProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diagnosen, setDiagnosen] = useState<DisplayCondition[]>([])
  const [medikamente, setMedikamente] = useState<DisplayMedication[]>([])
  const [impfungen, setImpfungen] = useState<DisplayImmunization[]>([])
  const [vorerkrankungen, setVorerkrankungen] = useState<string[]>([])

  const fetchMedicalHistory = useCallback(async () => {
    try {
      const data = await getPatientMedicalHistory(patientId)
      setDiagnosen(data.conditions.map(transformCondition))
      setMedikamente(data.medications.map(transformMedication))
      setImpfungen(data.immunizations.map(transformImmunization))
      setVorerkrankungen(data.pastConditions)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch medical history:', err)
      setError('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    fetchMedicalHistory()
  }, [fetchMedicalHistory])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="size-4 text-primary" />
            Medizinische Vorgeschichte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Lade...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="size-4 text-primary" />
            Medizinische Vorgeschichte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <button 
              type="button"
              onClick={() => { setLoading(true); fetchMedicalHistory(); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Erneut versuchen
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasNoData = diagnosen.length === 0 && medikamente.length === 0 && impfungen.length === 0 && vorerkrankungen.length === 0

  if (hasNoData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="size-4 text-primary" />
            Medizinische Vorgeschichte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <HeartPulse className="size-10 mb-2 opacity-50" />
            <p className="text-sm">Keine medizinische Vorgeschichte dokumentiert</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={expanded ? "space-y-4" : "grid grid-cols-1 gap-4"}>
      {/* Diagnosen */}
      <CollapsibleCard 
        title="Diagnosen" 
        icon={<Stethoscope className="size-4 text-primary" />}
        count={diagnosen.length}
        defaultOpen={true}
        isEmpty={diagnosen.length === 0}
        emptyMessage="Keine Diagnosen dokumentiert"
      >
        {diagnosen.map((diagnose) => (
          <div 
            key={diagnose.id} 
            className="flex items-start justify-between p-3 rounded-lg bg-muted/50"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{diagnose.name}</span>
                {diagnose.aiVorschlag && (
                  <Badge 
                    variant="outline" 
                    className="border-primary/30 text-primary bg-primary/5 gap-1"
                  >
                    <Sparkles className="size-3" />
                    KI
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <code className="bg-background px-1 rounded">{diagnose.icd10}</code>
                <span>•</span>
                <span>{diagnose.datum}</span>
              </div>
            </div>
            <Badge 
              variant="secondary"
              className={
                diagnose.status === "active" 
                  ? "bg-warning/10 text-warning border-0" 
                  : diagnose.status === "chronic"
                  ? "bg-info/10 text-info border-0"
                  : "bg-muted text-muted-foreground border-0"
              }
            >
              {diagnose.status === "active" ? "Aktiv" : 
               diagnose.status === "chronic" ? "Chronisch" : "Abgeschlossen"}
            </Badge>
          </div>
        ))}
      </CollapsibleCard>

      {/* Medikamente */}
      <CollapsibleCard 
        title="Aktuelle Medikation" 
        icon={<Pill className="size-4 text-primary" />}
        count={medikamente.length}
        defaultOpen={true}
        isEmpty={medikamente.length === 0}
        emptyMessage="Keine Medikation dokumentiert"
      >
        {medikamente.map((medikament) => (
          <div 
            key={medikament.id} 
            className="flex items-start justify-between p-3 rounded-lg bg-muted/50"
          >
            <div className="space-y-1">
              <span className="font-medium text-sm">{medikament.name}</span>
              <div className="text-xs text-muted-foreground">
                {medikament.dosierung} • {medikament.haeufigkeit}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              Seit {medikament.seit}
            </span>
          </div>
        ))}
      </CollapsibleCard>

      {/* Impfungen */}
      <CollapsibleCard 
        title="Impfungen" 
        icon={<Syringe className="size-4 text-primary" />}
        count={impfungen.length}
        defaultOpen={false}
        isEmpty={impfungen.length === 0}
        emptyMessage="Keine Impfungen dokumentiert"
      >
        {impfungen.map((impfung) => (
          <div 
            key={impfung.id} 
            className="flex items-start justify-between p-3 rounded-lg bg-muted/50"
          >
            <div className="space-y-1">
              <span className="font-medium text-sm">{impfung.name}</span>
              <div className="text-xs text-muted-foreground">
                Geimpft: {impfung.datum}
              </div>
            </div>
            {impfung.naechsteFaellig && (
              <Badge 
                variant="secondary" 
                className="bg-warning/10 text-warning border-0"
              >
                Fällig: {impfung.naechsteFaellig}
              </Badge>
            )}
          </div>
        ))}
      </CollapsibleCard>

      {/* Vorerkrankungen */}
      <CollapsibleCard 
        title="Vorerkrankungen" 
        icon={<AlertTriangle className="size-4 text-primary" />}
        count={vorerkrankungen.length}
        defaultOpen={false}
        isEmpty={vorerkrankungen.length === 0}
        emptyMessage="Keine Vorerkrankungen dokumentiert"
      >
        <div className="flex flex-wrap gap-2">
          {vorerkrankungen.map((erkrankung) => (
            <Badge 
              key={erkrankung} 
              variant="outline" 
              className="bg-muted/50"
            >
              {erkrankung}
            </Badge>
          ))}
        </div>
      </CollapsibleCard>
    </div>
  )
}
