import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { estadoCredencial, MOTIVOS_BAJA, type Dispositivo, type MotivoBaja } from '@/domain/entities/Dispositivo'
import { fechaCorta, fechaHora } from '@/lib/formato'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog'
import { Input, Label, NativeSelect, Textarea } from '../../../components/ui/input'
import { MensajeFormulario, type Mensaje } from '../compartido'
import { useFlota } from '../contextoFlota'

const BOTON_PELIGRO = 'border border-danger-200 bg-surface text-danger-700 hover:border-danger-200 hover:bg-danger-100'

/**
 * Zona de riesgo (PLAN_FINAL opción B): revocar la credencial y dar de baja
 * viven al final de Seguridad, cada una con su `alertdialog` y motivo.
 */
export function ZonaRiesgo({ dispositivo, alRevocar }: { dispositivo: Dispositivo; alRevocar: (texto: string) => void }) {
  const { t } = useTranslation()
  const [dialogo, setDialogo] = useState<'revocar' | 'baja' | null>(null)
  const revocada = estadoCredencial(dispositivo) === 'revocada'

  return (
    <section aria-labelledby="zona-riesgo" className="superficie col-span-12 border-danger-200 p-4 xl:p-5">
      <h2 id="zona-riesgo" className="text-title text-danger-700">{t('dispositivos.seguridadTab.zonaRiesgo')}</h2>
      <p className="mt-0.5 text-body text-muted">{t('dispositivos.seguridadTab.zonaRiesgoDetalle')}</p>
      <div className="mt-3 divide-y divide-border">
        <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-body font-medium text-foreground">{t('dispositivos.seguridadTab.revocarFila')}</p>
            <p className="text-meta text-muted">
              {revocada
                ? t('dispositivos.seguridadTab.yaRevocada', {
                    fecha: dispositivo.mqtt_credencial_actualizada_en ? fechaHora(dispositivo.mqtt_credencial_actualizada_en) : '—',
                  })
                : t('dispositivos.revocarCredencialDescripcion', { id: dispositivo.id })}
            </p>
          </div>
          {!revocada && (
            <Button variant="secondary" className={BOTON_PELIGRO} onClick={() => setDialogo('revocar')}>
              {t('dispositivos.seguridadTab.revocarBoton')}
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-body font-medium text-foreground">{t('dispositivos.seguridadTab.bajaFila')}</p>
            <p className="text-meta text-muted">
              {dispositivo.activo
                ? t('dispositivos.seguridadTab.bajaFilaDetalle')
                : [
                    t('dispositivos.seguridadTab.yaDadoDeBaja', {
                      fecha: dispositivo.dado_de_baja_en ? fechaCorta(dispositivo.dado_de_baja_en) : '—',
                      motivo: dispositivo.motivo_baja ? t(`dispositivos.motivos.${dispositivo.motivo_baja}`, { defaultValue: dispositivo.motivo_baja }) : '—',
                    }),
                    dispositivo.reemplaza_a_device_id ? t('dispositivos.lista.reemplazaA', { id: dispositivo.reemplaza_a_device_id }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          </div>
          {dispositivo.activo && (
            <Button variant="secondary" className={BOTON_PELIGRO} onClick={() => setDialogo('baja')}>
              {t('dispositivos.seguridadTab.bajaBoton')}
            </Button>
          )}
        </div>
      </div>

      <DialogoRevocar
        abierto={dialogo === 'revocar'}
        dispositivo={dispositivo}
        alCerrar={() => setDialogo(null)}
        alRevocar={(texto) => {
          setDialogo(null)
          alRevocar(texto)
        }}
      />
      <DialogoBaja abierto={dialogo === 'baja'} dispositivo={dispositivo} alCerrar={() => setDialogo(null)} />
    </section>
  )
}

function DialogoRevocar({
  abierto,
  dispositivo,
  alCerrar,
  alRevocar,
}: {
  abierto: boolean
  dispositivo: Dispositivo
  alCerrar: () => void
  alRevocar: (texto: string) => void
}) {
  const { t } = useTranslation()
  const { revocarCredencial } = useFlota()
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!motivo.trim()) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await revocarCredencial(dispositivo.id, motivo.trim())
    setEnviando(false)
    if (resultado === 'revocada') {
      setMotivo('')
      alRevocar(t('dispositivos.credencialRevocada'))
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguiente) => {
        if (!siguiente) {
          setMensaje(null)
          setMotivo('')
          alCerrar()
        }
      }}
    >
      <DialogContent destructivo className="max-w-100">
        <DialogTitle>{t('dispositivos.revocarCredencial')}</DialogTitle>
        <DialogDescription>{t('dispositivos.revocarCredencialDescripcion', { id: dispositivo.id })}</DialogDescription>
        <form onSubmit={(e) => void enviar(e)} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="revocar-motivo">{t('dispositivos.motivoCredencial')}</Label>
            <Input
              id="revocar-motivo"
              value={motivo}
              maxLength={200}
              required
              aria-describedby="revocar-motivo-ayuda"
              onChange={(e) => setMotivo(e.target.value)}
            />
            <p id="revocar-motivo-ayuda" className="mt-1 text-meta text-muted">{t('dispositivos.motivoCredencialAyuda')}</p>
          </div>
          <MensajeFormulario mensaje={mensaje} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={alCerrar} disabled={enviando}>{t('usuarios.cancelar')}</Button>
            <Button type="submit" variant="danger" disabled={enviando || !motivo.trim()}>
              {enviando ? t('dispositivos.procesando') : t('dispositivos.revocarCredencial')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const FORM_BAJA_INICIAL: { motivo: MotivoBaja; descripcion: string; reemplazo: string } = {
  motivo: MOTIVOS_BAJA[0],
  descripcion: '',
  reemplazo: '',
}

function DialogoBaja({ abierto, dispositivo, alCerrar }: { abierto: boolean; dispositivo: Dispositivo; alCerrar: () => void }) {
  const { t } = useTranslation()
  const { darDeBaja } = useFlota()
  const [form, setForm] = useState(FORM_BAJA_INICIAL)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)

  const cerrar = () => {
    setForm(FORM_BAJA_INICIAL)
    setMensaje(null)
    alCerrar()
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setEnviando(true)
    setMensaje(null)
    const resultado = await darDeBaja(dispositivo.id, form.motivo, form.descripcion, form.reemplazo)
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.bajaExitosa') })
      window.setTimeout(cerrar, 1000)
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(siguiente) => !siguiente && cerrar()}>
      <DialogContent destructivo className="max-w-130">
        <DialogTitle>{t('dispositivos.darDeBaja')}</DialogTitle>
        <DialogDescription>{t('dispositivos.confirmarBaja', { id: dispositivo.id })}</DialogDescription>
        <form onSubmit={(e) => void enviar(e)} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="d-motivo">{t('dispositivos.motivo')}</Label>
            <NativeSelect id="d-motivo" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value as MotivoBaja })}>
              {MOTIVOS_BAJA.map((motivo) => (
                <option key={motivo} value={motivo}>{t(`dispositivos.motivos.${motivo}`)}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="d-descripcion">{t('dispositivos.descripcionBaja')}</Label>
            <Textarea id="d-descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="d-reemplazo">{t('dispositivos.deviceIdReemplazo')}</Label>
            <Input
              id="d-reemplazo"
              className="codigo"
              value={form.reemplazo}
              onChange={(e) => setForm({ ...form, reemplazo: e.target.value })}
              placeholder={t('dispositivos.deviceIdReemplazoPlaceholder')}
            />
          </div>
          <MensajeFormulario mensaje={mensaje} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={cerrar} disabled={enviando}>{t('usuarios.cancelar')}</Button>
            <Button type="submit" variant="danger" disabled={enviando}>
              {enviando ? t('dispositivos.procesando') : t('dispositivos.confirmar')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
