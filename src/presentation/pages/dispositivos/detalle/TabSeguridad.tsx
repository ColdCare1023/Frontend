import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, KeyRound, RefreshCw, Server } from 'lucide-react'

import { estadoCredencial, type CausaRotacion, type CredencialRotada, type Dispositivo } from '@/domain/entities/Dispositivo'
import { fechaHora } from '@/lib/formato'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input, Label, NativeSelect } from '../../../components/ui/input'
import { Aviso, MensajeFormulario, PieFormulario, RevelarToken, Tarjeta, type Mensaje } from '../compartido'
import { useFlota } from '../contextoFlota'
import { ZonaRiesgo } from './ZonaRiesgo'

/** HU-43/44 y FE-003: credencial MQTT, consola del broker y zona de riesgo. */
export function TabSeguridad({ dispositivo }: { dispositivo: Dispositivo }) {
  const { t } = useTranslation()
  const [aviso, setAviso] = useState<string | null>(null)
  const credencial = estadoCredencial(dispositivo)

  return (
    <div className="grid grid-cols-12 items-start gap-3 xl:gap-4">
      {aviso && <MensajeFormulario className="col-span-12" mensaje={{ tipo: 'ok', texto: aviso }} />}
      <Tarjeta
        id="seguridad-credencial"
        titulo={t('dispositivos.credencialEstado')}
        icono={KeyRound}
        className="col-span-12 lg:col-span-7"
        accion={<Badge variant={credencial === 'revocada' || credencial === 'error' ? 'critical' : credencial === 'pendiente' ? 'warn' : 'outline'}>{t(`dispositivos.credencial.${credencial}`)}</Badge>}
      >
        {dispositivo.mqtt_credencial_actualizada_en && (
          <p className="mb-3 nums text-meta text-faint">
            {t('dispositivos.seguridadTab.actualizadaEl', { fecha: fechaHora(dispositivo.mqtt_credencial_actualizada_en) })}
          </p>
        )}
        <div className="space-y-2">
          {dispositivo.rotacion_por_compromiso && (
            <Aviso tono="critical" ayuda={t('dispositivos.telemetriaRetenidaAyuda')}>{t('dispositivos.telemetriaRetenida')}</Aviso>
          )}
          {dispositivo.posesion_pendiente && <AvisoPosesion dispositivo={dispositivo} />}
        </div>
        <RotarCredencial dispositivo={dispositivo} />
      </Tarjeta>

      <ConsolaBroker dispositivo={dispositivo} />

      <ZonaRiesgo dispositivo={dispositivo} alRevocar={setAviso} />
    </div>
  )
}

function AvisoPosesion({ dispositivo }: { dispositivo: Dispositivo }) {
  const { t } = useTranslation()
  const { reenviarDesafio } = useFlota()
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Mensaje>(null)

  const reenviar = async () => {
    // Un doble clic expulsaría la sesión dos veces seguidas.
    if (enviando) return
    setEnviando(true)
    const r = await reenviarDesafio(dispositivo.id)
    setEnviando(false)
    setResultado({ tipo: r === 'ok' ? 'ok' : 'error', texto: t(r === 'ok' ? 'dispositivos.desafioReenviado' : 'comunes.error') })
  }

  return (
    <Aviso
      tono="warn"
      ayuda={
        <>
          <p>{t('dispositivos.posesionPendienteAyuda')}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            disabled={enviando}
            title={t('dispositivos.reenviarDesafioAyuda')}
            onClick={() => void reenviar()}
          >
            <RefreshCw />
            {t('dispositivos.reenviarDesafio')}
          </Button>
          <MensajeFormulario className="mt-2" mensaje={resultado} />
        </>
      }
    >
      {t('dispositivos.posesionPendiente')}
    </Aviso>
  )
}

