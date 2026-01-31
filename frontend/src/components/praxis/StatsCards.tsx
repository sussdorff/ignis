import { Card, CardContent } from '@/components/ui/card'

interface StatsCardsProps {
  total: number
  today: number
  urgent: number
  emergency: number
}

export default function StatsCards({ total, today, urgent, emergency }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        title="Gesamt Patienten"
        value={total}
        icon="👥"
        color="bg-blue-50 border-blue-200"
      />
      <StatCard
        title="Heute registriert"
        value={today}
        icon="📅"
        color="bg-green-50 border-green-200"
      />
      <StatCard
        title="Dringend"
        value={urgent}
        icon="⚡"
        color="bg-orange-50 border-orange-200"
      />
      <StatCard
        title="Notfälle"
        value={emergency}
        icon="🚨"
        color="bg-red-50 border-red-200"
      />
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number
  icon: string
  color: string
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card className={color}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
          <div className="text-4xl">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}
