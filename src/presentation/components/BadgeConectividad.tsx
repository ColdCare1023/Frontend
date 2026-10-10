import { useTranslation } from 'react-i18next'

import { hora } from '@/lib/formato'
import { Badge } from './ui/badge'

/**
 * HU-13: conectividad del NODO (no de la última lectura, que siempre se envió
 * conectada). Offline indica desde cuándo, según el backend.
 */
export function BadgeConectividad({
  estado,
  desde,
  testId,
}: {
  estado: string | null | undefined
  desde?: string | null
  testId?: string
}) {
  const { t } = useTranslation()
  const online = estado === 'online'
  return (
    <Badge variant={online ? 'ok' : 'neutral'} dot data-testid={testId}>
      {online
        ? t('dashboard.dispositivoOnline')
        : desde
          ? t('dashboard.nodoSinConexionDesde', { hora: hora(desde) })
          : t('dashboard.dispositivoOffline')}
    </Badge>
  )
}
