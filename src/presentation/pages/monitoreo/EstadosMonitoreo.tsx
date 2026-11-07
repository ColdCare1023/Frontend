import { Suspense, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { adorno } from '@/lib/adorno'
import { Button } from '@/presentation/components/ui/button'
import { BandaRango, CapasColor } from './CapasColor'

const VialEquipo = adorno(() => import('../../efectos/tresd/VialEquipo').then((m) => m.VialEquipo))

/** Sin lectura, el vial queda apagado: la escena espera sin aparentar un dato. */
function VialApagado() {
  const reducir = useReducedMotion()
  if (reducir || import.meta.env.MODE === 'test' || typeof IntersectionObserver === 'undefined') return null
  return (
    <Suspense fallback={null}>
      <VialEquipo fase={2} variante="vacuna" temperatura={null} className="campo__vial" />
    </Suspense>
  )
}

/** Carga: los campos que vienen, en reposo. Mismo tamaño que el contenido, para que nada salte al llegar. */
export function CargaMonitoreo({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex flex-col gap-8">
      <span className="sr-only">{t('app.cargando')}</span>
      <div aria-hidden className="campos">
        <div className="campo campo--reposo" data-tono="sinDatos">
          <CapasColor tono="sinDatos" />
          <div className="campo__cabeza">
            <span className="campo__reposo-linea" style={{ width: '38%' }} />
          </div>
          <div className="campo__cuerpo">
            <span className="campo__reposo-cifra" />
            <span className="campo__reposo-linea mt-4" style={{ width: '24%' }} />
          </div>
          <BandaRango valor={null} />
        </div>
      </div>
      {children}
    </div>
  )
}

/** Aún no llega ninguna lectura: el campo espera, sin ceros ni datos que no existen. */
export function VacioMonitoreo() {
  const { t } = useTranslation()
  return (
    <div className="campos">
      <div role="status" className="campo" data-tono="sinDatos">
        <CapasColor tono="sinDatos" />
        <VialApagado />
        <div className="campo__cuerpo">
          <p className="campo__mensaje">{t('dashboard.esperandoDatos')}</p>
          <p className="campo__explicacion">{t('dashboard.esperandoDetalle')}</p>
        </div>
        <BandaRango valor={null} />
      </div>
    </div>
  )
}

/** Sin lecturas porque la consulta falló: se dice tal cual y se ofrece reintentar. */
export function ErrorMonitoreo({ onReintentar }: { onReintentar: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="campos">
      <div className="campo" data-tono="sinDatos">
        <CapasColor tono="sinDatos" />
        <VialApagado />
        <div role="alert" className="campo__cuerpo">
          <p className="campo__mensaje">{t('dashboard.errorHistorial')}</p>
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={onReintentar}>
              {t('comunes.reintentar')}
            </Button>
          </div>
        </div>
        <BandaRango valor={null} />
      </div>
    </div>
  )
}
