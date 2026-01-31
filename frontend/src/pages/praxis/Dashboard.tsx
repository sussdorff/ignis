import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPatients, getEmergencyAlerts, type Patient } from '@/lib/api'
import EmergencyAlert from '@/components/praxis/EmergencyAlert'
import PatientQueue from '@/components/praxis/PatientQueue'
import StatsCards from '@/components/praxis/StatsCards'
import { LanguageSwitcher } from '@/components/ui/language-switcher'

export default function PraxisDashboard() {
  const { t } = useTranslation()
  const [patients, setPatients] = useState<Patient[]>([])
  const [emergencies, setEmergencies] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    // Refresh every 10 seconds
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const [patientsData, emergencyData] = await Promise.all([
        getPatients(),
        getEmergencyAlerts(),
      ])
      setPatients(patientsData)
      setEmergencies(emergencyData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">{t('dashboard.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-red-600">{t('dashboard.error')}: {error}</div>
      </div>
    )
  }

  const urgentPatients = patients.filter(p => p.urgency === 'urgent')
  const regularPatients = patients.filter(p => p.urgency === 'regular' || !p.urgency)
  const todayPatients = patients.filter(p => {
    if (!p.createdAt) return false
    const today = new Date().toDateString()
    const patientDate = new Date(p.createdAt).toDateString()
    return today === patientDate
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🔥 {t('app.title')} - {t('dashboard.title')}</h1>
            <p className="text-sm text-gray-600">{t('dashboard.subtitle')}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Emergency Alerts */}
        {emergencies.length > 0 && (
          <EmergencyAlert emergencies={emergencies} />
        )}

        {/* Stats Cards */}
        <StatsCards
          total={patients.length}
          today={todayPatients.length}
          urgent={urgentPatients.length}
          emergency={emergencies.length}
        />

        {/* Patient Queues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Urgent Queue */}
          <PatientQueue
            title={t('dashboard.queues.urgent')}
            patients={urgentPatients}
            urgencyType="urgent"
          />

          {/* Regular Queue */}
          <PatientQueue
            title={t('dashboard.queues.regular')}
            patients={regularPatients}
            urgencyType="regular"
          />
        </div>
      </main>
    </div>
  )
}
