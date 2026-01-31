"use client"

import { useRouter } from "next/navigation"
import { UserPlus, CalendarPlus, FileText, Printer } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Reduced to most essential actions only
const actions = [
  {
    title: "Neuer Patient",
    icon: UserPlus,
    href: "/patient/neu",
    primary: true,
  },
  {
    title: "Termin",
    icon: CalendarPlus,
    href: "/termine",
  },
  {
    title: "Rezept",
    icon: FileText,
    href: "/rezept",
  },
  {
    title: "Drucken",
    icon: Printer,
    action: () => window.print(),
  },
]

export function QuickActions() {
  const router = useRouter()

  const handleClick = (action: typeof actions[0]) => {
    if (action.action) {
      action.action()
    } else if (action.href) {
      router.push(action.href)
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Schnellaktionen</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={() => handleClick(action)}
            className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-lg transition-colors ${
              action.primary 
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted/50 hover:bg-muted text-foreground"
            }`}
          >
            <action.icon className="size-5" />
            <span className="text-sm">{action.title}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
