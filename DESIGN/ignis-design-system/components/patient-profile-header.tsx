"use client"

import Link from "next/link"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Phone, Mail, AlertTriangle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface PatientHeaderProps {
  patient: {
    id: string
    name: string
    initials: string
    geburtsdatum: string
    alter: number
    geschlecht: string
    versicherung: string
    versicherungsnummer: string
    telefon: string
    email: string
    adresse: string
    triage?: "notfall" | "dringend" | "normal"
    allergien?: string[]
  }
}

export function PatientProfileHeader({ patient }: PatientHeaderProps) {
  const router = useRouter()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [patientData, setPatientData] = useState(patient)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingField])

  const handleFieldClick = (field: string) => {
    setEditingField(field)
  }

  const handleBlur = () => {
    // Auto-save on blur
    setEditingField(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      setEditingField(null)
    }
  }

  const updateField = (field: string, value: string) => {
    setPatientData(prev => ({ ...prev, [field]: value }))
  }

  // Inline editable field component
  const EditableField = ({ 
    field, 
    value, 
    label,
    mono = false 
  }: { 
    field: string
    value: string
    label: string
    mono?: boolean
  }) => {
    if (editingField === field) {
      return (
        <span>
          <span className="text-muted-foreground">{label}: </span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => updateField(field, e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`bg-primary/5 rounded px-1 outline-none ring-2 ring-primary/20 ${mono ? 'font-mono' : 'font-medium'}`}
          />
        </span>
      )
    }
    return (
      <span 
        className="cursor-text hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
        onClick={() => handleFieldClick(field)}
      >
        <span className="text-muted-foreground">{label}: </span>
        <span className={mono ? "font-mono" : "font-medium"}>{value}</span>
      </span>
    )
  }

  return (
    <div className="bg-card">
      <div className="p-6">
        {/* Back navigation */}
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Zurück
        </button>

        <div className="flex items-start justify-between gap-6">
          {/* Patient info */}
          <div className="flex items-start gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                {patientData.initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">{patientData.name}</h1>
                {patientData.triage && patientData.triage !== "normal" && (
                  <Badge 
                    className={
                      patientData.triage === "notfall" 
                        ? "bg-destructive text-destructive-foreground" 
                        : "bg-warning text-warning-foreground"
                    }
                  >
                    <AlertTriangle className="size-3 mr-1" />
                    {patientData.triage === "notfall" ? "Notfall" : "Dringend"}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{patientData.geburtsdatum} ({patientData.alter} Jahre)</span>
                <span>•</span>
                <span>{patientData.geschlecht}</span>
                <span>•</span>
                <span>{patientData.versicherung}</span>
              </div>

              {patientData.allergien && patientData.allergien.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-sm font-medium text-destructive">Allergien:</span>
                  <div className="flex gap-1">
                    {patientData.allergien.map((allergie) => (
                      <Badge 
                        key={allergie} 
                        variant="outline" 
                        className="border-destructive/30 text-destructive bg-destructive/5"
                      >
                        {allergie}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Single primary action - direct call/email via links */}
          <div className="flex items-center gap-3">
            <a 
              href={`tel:${patientData.telefon}`}
              className="size-10 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center text-primary"
              title="Anrufen"
            >
              <Phone className="size-5" />
            </a>
            <a 
              href={`mailto:${patientData.email}`}
              className="size-10 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center text-primary"
              title="E-Mail"
            >
              <Mail className="size-5" />
            </a>
          </div>
        </div>

        {/* Contact details row - tap to edit */}
        <div className="flex items-center gap-6 mt-4 pt-4 text-sm flex-wrap">
          <EditableField field="telefon" value={patientData.telefon} label="Tel" />
          <EditableField field="email" value={patientData.email} label="E-Mail" />
          <EditableField field="adresse" value={patientData.adresse} label="Adresse" />
          <EditableField field="versicherungsnummer" value={patientData.versicherungsnummer} label="Vers.-Nr" mono />
        </div>
      </div>
    </div>
  )
}
