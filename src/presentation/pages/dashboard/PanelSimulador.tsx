import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DoorClosed, DoorOpen, HardDrive, Hourglass, RefreshCw, TriangleAlert } from 'lucide-react'

import { apiClient } from '@/infrastructure/api/apiClient'
import { DISPOSITIVO_DEMO } from '@/infrastructure/demo/constantesDemo'
import { rutaApi } from '@/lib/rutaApi'
// clsx sin twMerge: twMerge confunde text-hero/metric/title (tamaño) con text-<color> y borra el tamaño.
import { clsx } from 'clsx'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
  SidePanel,
  SidePanelBody,
  SidePanelClose,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '../../components/ui/side-panel'

type EscenarioDashboard =
  | 'sin_datos'
  | 'buffer_pendiente'
  | 'buffer_lleno'
  | 'falla_sensor'
  | 'puerta_abierta'
  | 'puerta_cerrada'
  | 'recuperar'

const ESCENARIOS: Array<{ id: EscenarioDashboard; clave: string; icono: React.ComponentType<{ className?: string }> }> = [
  { id: 'sin_datos', clave: 'dashboard.demoSinDatos', icono: Hourglass },
  { id: 'buffer_pendiente', clave: 'dashboard.demoBufferPendiente', icono: HardDrive },
  { id: 'buffer_lleno', clave: 'dashboard.demoBufferLleno', icono: HardDrive },
  { id: 'falla_sensor', clave: 'dashboard.demoFallaSensor', icono: TriangleAlert },
  { id: 'puerta_abierta', clave: 'dashboard.demoPuertaAbierta', icono: DoorOpen },
  { id: 'puerta_cerrada', clave: 'dashboard.demoPuertaCerrada', icono: DoorClosed },
  { id: 'recuperar', clave: 'dashboard.demoRecuperar', icono: RefreshCw },
]

const SELECT =
  'min-h-10 rounded-(--radius-field) border border-border-field bg-surface-sunken px-3 text-body font-normal text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/**
 * Simulador de la demostración (Cult UI Side Panel): los mismos escenarios,
 * umbrales y la misma llamada que antes, ahora fuera del flujo del monitoreo.
 * El panel sigue abierto al aplicar para encadenar escenarios.
 */
export function PanelSimulador({
  abierto,
  onAbiertoCambia,
  onActualizado,
  onCloseAutoFocus,
}: {
  onCloseAutoFocus?: (evento: Event) => void
  abierto: boolean
  onAbiertoCambia: (abierto: boolean) => void
  onActualizado: () => Promise<void>
}) {
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

  return (
    <SidePanel open={abierto} onOpenChange={onAbiertoCambia}>
      <SidePanelContent onCloseAutoFocus={onCloseAutoFocus}>
        <SidePanelHeader>
          <SidePanelTitle className="flex flex-wrap items-center gap-2">
            {t('dashboard.demoTitulo')}
            <Badge variant="warn">{t('dashboard.demoEtiqueta')}</Badge>
          </SidePanelTitle>
          <SidePanelDescription>{t('dashboard.demoAyuda')}</SidePanelDescription>
        </SidePanelHeader>
        <SidePanelBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-meta font-medium text-muted" htmlFor="umbral-silencio-demo">
              {t('dashboard.umbralSilencio')}
              <select
                id="umbral-silencio-demo"
                className={SELECT}
                disabled={ejecutando !== null}
                value={umbralSilencio}
                onChange={(evento) => setUmbralSilencio(Number(evento.target.value))}
              >
                <option value={60}>60 s</option>
                <option value={90}>90 s</option>
                <option value={180}>180 s</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-meta font-medium text-muted" htmlFor="umbral-puerta-demo">
              {t('dashboard.umbralPuerta')}
              <select
                id="umbral-puerta-demo"
                className={SELECT}
                disabled={ejecutando !== null}
                value={umbralPuerta}
                onChange={(evento) => setUmbralPuerta(Number(evento.target.value))}
              >
                <option value={60}>1 min</option>
                <option value={120}>2 min</option>
                <option value={300}>5 min</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ESCENARIOS.map(({ id, clave, icono: Icono }) => (
              <Button
                key={id}
                type="button"
                variant={id === 'recuperar' ? 'primary' : 'secondary'}
                size="md"
                className={clsx('h-auto min-h-11 w-full justify-start py-2 text-left whitespace-normal', id === 'recuperar' && 'col-span-2 justify-center')}
                disabled={ejecutando !== null}
                onClick={() => void ejecutar(id)}
              >
                <Icono aria-hidden className="size-4 shrink-0" />
                <span key={ejecutando === id ? 'aplicando' : 'listo'} className="animate-(--animate-fade)">
                  {ejecutando === id ? t('dashboard.demoAplicando') : t(clave)}
                </span>
              </Button>
            ))}
          </div>
        </SidePanelBody>
        <SidePanelFooter className="flex-wrap">
          <p
            aria-live="polite"
            role={mensaje?.tipo === 'error' ? 'alert' : 'status'}
            className={clsx('mr-auto min-h-5 text-meta font-medium', mensaje?.tipo === 'error' ? 'text-danger-700' : 'text-success-700')}
          >
            {mensaje?.texto}
          </p>
          <SidePanelClose asChild>
            <Button variant="secondary" size="sm">
              {t('comunes.cerrar')}
            </Button>
          </SidePanelClose>
        </SidePanelFooter>
      </SidePanelContent>
    </SidePanel>
  )
}
