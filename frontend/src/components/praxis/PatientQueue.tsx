import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Patient } from '@/lib/api'

interface PatientQueueProps {
  title: string
  patients: Patient[]
  urgencyType: 'urgent' | 'regular'
}

export default function PatientQueue({ title, patients, urgencyType }: PatientQueueProps) {
  const bgColor = urgencyType === 'urgent' ? 'bg-orange-50' : 'bg-white'
  const borderColor = urgencyType === 'urgent' ? 'border-orange-200' : 'border-gray-200'

  return (
    <Card className={`${bgColor} ${borderColor}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal text-gray-600">
            {patients.length} {patients.length === 1 ? 'Patient' : 'Patienten'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {patients.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Keine Patienten in der Warteschlange</p>
        ) : (
          <div className="space-y-3">
            {patients.map(patient => (
              <PatientCard key={patient.id} patient={patient} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PatientCard({ patient }: { patient: Patient }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">
              {patient.firstName} {patient.lastName}
            </h3>
            {patient.isReturning && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Bekannt
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            📞 {patient.phone}
          </p>
          <p className="text-sm text-gray-600">
            🎂 {patient.birthDate}
          </p>
          {patient.email && (
            <p className="text-sm text-gray-600">
              ✉️ {patient.email}
            </p>
          )}
        </div>
        
        {patient.flags && patient.flags.length > 0 && (
          <div className="flex flex-col gap-1">
            {patient.flags.map(flag => (
              <span key={flag} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                🚩 {flag}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {patient.createdAt && (
        <p className="text-xs text-gray-500 mt-2">
          Registriert: {new Date(patient.createdAt).toLocaleString('de-DE')}
        </p>
      )}
    </div>
  )
}
