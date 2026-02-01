import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  getPrescriptionRequests,
  actionPrescriptionRequest,
  type PrescriptionRequest,
} from '@/lib/api'

interface PrescriptionRequestsProps {
  requests: PrescriptionRequest[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export default function PrescriptionRequests({
  requests,
  loading,
  error,
  onRefresh,
}: PrescriptionRequestsProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.prescriptionRequests.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">{t('dashboard.loading')}</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.prescriptionRequests.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 text-center py-4">{error}</p>
          <div className="flex justify-center">
            <Button variant="outline" onClick={onRefresh}>
              {t('common.retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('dashboard.prescriptionRequests.title')}</span>
          <span className="text-sm font-normal text-gray-600">
            {requests.length} {requests.length === 1 ? 'request' : 'requests'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {t('dashboard.prescriptionRequests.empty')}
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <PrescriptionRequestCard
                key={req.id}
                request={req}
                onAction={onRefresh}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PrescriptionRequestCard({
  request,
  onAction,
}: {
  request: PrescriptionRequest
  onAction: () => void
}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null)
  const [note, setNote] = useState('')

  async function handleAction(action: 'approve' | 'deny') {
    setLoading(action)
    try {
      await actionPrescriptionRequest(request.id, action, note || undefined)
      onAction()
    } catch {
      // Error could be shown via toast; for now just stop loading
    } finally {
      setLoading(null)
    }
  }

  const patientName = request.patient?.name ?? '—'
  const patientDob = request.patient?.birthDate ?? ''
  const medicationOrReason = request.medicationText ?? request.note ?? '—'
  const requestedAt = request.authoredOn
    ? new Date(request.authoredOn).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—'

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-700">
              {t('dashboard.prescriptionRequests.patient')}: {patientName}
              {patientDob && (
                <span className="text-gray-500 font-normal ml-1">
                  ({patientDob})
                </span>
              )}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {t('dashboard.prescriptionRequests.medication')}: {medicationOrReason}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('dashboard.prescriptionRequests.requested')}: {requestedAt}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder={t('dashboard.prescriptionRequests.note')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 min-w-[120px] rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <Button
            size="sm"
            variant="default"
            disabled={loading !== null}
            onClick={() => handleAction('approve')}
          >
            {loading === 'approve' ? '…' : t('dashboard.prescriptionRequests.approve')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading !== null}
            onClick={() => handleAction('deny')}
          >
            {loading === 'deny' ? '…' : t('dashboard.prescriptionRequests.deny')}
          </Button>
        </div>
      </div>
    </div>
  )
}
