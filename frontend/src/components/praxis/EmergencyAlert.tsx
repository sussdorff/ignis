import type { Patient } from '@/lib/api'

interface EmergencyAlertProps {
  emergencies: Patient[]
}

export default function EmergencyAlert({ emergencies }: EmergencyAlertProps) {
  return (
    <div className="bg-red-600 border-2 border-red-700 rounded-lg p-4 shadow-lg animate-pulse">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
            <span className="text-2xl">🚨</span>
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white mb-2">
            NOTFALL - Sofortige Aufmerksamkeit erforderlich
          </h2>
          <div className="space-y-2">
            {emergencies.map(patient => (
              <div key={patient.id} className="bg-red-700 rounded px-3 py-2">
                <p className="text-white font-medium">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-red-100 text-sm">
                  Tel: {patient.phone} | Geburtsdatum: {patient.birthDate}
                </p>
              </div>
            ))}
          </div>
          <p className="text-red-100 text-sm mt-3">
            ⚠️ Patient wurde an menschlichen Agenten weitergeleitet
          </p>
        </div>
      </div>
    </div>
  )
}
