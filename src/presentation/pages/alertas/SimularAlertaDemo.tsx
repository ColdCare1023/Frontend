import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, FlaskConical, OctagonAlert, TriangleAlert } from 'lucide-react'

import { apiClient } from '@/infrastructure/api/apiClient'
import { DISPOSITIVO_DEMO } from '@/infrastructure/demo/constantesDemo'
import { rutaApi } from '@/lib/rutaApi'
import { Button } from '../../components/ui/button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '../../components/ui/menu'

type Escenario = 'excursion_critica' | 'riesgo_preventivo'

/**
 * Solo MODO_DEMO (como «Probar estados» del Dashboard, para los mismos roles):
 * simula una excursión del equipo demo. La fila nueva llega por el stream en
 * vivo, igual que llegaría por SSE desde el backend, sin recargar la página.
 */
export function SimularAlertaDemo({ onError }: { onError: () => void }) {
  const { t } = useTranslation()
  const [enviando, setEnviando] = useState(false)

  const simular = async (escenario: Escenario) => {
    setEnviando(true)
    try {
      await apiClient.post(rutaApi`/api/demo/dispositivos/${DISPOSITIVO_DEMO}/simulacion`, { escenario })
    } catch {
      onError()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={t('alertas.demo.simularEtiqueta')} disabled={enviando}>
          <FlaskConical aria-hidden />
          {t('alertas.demo.simular')}
          <ChevronDown aria-hidden className="text-faint" />
        </Button>
      </MenuTrigger>
      <MenuContent className="min-w-60">
        <MenuLabel>{t('alertas.demo.grupo', { equipo: DISPOSITIVO_DEMO })}</MenuLabel>
        <MenuItem onSelect={() => void simular('excursion_critica')}>
          <OctagonAlert aria-hidden className="text-critical" />
          {t('alertas.demo.excursionCritica')}
        </MenuItem>
        <MenuItem onSelect={() => void simular('riesgo_preventivo')}>
          <TriangleAlert aria-hidden className="text-warning-700" />
          {t('alertas.demo.riesgoPreventivo')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
