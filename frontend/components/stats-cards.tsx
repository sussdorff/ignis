"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Users, Calendar, Clock, AlertTriangle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getQueueStats, getTodayAppointments, type QueueStats, type Appointment } from "@/lib/api"

interface StatCardData {
  title: string
  value: string
  change: string
  icon: typeof Users
  iconColor: string
  bgColor: string
  href: string | null
}

export function StatsCards() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatCardData[]>([])

  const fetchStats = useCallback(async () => {
    try {
      const [queueStats, appointments] = await Promise.all([
        getQueueStats(),
        getTodayAppointments(),
      ])

      // Calculate stats from real data
      const totalQueueToday = queueStats.total
      const totalAppointments = appointments.length
      const openAppointments = appointments.filter(a => a.status === 'booked').length
      const waitingCount = queueStats.wartend
      const urgentCount = queueStats.dringend + queueStats.notfall

      const statsData: StatCardData[] = [
        {
          title: "Patienten heute",
          value: String(totalQueueToday),
          change: `${queueStats.inBehandlung} in Behandlung`,
          icon: Users,
          iconColor: "text-primary",
          bgColor: "bg-primary/10",
          href: null,
        },
        {
          title: "Termine heute",
          value: String(totalAppointments),
          change: `${openAppointments} noch offen`,
          icon: Calendar,
          iconColor: "text-info",
          bgColor: "bg-info/10",
          href: "/termine",
        },
        {
          title: "Wartezimmer",
          value: String(waitingCount),
          change: `${queueStats.aufgerufen} aufgerufen`,
          icon: Clock,
          iconColor: "text-warning",
          bgColor: "bg-warning/10",
          href: "/wartezimmer?view=rooms",
        },
        {
          title: "Dringend",
          value: String(urgentCount),
          change: urgentCount > 0 ? "Triage erforderlich" : "Keine dringenden Fälle",
          icon: AlertTriangle,
          iconColor: "text-destructive",
          bgColor: "bg-destructive/10",
          href: null,
        },
      ]

      setStats(statsData)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
      // Set fallback empty stats on error
      setStats([
        {
          title: "Patienten heute",
          value: "—",
          change: "Fehler beim Laden",
          icon: Users,
          iconColor: "text-primary",
          bgColor: "bg-primary/10",
          href: null,
        },
        {
          title: "Termine heute",
          value: "—",
          change: "Fehler beim Laden",
          icon: Calendar,
          iconColor: "text-info",
          bgColor: "bg-info/10",
          href: "/termine",
        },
        {
          title: "Wartezimmer",
          value: "—",
          change: "Fehler beim Laden",
          icon: Clock,
          iconColor: "text-warning",
          bgColor: "bg-warning/10",
          href: "/wartezimmer?view=rooms",
        },
        {
          title: "Dringend",
          value: "—",
          change: "Fehler beim Laden",
          icon: AlertTriangle,
          iconColor: "text-destructive",
          bgColor: "bg-destructive/10",
          href: null,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="size-8 bg-muted animate-pulse rounded-lg" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-8 w-12 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card 
          key={stat.title} 
          className={`border-0 shadow-sm ${stat.href ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
          onClick={() => stat.href && router.push(stat.href)}
        >
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
