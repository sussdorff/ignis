import { useState, useEffect } from "react"
import { Calendar, Clock, User } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface NewAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate?: Date
  selectedHour?: number
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedHour,
}: NewAppointmentDialogProps) {
  const [formData, setFormData] = useState({
    patient: "",
    date: "",
    time: "",
    duration: "30",
    type: "routine",
    doctor: "dr-schmidt",
  })

  // Auto-populate date and time from calendar selection
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        date: selectedDate.toISOString().split('T')[0],
        time: selectedHour ? `${selectedHour.toString().padStart(2, '0')}:00` : prev.time,
      }))
    }
  }, [selectedDate, selectedHour])

  // Auto-save and close when all required fields are filled
  useEffect(() => {
    if (formData.patient && formData.date && formData.time) {
      // Debounce auto-save
      const timer = setTimeout(() => {
        // Here you would save the appointment
        onOpenChange(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [formData.patient, formData.date, formData.time, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Neuer Termin</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* Patient - required, focus first */}
          <div className="space-y-1.5">
            <Label htmlFor="patient" className="text-sm text-muted-foreground">
              Patient
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="patient"
                placeholder="Name eingeben..."
                className="pl-10"
                value={formData.patient}
                onChange={(e) => setFormData({ ...formData, patient: e.target.value })}
                autoFocus
              />
            </div>
          </div>

          {/* Date and Time - compact row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-sm text-muted-foreground">
                Datum
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  className="pl-10"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time" className="text-sm text-muted-foreground">
                Uhrzeit
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="time"
                  type="time"
                  className="pl-10"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Type and Duration - secondary options */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Dauer</Label>
              <Select
                value={formData.duration}
                onValueChange={(v) => setFormData({ ...formData, duration: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Art</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="followup">Nachsorge</SelectItem>
                  <SelectItem value="urgent">Dringend</SelectItem>
                  <SelectItem value="new">Erstbesuch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Auto-save indicator */}
          {formData.patient && formData.date && formData.time && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Wird automatisch gespeichert...
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
