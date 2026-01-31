import { Users, Calendar, Clock, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const stats = [
  {
    title: "Patienten heute",
    value: "24",
    change: "+3 seit gestern",
    icon: Users,
    iconColor: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    title: "Termine heute",
    value: "18",
    change: "4 noch offen",
    icon: Calendar,
    iconColor: "text-info",
    bgColor: "bg-info/10",
  },
  {
    title: "Wartezimmer",
    value: "3",
    change: "~12 Min. Wartezeit",
    icon: Clock,
    iconColor: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    title: "Dringend",
    value: "2",
    change: "Triage erforderlich",
    icon: AlertTriangle,
    iconColor: "text-destructive",
    bgColor: "bg-destructive/10",
  },
]

export function StatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
              <stat.icon className={`size-4 ${stat.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
