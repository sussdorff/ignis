"use client"

import React from "react"

import { useState } from "react"
import { Stethoscope, Pill, Syringe, AlertTriangle, Sparkles, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface MedicalHistoryProps {
  patientId: string
  expanded?: boolean
}

// Mock data - in production this would come from a database
const mockDiagnosen = [
  {
    id: "1",
    name: "Hypertonie",
    icd10: "I10",
    datum: "15.06.2024",
    status: "chronisch" as const,
  },
  {
    id: "2",
    name: "Diabetes mellitus Typ 2",
    icd10: "E11",
    datum: "03.01.2023",
    status: "chronisch" as const,
  },
  {
    id: "3",
    name: "Akute Bronchitis",
    icd10: "J20.9",
    datum: "28.01.2026",
    status: "aktiv" as const,
    aiVorschlag: true,
  },
]

const mockMedikamente = [
  {
    id: "1",
    name: "Metformin",
    dosierung: "500mg",
    haeufigkeit: "2x täglich",
    seit: "Jan 2023",
  },
  {
    id: "2",
    name: "Ramipril",
    dosierung: "5mg",
    haeufigkeit: "1x morgens",
    seit: "Jun 2024",
  },
  {
    id: "3",
    name: "Acetylcystein",
    dosierung: "600mg",
    haeufigkeit: "1x täglich",
    seit: "Jan 2026",
  },
]

const mockImpfungen = [
  {
    id: "1",
    name: "COVID-19 (Booster)",
    datum: "15.09.2025",
  },
  {
    id: "2",
    name: "Influenza",
    datum: "01.10.2025",
    naechsteFaellig: "Okt 2026",
  },
  {
    id: "3",
    name: "Tetanus",
    datum: "12.03.2020",
    naechsteFaellig: "Mär 2030",
  },
]

const mockVorerkrankungen = [
  "Appendektomie (2005)",
  "Adipositas",
  "Schlafapnoe",
]

interface CollapsibleCardProps {
  title: string
  icon: React.ReactNode
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}

function CollapsibleCard({ title, icon, count, defaultOpen = true, children }: CollapsibleCardProps) {
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
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export function MedicalHistory({ patientId, expanded }: MedicalHistoryProps) {
  // In production, fetch data based on patientId
  void patientId
  
  const diagnosen = mockDiagnosen
  const medikamente = mockMedikamente
  const impfungen = mockImpfungen
  const vorerkrankungen = mockVorerkrankungen

  return (
    <div className={expanded ? "space-y-4" : "grid grid-cols-1 gap-4"}>
      {/* Diagnosen */}
      <CollapsibleCard 
        title="Diagnosen" 
        icon={<Stethoscope className="size-4 text-primary" />}
        count={diagnosen.length}
        defaultOpen={true}
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
                diagnose.status === "aktiv" 
                  ? "bg-warning/10 text-warning border-0" 
                  : diagnose.status === "chronisch"
                  ? "bg-info/10 text-info border-0"
                  : "bg-muted text-muted-foreground border-0"
              }
            >
              {diagnose.status === "aktiv" ? "Aktiv" : 
               diagnose.status === "chronisch" ? "Chronisch" : "Abgeschlossen"}
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
