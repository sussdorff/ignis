import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { createPatient } from '@/lib/api'

export default function PatientIntake() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
      alert(t('intake.successMessage'))
      navigate('/patient/book')
    } catch (error) {
      alert(t('intake.errorMessage'))
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
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🔥 {t('app.title')}</h1>
          <p className="text-lg text-gray-600">{t('intake.title')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('intake.subtitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">{t('intake.fields.firstName')} *</Label>
                  <Input
                    id="firstName"
                    required
                    value={formData.firstName}
                    onChange={e => handleChange('firstName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">{t('intake.fields.lastName')} *</Label>
                  <Input
                    id="lastName"
                    required
                    value={formData.lastName}
                    onChange={e => handleChange('lastName', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">{t('intake.fields.phone')} *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  placeholder={t('intake.phonePlaceholder')}
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="birthDate">{t('intake.fields.birthDate')} *</Label>
                <Input
                  id="birthDate"
                  type="date"
                  required
                  value={formData.birthDate}
                  onChange={e => handleChange('birthDate', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="email">{t('intake.fields.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="address">{t('intake.fields.address')}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={e => handleChange('address', e.target.value)}
                />
              </div>

              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('intake.submitting') : t('intake.submitButton')}
                </Button>
              </div>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                💡 <strong>{t('common.required')}:</strong> {t('intake.hint')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
