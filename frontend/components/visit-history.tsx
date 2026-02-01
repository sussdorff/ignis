"use client"

import { useState, useEffect, useCallback } from "react"
import { Clock, User, FileText, ChevronDown, Loader2, CalendarDays } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { getPatientEncounters, type Encounter } from "@/lib/api"

interface VisitHistoryProps {
  patientId: string
  expanded?: boolean
}

interface Visit {
  id: string
  datum: string
  uhrzeit: string
  arzt: string
  grund: string
  diagnosen: string[]
  notizen?: string
}

function transformEncounter(encounter: Encounter): Visit {
  return {
    id: encounter.id,
    datum: encounter.date,
    uhrzeit: encounter.time,
    arzt: encounter.practitioner,
    grund: encounter.reason,
    diagnosen: encounter.diagnoses,
    notizen: encounter.notes,
  }
}

export function VisitHistory({ patientId, expanded }: VisitHistoryProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEncounters = useCallback(async () => {
    try {
      const encounters = await getPatientEncounters(patientId)
      setVisits(encounters.map(transformEncounter))
      setError(null)
    } catch (err) {
      console.error('Failed to fetch encounters:', err)
      setError('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    fetchEncounters()
  }, [fetchEncounters])

  const displayVisits = expanded ? visits : visits.slice(0, 3)

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-primary" />
            Besuchsverlauf
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
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
            <Clock className="size-4 text-primary" />
            Besuchsverlauf
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <button 
              type="button"
              onClick={() => { setLoading(true); fetchEncounters(); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Erneut versuchen
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

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
                  {visits.length}
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
            {visits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <CalendarDays className="size-10 mb-2 opacity-50" />
                <p className="text-sm">Keine Besuche dokumentiert</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                
                <div className="space-y-4">
                  {displayVisits.map((visit, index) => (
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
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
