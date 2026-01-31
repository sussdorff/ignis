"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { StickyNote, User, Sparkles, Plus, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface PatientNotesProps {
  patientId: string
  expanded?: boolean
}

// Mock data
const mockNotes = [
  {
    id: "1",
    inhalt: "Patient berichtet über verbesserten Schlaf seit Umstellung der Medikation. Blutdruckwerte stabil. Nächste Kontrolle in 4 Wochen empfohlen.",
    autor: "Dr. Schmidt",
    datum: "31.01.2026",
    uhrzeit: "09:45",
  },
  {
    id: "2",
    inhalt: "Basierend auf den Laborwerten und der klinischen Präsentation wurde eine akute Bronchitis diagnostiziert. Der Patient zeigt typische Symptome wie produktiven Husten und leichtes Fieber.",
    autor: "KI-Assistent",
    datum: "15.01.2026",
    uhrzeit: "14:15",
    aiGeneriert: true,
  },
  {
    id: "3",
    inhalt: "Patientin zur Grippeimpfung erschienen. Keine Kontraindikationen. Impfung komplikationslos durchgeführt.",
    autor: "Sr. Müller",
    datum: "01.11.2025",
    uhrzeit: "11:35",
  },
]

export function PatientNotes({ patientId, expanded }: PatientNotesProps) {
  void patientId
  
  const [isOpen, setIsOpen] = useState(true)
  const [notes, setNotes] = useState(mockNotes)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [newNoteValue, setNewNoteValue] = useState("")
  const [isAddingNote, setIsAddingNote] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const newNoteRef = useRef<HTMLTextAreaElement>(null)
  
  const displayNotes = expanded ? notes : notes.slice(0, 2)

  // Auto-resize textarea
  const autoResize = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus()
      autoResize(textareaRef.current)
    }
  }, [editingId])

  useEffect(() => {
    if (isAddingNote && newNoteRef.current) {
      newNoteRef.current.focus()
    }
  }, [isAddingNote])

  const handleNoteClick = (note: typeof mockNotes[0]) => {
    setEditingId(note.id)
    setEditValue(note.inhalt)
  }

  const handleBlur = (noteId: string) => {
    // Auto-save on blur
    if (editValue.trim()) {
      setNotes(prev => prev.map(n => 
        n.id === noteId ? { ...n, inhalt: editValue } : n
      ))
    }
    setEditingId(null)
    setEditValue("")
  }

  const handleNewNoteBlur = () => {
    if (newNoteValue.trim()) {
      // Auto-save new note
      const newNote = {
        id: `new-${Date.now()}`,
        inhalt: newNoteValue,
        autor: "Dr. Schmidt", // Would come from auth context
        datum: new Date().toLocaleDateString('de-DE'),
        uhrzeit: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      }
      setNotes(prev => [newNote, ...prev])
    }
    setNewNoteValue("")
    setIsAddingNote(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent, noteId?: string) => {
    if (e.key === 'Escape') {
      setEditingId(null)
      setEditValue("")
      setIsAddingNote(false)
      setNewNoteValue("")
    }
    if (e.key === 'Enter' && e.metaKey) {
      if (noteId) {
        handleBlur(noteId)
      } else {
        handleNewNoteBlur()
      }
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <StickyNote className="size-4 text-primary" />
                Notizen
                <Badge variant="secondary" className="ml-1 text-xs">
                  {notes.length}
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
          <CardContent className="pt-0 space-y-3">
            {/* Quick add area - tap to start typing */}
            {isAddingNote ? (
              <div className="p-3 rounded-lg bg-primary/5 ring-2 ring-primary/20">
                <textarea
                  ref={newNoteRef}
                  value={newNoteValue}
                  onChange={(e) => {
                    setNewNoteValue(e.target.value)
                    autoResize(e.target)
                  }}
                  onBlur={handleNewNoteBlur}
                  onKeyDown={(e) => handleKeyDown(e)}
                  placeholder="Notiz eingeben..."
                  className="w-full bg-transparent resize-none outline-none text-base leading-relaxed min-h-[60px]"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Klicken Sie außerhalb oder drücken Sie Cmd+Enter zum Speichern
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingNote(true)}
                className="w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left text-muted-foreground flex items-center gap-2"
              >
                <Plus className="size-4" />
                Neue Notiz hinzufügen...
              </button>
            )}

            {/* Notes list - tap to edit */}
            {displayNotes.map((note) => (
              <div 
                key={note.id}
                className={`p-3 rounded-lg transition-colors cursor-text ${
                  editingId === note.id 
                    ? "bg-primary/5 ring-2 ring-primary/20" 
                    : "bg-muted/50 hover:bg-muted/70"
                }`}
                onClick={() => !editingId && handleNoteClick(note)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="size-3" />
                    <span className="font-medium text-foreground">{note.autor}</span>
                    <span>•</span>
                    <span>{note.datum}</span>
                    <span>{note.uhrzeit}</span>
                  </div>
                  {note.aiGeneriert && (
                    <Badge 
                      variant="outline" 
                      className="border-primary/30 text-primary bg-primary/5 gap-1 text-xs"
                    >
                      <Sparkles className="size-3" />
                      KI
                    </Badge>
                  )}
                </div>
                
                {editingId === note.id ? (
                  <textarea
                    ref={textareaRef}
                    value={editValue}
                    onChange={(e) => {
                      setEditValue(e.target.value)
                      autoResize(e.target)
                    }}
                    onBlur={() => handleBlur(note.id)}
                    onKeyDown={(e) => handleKeyDown(e, note.id)}
                    className="w-full bg-transparent resize-none outline-none text-base leading-relaxed"
                  />
                ) : (
                  <p className="text-base leading-relaxed">{note.inhalt}</p>
                )}
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
