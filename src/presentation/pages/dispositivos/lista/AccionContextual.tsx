import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import * as Popover from '@radix-ui/react-popover'
import { CalendarClock, CircleCheck, RefreshCw } from 'lucide-react'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Button } from '../../../components/ui/button'
import { Input, Label } from '../../../components/ui/input'
import { MensajeFormulario, type Mensaje } from '../compartido'
import { useFlota } from '../contextoFlota'
import type { AccionFila } from '../estadoEquipo'

/**
 * Una sola acción visible por equipo, la más urgente (SPEC P5b D5): confirmar
 * la consola del broker (formulario en un popover), reenviar el desafío de
 * posesión o ir a registrar la calibración. Nada destructivo vive aquí.
 */
export function AccionContextual({
  dispositivo,
  accion,
  primaria = false,
  className,
}: {
  dispositivo: Dispositivo
  accion: Exclude<AccionFila, null>
  primaria?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const variante = primaria ? 'primary' : 'secondary'

  if (accion === 'calibrar') {
    return (
      <Button
        variant={variante}
        size="sm"
        aria-label={t('dispositivos.accionFila.calibrarA', { id: dispositivo.id })}
        className={cn('relative z-10', className)}
        onClick={() => navigate(`/dispositivos/${encodeURIComponent(dispositivo.id)}?tab=calibracion&accion=registrar`)}
      >
        <CalendarClock aria-hidden />
        {t('dispositivos.accionFila.calibrar')}
      </Button>
    )
  }
  if (accion === 'reenviar') return <ReenviarDesafio dispositivo={dispositivo} variante={variante} className={className} />
  return <ConfirmarConsola dispositivo={dispositivo} variante={variante} className={className} />
}

function ReenviarDesafio({ dispositivo, variante, className }: { dispositivo: Dispositivo; variante: 'primary' | 'secondary'; className?: string }) {
  const { t } = useTranslation()
  const { reenviarDesafio } = useFlota()
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  const reenviar = async () => {
    // Un doble clic expulsaría la sesión dos veces seguidas.
    if (enviando) return
    setEnviando(true)
    const r = await reenviarDesafio(dispositivo.id)
    setEnviando(false)
    setResultado(t(r === 'ok' ? 'dispositivos.desafioReenviado' : 'comunes.error'))
  }

  return (
    <>
      <Button
        variant={variante}
        size="sm"
        disabled={enviando}
        title={t('dispositivos.reenviarDesafioAyuda')}
        aria-label={t('dispositivos.accionFila.reenviarA', { id: dispositivo.id })}
        onClick={() => void reenviar()}
        className={cn('relative z-10', className)}
      >
        <RefreshCw aria-hidden />
        {t(enviando ? 'dispositivos.accionFila.reenviando' : 'dispositivos.accionFila.reenviar')}
      </Button>
      <span role="status" className="sr-only">{resultado}</span>
    </>
  )
}

function ConfirmarConsola({ dispositivo, variante, className }: { dispositivo: Dispositivo; variante: 'primary' | 'secondary'; className?: string }) {
  const { t } = useTranslation()
  const { confirmarBroker } = useFlota()
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const idNota = `broker-nota-${dispositivo.id}`

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setEnviando(true)
    setMensaje(null)
    const resultado = await confirmarBroker(dispositivo.id, nota.trim())
    setEnviando(false)
    if (resultado === 'ok') {
      setAbierto(false)
      setNota('')
    } else {
      // El error se queda dentro del popover y conserva lo escrito.
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(siguiente) => {
        setAbierto(siguiente)
        if (!siguiente) setMensaje(null)
      }}
    >
      <Popover.Trigger asChild>
        <Button
          variant={variante}
          size="sm"
          aria-label={t('dispositivos.accionFila.confirmarA', { id: dispositivo.id })}
          className={cn('relative z-10', className)}
        >
          <CircleCheck aria-hidden />
          {t('dispositivos.accionFila.confirmar')}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-label={t('dispositivos.confirmarBroker')}
          className="flotante z-50 w-90 max-w-[calc(100vw-24px)] origin-(--radix-popover-content-transform-origin) rounded-(--radius-modal) p-4 data-[state=open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out)"
        >
          <form onSubmit={(e) => void enviar(e)} className="space-y-3">
            <div>
              <p className="text-title text-foreground">{t('dispositivos.confirmarBroker')}</p>
              {dispositivo.broker_pendiente && (
                <p className="mt-1 text-meta text-muted">
                  {t(`dispositivos.confirmarBrokerDescripcion.${dispositivo.broker_pendiente}`, { id: dispositivo.id })}
                </p>
              )}
              {dispositivo.broker_pendiente_desde && (
                <p className="mt-1 nums text-meta text-faint">
                  {t('dispositivos.brokerPendienteDesde', { fecha: fechaHora(dispositivo.broker_pendiente_desde) })}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor={idNota}>{t('dispositivos.notaBroker')}</Label>
              <Input id={idNota} value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} />
            </div>
            <MensajeFormulario mensaje={mensaje} />
            <div className="flex justify-end gap-2">
              <Popover.Close asChild>
                <Button variant="ghost" size="sm" disabled={enviando}>{t('usuarios.cancelar')}</Button>
              </Popover.Close>
              <Button type="submit" size="sm" disabled={enviando}>
                {t(enviando ? 'dispositivos.accionFila.confirmando' : 'dispositivos.confirmarBroker')}
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
