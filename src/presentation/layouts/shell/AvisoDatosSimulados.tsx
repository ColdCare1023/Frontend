import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'

import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'

/**
 * FE-002 / H1: el ÚNICO indicador de demo, un chip en la cabecera de todas
 * las pantallas y tamaños (antes una franja de 32 px más un chip
 * «Demostración» duplicado en el Dashboard). En un sistema de cadena de frío,
 * confundir datos simulados con reales puede ocultar una excursión térmica
 * verdadera: es `role="status"` y el detalle va completo para el lector.
 */
export function AvisoDatosSimulados() {
  const { t } = useTranslation()
  if (!MODO_DEMO) return null
  return (
    <p
      role="status"
      data-aviso-demo
      title={t('demo.avisoDetalle')}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-warning-100 px-2.5 text-meta font-medium text-warning-700 ring-1 ring-inset ring-warning-600/25"
    >
      <FlaskConical aria-hidden className="size-3.5 shrink-0" />
      <span className="max-sm:sr-only">{t('demo.avisoTitulo')}</span>
      <span aria-hidden className="sm:hidden">
        {t('demo.chipCorto')}
      </span>
      <span className="sr-only">. {t('demo.avisoDetalle')}</span>
    </p>
  )
}
