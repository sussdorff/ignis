import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CalendarHeaderProps {
  currentDate: Date
  view: "day" | "week"
  onViewChange: (view: "day" | "week") => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  onNewAppointment: () => void
}

const germanMonths = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
]

const germanWeekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]

export function CalendarHeader({
  currentDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onNewAppointment,
}: CalendarHeaderProps) {
  const formatDateRange = () => {
    if (view === "day") {
      const weekday = germanWeekdays[currentDate.getDay()]
      const day = currentDate.getDate()
      const month = germanMonths[currentDate.getMonth()]
      const year = currentDate.getFullYear()
      return `${weekday}, ${day}. ${month} ${year}`
    } else {
      // Week view - show week range
      const startOfWeek = new Date(currentDate)
      const day = startOfWeek.getDay()
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
      startOfWeek.setDate(diff)
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      
      const startDay = startOfWeek.getDate()
      const endDay = endOfWeek.getDate()
      const startMonth = germanMonths[startOfWeek.getMonth()]
      const endMonth = germanMonths[endOfWeek.getMonth()]
      const year = startOfWeek.getFullYear()
      
      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${startDay}. - ${endDay}. ${startMonth} ${year}`
      }
      return `${startDay}. ${startMonth} - ${endDay}. ${endMonth} ${year}`
    }
  }

  return (
    <div className="flex items-center justify-between pb-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Terminkalender</h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={onPrevious}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onNext}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday} className="ml-2 bg-transparent">
            Heute
          </Button>
        </div>
        <span className="text-lg font-medium text-muted-foreground">
          {formatDateRange()}
        </span>
      </div>
      
      <div className="flex items-center gap-3">
        <Select value={view} onValueChange={(v) => onViewChange(v as "day" | "week")}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Tag</SelectItem>
            <SelectItem value="week">Woche</SelectItem>
          </SelectContent>
        </Select>
        
        <Button onClick={onNewAppointment} className="gap-2">
          <Plus className="size-4" />
          Neuer Termin
        </Button>
      </div>
    </div>
  )
}
