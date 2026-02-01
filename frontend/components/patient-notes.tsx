"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { StickyNote, User, Sparkles, Plus, ChevronDown, Loader2, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { getPatientNotes, type PatientNote } from "@/lib/api"

interface PatientNotesProps {
  patientId: string
  expanded?: boolean
}

interface DisplayNote {
  id: string
  inhalt: string
  autor: string
  datum: string
  uhrzeit: string
  aiGeneriert?: boolean
}

function transformNote(note: PatientNote): DisplayNote {
  return {
    id: note.id,
    inhalt: note.content,
    autor: note.author,
    datum: note.date,
    uhrzeit: note.time,
    aiGeneriert: note.aiGenerated,
  }
}

export function PatientNotes({ patientId, expanded }: PatientNotesProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [notes, setNotes] = useState<DisplayNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [newNoteValue, setNewNoteValue] = useState("")
  const [isAddingNote, setIsAddingNote] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const newNoteRef = useRef<HTMLTextAreaElement>(null)

  const fetchNotes = useCallback(async () => {
    try {
      const data = await getPatientNotes(patientId)
      setNotes(data.map(transformNote))
      setError(null)
    } catch (err) {
      console.error('Failed to fetch notes:', err)
      setError('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])
  
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

  const handleNoteClick = (note: DisplayNote) => {
    setEditingId(note.id)
    setEditValue(note.inhalt)
  }

  const handleBlur = (noteId: string) => {
    // Auto-save on blur (local only for now - would POST to API in production)
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
      // Auto-save new note (local only for now - would POST to API in production)
      const newNote: DisplayNote = {
        id: `new-${Date.now()}`,
        inhalt: newNoteValue,
        autor: "Arzt", // Would come from auth context
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

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="size-4 text-primary" />
            Notizen
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
            <StickyNote className="size-4 text-primary" />
            Notizen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <button 
              type="button"
              onClick={() => { setLoading(true); fetchNotes(); }}
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

            {/* Empty state */}
            {notes.length === 0 && !isAddingNote && (
              <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                <MessageSquare className="size-10 mb-2 opacity-50" />
                <p className="text-sm">Keine Notizen vorhanden</p>
              </div>
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
