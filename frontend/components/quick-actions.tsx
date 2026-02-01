"use client"

import { useRouter } from "next/navigation"
import { UserPlus, CalendarPlus, FileText } from "lucide-react"

// Essential actions only
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
]

export function QuickActions() {
  const router = useRouter()

  const handleClick = (action: typeof actions[0]) => {
    if (action.href) {
      router.push(action.href)
    }
  }

  return (
    <div className="flex gap-3">
      {actions.map((action) => (
        <button
          key={action.title}
          type="button"
          onClick={() => handleClick(action)}
          className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-lg transition-colors ${
            action.primary 
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary/50 hover:bg-secondary text-foreground"
          }`}
        >
          <action.icon className="size-5" />
          <span className="font-medium">{action.title}</span>
        </button>
      ))}
    </div>
  )
}
