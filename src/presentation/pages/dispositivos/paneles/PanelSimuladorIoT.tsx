import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical, KeyRound } from 'lucide-react'

import { CAPACIDAD_BUFFER_LITTLEFS } from '@/domain/entities/Dispositivo'
import { Button } from '../../../components/ui/button'
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelDescription,
  SidePanelHeader,
  SidePanelTitle,
} from '../../../components/ui/side-panel'
import { Dato, MensajeFormulario, type Mensaje } from '../compartido'
import { useFlota } from '../contextoFlota'

type EscenarioIoT = 'sin_datos' | 'buffer_pendiente' | 'buffer_lleno' | 'falla_sensor' | 'recuperar'

const ESCENARIOS: ReadonlyArray<readonly [EscenarioIoT, string, string]> = [
  ['sin_datos', 'dispositivos.escenarioSinDatos', 'dispositivos.simulador.ayudaSinDatos'],
  ['buffer_pendiente', 'dispositivos.escenarioBuffer', 'dispositivos.simulador.ayudaBuffer'],
  ['buffer_lleno', 'dispositivos.escenarioPerdida', 'dispositivos.simulador.ayudaPerdida'],
  ['falla_sensor', 'dispositivos.escenarioSensor', 'dispositivos.simulador.ayudaSensor'],
  ['recuperar', 'dispositivos.escenarioRecuperacion', 'dispositivos.simulador.ayudaRecuperacion'],
]

/** Solo MODO_DEMO: los mismos 5 escenarios locales de siempre. */
export function PanelSimuladorIoT({ deviceId, alCerrar }: { deviceId: string | null; alCerrar: () => void }) {
  const { t } = useTranslation()
  const { dispositivos, simularEscenario } = useFlota()
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const dispositivo = dispositivos.find((d) => d.id === deviceId) ?? null

  const ejecutar = async (escenario: EscenarioIoT) => {
    if (!deviceId) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await simularEscenario(deviceId, escenario)
    setEnviando(false)
    setMensaje({ tipo: resultado ? 'ok' : 'error', texto: t(resultado ? 'dispositivos.escenarioAplicado' : 'comunes.error') })
  }

  return (
    <SidePanel
      open={deviceId !== null}
      onOpenChange={(abierto) => {
        if (!abierto) {
          setMensaje(null)
          alCerrar()
        }
      }}
    >
      <SidePanelContent>
        <SidePanelHeader>
          <SidePanelTitle>{t('dispositivos.probarIoT')}</SidePanelTitle>
          <SidePanelDescription>{t('dispositivos.simulacionSoloDemo', { id: deviceId ?? '' })}</SidePanelDescription>
        </SidePanelHeader>
        <SidePanelBody className="space-y-4">
          <div className="grid gap-2">
            {ESCENARIOS.map(([escenario, clave, ayuda]) => (
              <Button
                key={escenario}
                variant="secondary"
                className="h-auto min-h-14 w-full min-w-0 justify-start px-3 py-2 text-left sm:h-auto"
                disabled={enviando}
                onClick={() => void ejecutar(escenario)}
              >
                {escenario === 'recuperar' ? <KeyRound /> : <FlaskConical />}
                <span className="min-w-0 whitespace-normal">
                  <span className="block font-medium leading-snug">{t(clave)}</span>
                  <span className="block text-meta font-normal text-muted">{t(ayuda)}</span>
                </span>
              </Button>
            ))}
          </div>
          <MensajeFormulario mensaje={mensaje} />
          {dispositivo && (
            <section aria-labelledby="simulador-estado" className="rounded-(--radius-field) border border-border px-3 py-1">
              <h3 id="simulador-estado" className="pt-2 text-meta font-medium text-muted">{t('dispositivos.simulador.estadoActual')}</h3>
              <dl className="grid grid-cols-2 gap-x-4">
                <Dato etiqueta={t('dispositivos.estado')}>
                  {dispositivo.estado_operativo ? t(`dispositivos.estadoOperativo.${dispositivo.estado_operativo}`) : '—'}
                </Dato>
                <Dato etiqueta={t('dispositivos.bufferLocal')}>
                  <span className="nums">
                    {dispositivo.buffer_littlefs?.pendientes ?? 0} / {dispositivo.buffer_littlefs?.limite ?? CAPACIDAD_BUFFER_LITTLEFS}
                  </span>
                </Dato>
              </dl>
            </section>
          )}
        </SidePanelBody>
      </SidePanelContent>
    </SidePanel>
  )
}
