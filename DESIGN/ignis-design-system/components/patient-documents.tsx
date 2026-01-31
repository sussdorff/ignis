"use client"

import { useState } from "react"
import { FileText, Download, Eye, Upload, Search, Filter, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface PatientDocumentsProps {
  patientId: string
  expanded?: boolean
}

type DocumentType = "befund" | "rezept" | "überweisung" | "arztbrief" | "labor" | "bildgebung"

// Mock data
const mockDocuments = [
  {
    id: "1",
    name: "Laborbefund_2026-01-28.pdf",
    typ: "labor" as DocumentType,
    datum: "28.01.2026",
    arzt: "Dr. Schmidt",
    groesse: "245 KB",
  },
  {
    id: "2",
    name: "Rezept_Metformin.pdf",
    typ: "rezept" as DocumentType,
    datum: "15.01.2026",
    arzt: "Dr. Schmidt",
    groesse: "89 KB",
  },
  {
    id: "3",
    name: "Überweisung_Kardiologie.pdf",
    typ: "überweisung" as DocumentType,
    datum: "10.01.2026",
    arzt: "Dr. Meier",
    groesse: "112 KB",
  },
  {
    id: "4",
    name: "Röntgen_Thorax.pdf",
    typ: "bildgebung" as DocumentType,
    datum: "05.12.2025",
    arzt: "Dr. Weber",
    groesse: "1.2 MB",
  },
  {
    id: "5",
    name: "Arztbrief_Entlassung.pdf",
    typ: "arztbrief" as DocumentType,
    datum: "20.11.2025",
    arzt: "Dr. Fischer",
    groesse: "456 KB",
  },
]

function getDocumentTypeLabel(typ: DocumentType) {
  const labels: Record<DocumentType, { label: string; className: string }> = {
    befund: { label: "Befund", className: "bg-info/10 text-info" },
    rezept: { label: "Rezept", className: "bg-success/10 text-success" },
    überweisung: { label: "Überweisung", className: "bg-warning/10 text-warning" },
    arztbrief: { label: "Arztbrief", className: "bg-primary/10 text-primary" },
    labor: { label: "Laborbericht", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    bildgebung: { label: "Bildgebung", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  }
  return labels[typ]
}

export function PatientDocuments({ patientId, expanded }: PatientDocumentsProps) {
  // In production, fetch data based on patientId
  void patientId
  
  const [isOpen, setIsOpen] = useState(true)
  const documents = expanded ? mockDocuments : mockDocuments.slice(0, 3)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" />
                Dokumente
                <Badge variant="secondary" className="ml-1 text-xs">
                  {mockDocuments.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation()
                    // Handle upload
                  }}
                >
                  <Upload className="mr-2 size-4" />
                  Hochladen
                </Button>
                <ChevronDown 
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Search and filter */}
            {expanded && (
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Dokumente durchsuchen..." 
                    className="pl-9 h-9"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 size-4" />
                  Filter
                </Button>
              </div>
            )}
            
            <div className="space-y-2">
              {documents.map((doc) => {
                const typeInfo = getDocumentTypeLabel(doc.typ)
                return (
                  <div 
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-background flex items-center justify-center">
                        <FileText className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{doc.name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{doc.datum}</span>
                          <span>•</span>
                          <span>{doc.arzt}</span>
                          <span>•</span>
                          <span>{doc.groesse}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={`border-0 ${typeInfo.className}`}
                      >
                        {typeInfo.label}
                      </Badge>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="size-8">
                          <Eye className="size-4" />
                          <span className="sr-only">Anzeigen</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8">
                          <Download className="size-4" />
                          <span className="sr-only">Herunterladen</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
