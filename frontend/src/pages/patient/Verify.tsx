import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/ui/language-switcher'

export default function PatientVerify() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🔥 {t('app.title')}</h1>
          <p className="text-lg text-gray-600">{t('verify.title')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('verify.subtitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  🚩 <strong>{t('verify.validationRequired')}:</strong> {t('verify.validationDescription')}
                </p>
              </div>

              <div className="text-center py-12">
                <p className="text-gray-600">{t('verify.token')}: <code className="bg-gray-100 px-2 py-1 rounded">{token}</code></p>
                <p className="text-sm text-gray-500 mt-4">
                  {t('verify.pendingNote')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
