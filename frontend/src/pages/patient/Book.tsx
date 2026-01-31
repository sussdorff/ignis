import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PatientBook() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🔥 Ignis</h1>
          <p className="text-lg text-gray-600">Termin buchen</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Termin vereinbaren</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 bg-blue-50 rounded-lg text-center">
              <div className="text-6xl mb-4">📞</div>
              <h3 className="text-xl font-semibold mb-2">Anrufen und sofort einen Termin buchen</h3>
              <p className="text-gray-600 mb-4">
                Unsere KI-Assistentin hilft Ihnen 24/7, einen passenden Termin zu finden.
              </p>
              <Button size="lg" className="text-lg px-8">
                📞 Jetzt anrufen
              </Button>
            </div>

            <div className="text-center py-4">
              <p className="text-sm text-gray-500">oder</p>
            </div>

            <div className="p-6 bg-gray-50 rounded-lg text-center">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-2">Online-Kalender</h3>
              <p className="text-gray-600 mb-4">
                Verfügbare Termine einsehen und direkt buchen.
              </p>
              <Button variant="outline" size="lg">
                Kalender öffnen
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Wird implementiert, sobald die FHIR-Integration abgeschlossen ist.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