function RotarCredencial({ dispositivo }: { dispositivo: Dispositivo }) {
  const { t } = useTranslation()
  const { rotarCredencial } = useFlota()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [causa, setCausa] = useState<CausaRotacion>('preventiva')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  // FE-003: el token rotado vive solo aquí; se descarta con «Listo» o al salir.
  const [rotada, setRotada] = useState<CredencialRotada | null>(null)

  useEffect(() => {
    if (abierto) document.getElementById('credencial-motivo')?.focus()
  }, [abierto])

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!motivo.trim()) return
    setEnviando(true)
    setMensaje(null)
    const credencial = await rotarCredencial(dispositivo.id, motivo.trim(), causa)
    setEnviando(false)
    if (credencial) {
      setRotada(credencial)
      setAbierto(false)
      setMotivo('')
      setCausa('preventiva')
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  if (rotada) {
    return (
      <div className="mt-4 border-t border-border pt-4">
        <RevelarToken credencial={rotada} alTerminar={() => setRotada(null)} />
      </div>
    )
  }

  if (!abierto) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="secondary" disabled={!dispositivo.activo} onClick={() => setAbierto(true)}>
          <KeyRound />
          {t('dispositivos.rotarCredencial')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-meta text-muted">{t('dispositivos.rotarCredencialDescripcion', { id: dispositivo.id })}</p>
      <div>
        <Label htmlFor="credencial-motivo">{t('dispositivos.motivoCredencial')}</Label>
        <Input
          id="credencial-motivo"
          value={motivo}
          maxLength={200}
          required
          aria-describedby="credencial-motivo-ayuda"
          onChange={(e) => setMotivo(e.target.value)}
        />
        <p id="credencial-motivo-ayuda" className="mt-1 text-meta text-muted">{t('dispositivos.motivoCredencialAyuda')}</p>
      </div>
      <div>
        <Label htmlFor="credencial-causa">{t('dispositivos.causaRotacion')}</Label>
        <NativeSelect
          id="credencial-causa"
          value={causa}
          aria-describedby="credencial-causa-ayuda"
          onChange={(e) => setCausa(e.target.value as CausaRotacion)}
        >
          <option value="preventiva">{t('dispositivos.causasRotacion.preventiva')}</option>
          <option value="compromiso">{t('dispositivos.causasRotacion.compromiso')}</option>
        </NativeSelect>
        <p id="credencial-causa-ayuda" className="mt-1 text-meta text-muted">{t(`dispositivos.causaRotacionAyuda.${causa}`)}</p>
      </div>
      <MensajeFormulario mensaje={mensaje} />
      <PieFormulario>
        <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>{t('usuarios.cancelar')}</Button>
        <Button type="submit" disabled={enviando || !motivo.trim()}>
          {enviando ? t('dispositivos.procesando') : t('dispositivos.rotarCredencial')}
        </Button>
      </PieFormulario>
    </form>
  )
}

function ConsolaBroker({ dispositivo }: { dispositivo: Dispositivo }) {
  const { t } = useTranslation()
  const { confirmarBroker } = useFlota()
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setEnviando(true)
    setMensaje(null)
    const resultado = await confirmarBroker(dispositivo.id, nota.trim())
    setEnviando(false)
    if (resultado === 'ok') {
      setNota('')
      setMensaje({ tipo: 'ok', texto: t('dispositivos.brokerConfirmado') })
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  return (
    <Tarjeta id="seguridad-consola" titulo={t('dispositivos.seguridadTab.consola')} icono={Server} className="col-span-12 lg:col-span-5">
      {dispositivo.broker_pendiente ? (
        <form onSubmit={(e) => void enviar(e)} className="space-y-3">
          <Aviso
            tono="warn"
            ayuda={
              <>
                {dispositivo.broker_pendiente_desde && (
                  <p className="nums">{t('dispositivos.brokerPendienteDesde', { fecha: fechaHora(dispositivo.broker_pendiente_desde) })}</p>
                )}
                <p>{t(`dispositivos.confirmarBrokerDescripcion.${dispositivo.broker_pendiente}`, { id: dispositivo.id })}</p>
              </>
            }
          >
            {t(`dispositivos.brokerPendiente.${dispositivo.broker_pendiente}`)}
            {/* HU-44 esc. 3: el motivo distingue la operación manual de un fallo de la API del broker. */}
            {dispositivo.broker_pendiente_motivo && (
              <span className="block text-meta text-muted">
                {t(`dispositivos.brokerPendienteMotivo.${dispositivo.broker_pendiente_motivo}`, { defaultValue: dispositivo.broker_pendiente_motivo })}
              </span>
            )}
          </Aviso>
          <div>
            <Label htmlFor="broker-nota">{t('dispositivos.notaBroker')}</Label>
            <Input id="broker-nota" value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} />
          </div>
          <MensajeFormulario mensaje={mensaje} />
          <div className="flex justify-end">
            <Button type="submit" disabled={enviando}>
              <CircleCheck />
              {enviando ? t('dispositivos.procesando') : t('dispositivos.confirmarBroker')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-1">
          <MensajeFormulario mensaje={mensaje} className="mb-2" />
          <p className="text-body text-subtle">{t('dispositivos.seguridadTab.sinPendientes')}</p>
          {dispositivo.broker_confirmado_en && (
            <p className="nums text-meta text-faint">
              {t('dispositivos.seguridadTab.ultimaConfirmacion', { fecha: fechaHora(dispositivo.broker_confirmado_en) })}
            </p>
          )}
        </div>
      )}
    </Tarjeta>
  )
}
