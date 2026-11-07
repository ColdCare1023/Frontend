import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, FlaskConical } from 'lucide-react'

import { apiClient } from '@/infrastructure/api/apiClient'
import { DISPOSITIVO_DEMO } from '@/infrastructure/demo/constantesDemo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { rutaApi } from '@/lib/rutaApi'
import { cn } from '@/lib/utils'
import { Button } from '@/presentation/components/ui/button'

type EscenarioDashboard =
  | 'sin_datos'
  | 'buffer_pendiente'
  | 'buffer_lleno'
  | 'falla_sensor'
  | 'puerta_abierta'
  | 'puerta_cerrada'
  | 'recuperar'

const ESCENARIOS_DASHBOARD: Array<{ id: EscenarioDashboard; clave: string }> = [
  { id: 'sin_datos', clave: 'dashboard.demoSinDatos' },
  { id: 'buffer_pendiente', clave: 'dashboard.demoBufferPendiente' },
  { id: 'buffer_lleno', clave: 'dashboard.demoBufferLleno' },
  { id: 'falla_sensor', clave: 'dashboard.demoFallaSensor' },
  { id: 'puerta_abierta', clave: 'dashboard.demoPuertaAbierta' },
  { id: 'puerta_cerrada', clave: 'dashboard.demoPuertaCerrada' },
  { id: 'recuperar', clave: 'dashboard.demoRecuperar' },
]

const CLASE_SELECTOR = 'min-h-11 rounded-(--radius-field) border border-border bg-surface px-3 text-sm font-normal text-foreground focus-visible:outline-2 focus-visible:outline-primary sm:min-h-10 sm:pointer-coarse:min-h-11'

/** Solo en demostración: prueba los estados de la pantalla sin un equipo real. */
export function SimuladorEstados({ onActualizado }: { onActualizado: () => Promise<void> }) {
  const { t } = useTranslation()
  const [ejecutando, setEjecutando] = useState<EscenarioDashboard | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [umbralSilencio, setUmbralSilencio] = useState(90)
  const [umbralPuerta, setUmbralPuerta] = useState(120)

  const ejecutar = async (escenario: EscenarioDashboard) => {
    setEjecutando(escenario)
    setMensaje(null)
    try {
      await apiClient.post(rutaApi`/api/demo/dispositivos/${DISPOSITIVO_DEMO}/simulacion`, {
        escenario,
        umbral_sin_datos_segundos: umbralSilencio,
        umbral_puerta_abierta_segundos: umbralPuerta,
      })
      await onActualizado()
      setMensaje({ tipo: 'ok', texto: t('dashboard.demoAplicado') })
    } catch {
      setMensaje({ tipo: 'error', texto: t('dashboard.demoError') })
    } finally {
      setEjecutando(null)
    }
  }

  if (!MODO_DEMO) return null

  return (
    <details className="group simulador">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <FlaskConical className="size-4" aria-hidden />
          {t('dashboard.demoTitulo')}
          <span className="sr-only">{t('demo.badge')}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="pb-4 pt-2">
        <p className="sr-only">{t('dashboard.demoAyuda')}</p>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium text-muted" htmlFor="umbral-silencio-demo">
            {t('dashboard.umbralSilencio')}
            <select
              id="umbral-silencio-demo"
              className={CLASE_SELECTOR}
              disabled={ejecutando !== null}
              value={umbralSilencio}
              onChange={(event) => setUmbralSilencio(Number(event.target.value))}
            >
              <option value={60}>60 s</option>
              <option value={90}>90 s</option>
              <option value={180}>180 s</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted" htmlFor="umbral-puerta-demo">
            {t('dashboard.umbralPuerta')}
            <select
              id="umbral-puerta-demo"
              className={CLASE_SELECTOR}
              disabled={ejecutando !== null}
              value={umbralPuerta}
              onChange={(event) => setUmbralPuerta(Number(event.target.value))}
            >
              <option value={60}>1 min</option>
              <option value={120}>2 min</option>
              <option value={300}>5 min</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {ESCENARIOS_DASHBOARD.map(({ id, clave }) => (
            <Button
              key={id}
              type="button"
              variant={id === 'recuperar' ? 'primary' : 'secondary'}
              size="sm"
              className={cn('justify-center whitespace-normal', id === 'recuperar' && 'sm:col-span-2 xl:col-span-2')}
              disabled={ejecutando !== null}
              onClick={() => void ejecutar(id)}
            >
              {ejecutando === id ? t('dashboard.demoAplicando') : t(clave)}
            </Button>
          ))}
        </div>
        {mensaje && (
          <p
            role={mensaje.tipo === 'error' ? 'alert' : 'status'}
            className={cn('mt-3 text-[13px] font-medium', mensaje.tipo === 'error' ? 'text-clay-700' : 'text-success-700')}
          >
            {mensaje.texto}
          </p>
        )}
      </div>
    </details>
  )
}
