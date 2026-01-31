import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createPatient } from '@/lib/api'

export default function PatientIntake() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: '',
    email: '',
    address: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await createPatient({
        ...formData,
        urgency: 'regular',
      })
      alert('Registrierung erfolgreich! Sie werden bald kontaktiert.')
      navigate('/patient/book')
    } catch (error) {
      alert('Fehler bei der Registrierung. Bitte versuchen Sie es erneut.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🔥 Ignis</h1>
          <p className="text-lg text-gray-600">Patientenaufnahme</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ihre Daten</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Vorname *</Label>
                  <Input
                    id="firstName"
                    required
                    value={formData.firstName}
                    onChange={e => handleChange('firstName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nachname *</Label>
                  <Input
                    id="lastName"
                    required
                    value={formData.lastName}
                    onChange={e => handleChange('lastName', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Telefonnummer *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  placeholder="+49..."
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="birthDate">Geburtsdatum *</Label>
                <Input
                  id="birthDate"
                  type="date"
                  required
                  value={formData.birthDate}
                  onChange={e => handleChange('birthDate', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={e => handleChange('address', e.target.value)}
                />
              </div>

              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Wird gesendet...' : 'Registrierung abschließen'}
                </Button>
              </div>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                💡 <strong>Hinweis:</strong> Sie können auch anrufen, um einen Termin zu vereinbaren. 
                Unsere KI-Assistentin hilft Ihnen rund um die Uhr weiter.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
