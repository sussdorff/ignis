import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/ui/language-switcher'

export default function PatientBook() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🔥 {t('app.title')}</h1>
          <p className="text-lg text-gray-600">{t('book.title')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('book.subtitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 bg-blue-50 rounded-lg text-center">
              <div className="text-6xl mb-4">📞</div>
              <h3 className="text-xl font-semibold mb-2">{t('book.callSection.title')}</h3>
              <p className="text-gray-600 mb-4">
                {t('book.callSection.description')}
              </p>
              <Button size="lg" className="text-lg px-8">
                📞 {t('book.callSection.button')}
              </Button>
            </div>

            <div className="text-center py-4">
              <p className="text-sm text-gray-500">{t('book.or')}</p>
            </div>

            <div className="p-6 bg-gray-50 rounded-lg text-center">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-2">{t('book.calendarSection.title')}</h3>
              <p className="text-gray-600 mb-4">
                {t('book.calendarSection.description')}
              </p>
              <Button variant="outline" size="lg">
                {t('book.calendarSection.button')}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                {t('book.calendarSection.note')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
