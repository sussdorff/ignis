"use client"

import { useState } from "react"
import { Clock, User, FileText, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface VisitHistoryProps {
  patientId: string
  expanded?: boolean
}

// Mock data
const mockVisits = [
  {
    id: "1",
    datum: "31.01.2026",
    uhrzeit: "09:30",
    arzt: "Dr. Schmidt",
    grund: "Kontrolluntersuchung",
    diagnosen: ["Hypertonie", "Diabetes Typ 2"],
    notizen: "Blutdruck gut eingestellt, HbA1c leicht erhöht. Diätberatung empfohlen.",
  },
  {
    id: "2",
    datum: "15.01.2026",
    uhrzeit: "14:00",
    arzt: "Dr. Meier",
    grund: "Akute Bronchitis",
    diagnosen: ["Akute Bronchitis"],
    notizen: "Husten seit 5 Tagen, leichtes Fieber. Antibiotikum verschrieben.",
  },
  {
    id: "3",
    datum: "20.12.2025",
    uhrzeit: "10:15",
    arzt: "Dr. Schmidt",
    grund: "Blutzuckerkontrolle",
    diagnosen: ["Diabetes Typ 2"],
  },
  {
    id: "4",
    datum: "01.11.2025",
    uhrzeit: "11:30",
    arzt: "Dr. Schmidt",
    grund: "Impfung",
    diagnosen: [],
    notizen: "Grippeimpfung durchgeführt.",
  },
]

export function VisitHistory({ patientId, expanded }: VisitHistoryProps) {
  // In production, fetch data based on patientId
  void patientId
  
  const [isOpen, setIsOpen] = useState(true)
  const visits = expanded ? mockVisits : mockVisits.slice(0, 3)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Besuchsverlauf
                <Badge variant="secondary" className="ml-1 text-xs">
                  {mockVisits.length}
                </Badge>
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
          <CardContent className="pt-0">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
              
              <div className="space-y-4">
                {visits.map((visit, index) => (
                  <div key={visit.id} className="relative pl-6">
                    {/* Timeline dot */}
                    <div 
                      className={`absolute left-0 top-1.5 size-3.5 rounded-full border-2 border-background ${
                        index === 0 ? "bg-primary" : "bg-muted-foreground/30"
                      }`} 
                    />
                    
                    <div className="p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm">{visit.grund}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{visit.datum}</span>
                            <span>•</span>
                            <span>{visit.uhrzeit}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="size-3" />
                          {visit.arzt}
                        </div>
                      </div>
                      
                      {visit.diagnosen.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {visit.diagnosen.map((diagnose) => (
                            <Badge 
                              key={diagnose} 
                              variant="secondary" 
                              className="text-xs bg-background"
                            >
                              {diagnose}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {visit.notizen && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <FileText className="size-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{visit.notizen}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
