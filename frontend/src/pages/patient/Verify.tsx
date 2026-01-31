import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PatientVerify() {
  const { token } = useParams<{ token: string }>()

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🔥 Ignis</h1>
          <p className="text-lg text-gray-600">Daten überprüfen</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ihre Daten überprüfen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  🚩 <strong>AI-Validierung erforderlich:</strong> Bitte überprüfen Sie die folgenden
                  Informationen, die unser KI-Assistent während Ihres Anrufs gesammelt hat.
                </p>
              </div>

              <div className="text-center py-12">
                <p className="text-gray-600">Verification Token: <code className="bg-gray-100 px-2 py-1 rounded">{token}</code></p>
                <p className="text-sm text-gray-500 mt-4">
                  Diese Seite wird implementiert, sobald die FHIR-Integration abgeschlossen ist.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
