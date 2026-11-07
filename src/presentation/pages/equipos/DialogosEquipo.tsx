import { useTranslation } from 'react-i18next'
import { FlaskConical, KeyRound } from 'lucide-react'

import { MOTIVOS_BAJA, type CausaRotacion, type MotivoBaja } from '@/domain/entities/Dispositivo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { fechaHora } from '@/lib/formato'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { Campo, Input, NativeSelect, Textarea } from '../../components/ui/input'
import { SelectorFecha } from '../../components/ui/selector-fecha'
import { BloqueSecreto, MensajeFormulario, PieDialogo } from '../usuarios/piezas'
import type { AccionesEquipo } from './useAccionesEquipo'

/** Cada formulario de la ficha: los envíos y validaciones viven en `useAccionesEquipo`. */
export function DialogosEquipo({ a }: { a: AccionesEquipo }) {
  const { t } = useTranslation()
  const d = a.dispositivoActivo
  const dialogo = a.dialogo
  const alCambiar = (abierto: boolean) => {
    if (!abierto) a.cerrarDialogo()
  }

  return (
    <>
      {/* ── HU-43: registrar equipo ─────────────────────────────── */}
      <Dialog open={dialogo === 'crear'} onOpenChange={alCambiar}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>{t('dispositivos.nuevoEquipo')}</DialogTitle>
          <DialogDescription>{t('dispositivos.registroAyuda')}</DialogDescription>
          <form onSubmit={(e) => void a.enviarNuevoDispositivo(e)} className="mt-4 space-y-3.5">
            <Campo etiqueta={t('dispositivos.id')} htmlFor="nuevo-device-id" ayuda={t('dispositivos.codigoUnicoAyuda')}>
              <Input
                id="nuevo-device-id"
                className="nums font-semibold tracking-[-0.01em]"
                value={a.formNuevo.id}
                onChange={(e) => a.setFormNuevo({ ...a.formNuevo, id: e.target.value.toUpperCase() })}
                placeholder="FARM-03-CDL"
                // El mismo contrato del backend (`PATRON_DEVICE_ID`). El guion va escapado: sin eso el navegador descartaba el patrón.
                pattern="[A-Za-z0-9_\-]{1,50}"
                title={t('dispositivos.codigoUnicoAyuda')}
                aria-describedby="nuevo-device-id-ayuda"
                required
              />
            </Campo>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Campo etiqueta={t('dispositivos.nombreEquipo')} htmlFor="nuevo-device-nombre">
                <Input id="nuevo-device-nombre" value={a.formNuevo.nombre} onChange={(e) => a.setFormNuevo({ ...a.formNuevo, nombre: e.target.value })} required />
              </Campo>
              <Campo etiqueta={t('dispositivos.ubicacion')} htmlFor="nuevo-device-ubicacion">
                <Input id="nuevo-device-ubicacion" value={a.formNuevo.ubicacion} onChange={(e) => a.setFormNuevo({ ...a.formNuevo, ubicacion: e.target.value })} required />
              </Campo>
            </div>
            <fieldset className="rounded-(--radius-card) border border-border px-3.5 pb-1 pt-2.5">
              <legend className="px-1 text-[13px] font-medium text-ink-700">{t('dispositivos.sensores')}</legend>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] leading-5 font-medium text-foreground">
                <span className="inline-flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full bg-secondary" />DS18B20</span>
                <span className="inline-flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full bg-secondary" />SHT31</span>
              </p>
              <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2.5 text-[13.5px] font-medium text-foreground">
                <input
                  type="checkbox"
                  className="size-4.5 cursor-pointer accent-(--color-primary)"
                  checked={a.formNuevo.mc38}
                  onChange={(e) => a.setFormNuevo({ ...a.formNuevo, mc38: e.target.checked })}
                />
                MC-38 · {t('dispositivos.opcional')}
              </label>
            </fieldset>
            <p className="text-[13px] leading-5 text-muted">{t('dispositivos.registroCredencialAviso')}</p>
            <MensajeFormulario mensaje={a.mensaje} />
            <PieDialogo>
              <Button variant="ghost" onClick={a.cerrarDialogo} disabled={a.enviando}>{t('usuarios.cancelar')}</Button>
              <Button type="submit" disabled={a.enviando}>{a.enviando ? t('dispositivos.procesando') : t('dispositivos.registrarEquipo')}</Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Solo en demostración: escenarios locales ──────────── */}
      <Dialog open={MODO_DEMO && dialogo === 'simulacion'} onOpenChange={alCambiar}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.probarIoT')}</DialogTitle>
          <DialogDescription>{t('dispositivos.simulacionSoloDemo', { id: d?.id ?? '' })}</DialogDescription>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {([
              ['sin_datos', 'dispositivos.escenarioSinDatos'],
              ['buffer_pendiente', 'dispositivos.escenarioBuffer'],
              ['buffer_lleno', 'dispositivos.escenarioPerdida'],
              ['falla_sensor', 'dispositivos.escenarioSensor'],
              ['recuperar', 'dispositivos.escenarioRecuperacion'],
            ] as const).map(([escenario, clave]) => (
              <Button
                key={escenario}
                variant={escenario === 'recuperar' ? 'primary' : 'secondary'}
                className="h-auto min-h-11 w-full min-w-0 justify-start px-3 py-2 text-left"
                disabled={a.enviando}
                onClick={() => void a.ejecutarEscenario(escenario)}
              >
                {escenario === 'recuperar' ? <KeyRound aria-hidden /> : <FlaskConical aria-hidden />}
                <span className="min-w-0 whitespace-normal break-words leading-snug">{t(clave)}</span>
              </Button>
            ))}
          </div>
          <div className="mt-3 empty:hidden">
            <MensajeFormulario mensaje={a.mensaje} />
          </div>
          <PieDialogo>
            <Button variant="ghost" onClick={a.cerrarDialogo}>{t('comunes.cerrar')}</Button>
          </PieDialogo>
        </DialogContent>
      </Dialog>

      {/* ── FE-003: rotar / revocar credencial MQTT (motivo obligatorio) ── */}
      <Dialog open={dialogo === 'rotar' || dialogo === 'revocar'} onOpenChange={alCambiar}>
        <DialogContent destructivo={dialogo === 'revocar'}>
          <DialogTitle>
            {t(dialogo === 'revocar' ? 'dispositivos.revocarCredencial' : 'dispositivos.rotarCredencial')}
          </DialogTitle>
          <DialogDescription>
            {t(
              dialogo === 'revocar' ? 'dispositivos.revocarCredencialDescripcion' : 'dispositivos.rotarCredencialDescripcion',
              { id: d?.id ?? '' },
            )}
          </DialogDescription>
          <form onSubmit={(e) => void a.enviarCredencial(e)} className="mt-4 space-y-3">
            <Campo etiqueta={t('dispositivos.motivoCredencial')} htmlFor="credencial-motivo" ayuda={t('dispositivos.motivoCredencialAyuda')}>
              <Input
                id="credencial-motivo"
                value={a.motivoCredencial}
                maxLength={200}
                required
                aria-describedby="credencial-motivo-ayuda"
                onChange={(e) => a.setMotivoCredencial(e.target.value)}
              />
            </Campo>
            {dialogo === 'rotar' && (
              <Campo etiqueta={t('dispositivos.causaRotacion')} htmlFor="credencial-causa" ayuda={t(`dispositivos.causaRotacionAyuda.${a.causaRotacion}`)}>
                <NativeSelect
                  id="credencial-causa"
                  value={a.causaRotacion}
                  aria-describedby="credencial-causa-ayuda"
                  onChange={(e) => a.setCausaRotacion(e.target.value as CausaRotacion)}
                >
                  <option value="preventiva">{t('dispositivos.causasRotacion.preventiva')}</option>
                  <option value="compromiso">{t('dispositivos.causasRotacion.compromiso')}</option>
                </NativeSelect>
              </Campo>
            )}
            <MensajeFormulario mensaje={a.mensaje} />
            <PieDialogo>
              <Button variant="ghost" onClick={a.cerrarDialogo} disabled={a.enviando}>{t('usuarios.cancelar')}</Button>
              <Button type="submit" variant={dialogo === 'revocar' ? 'danger' : 'primary'} disabled={a.enviando || !a.motivoCredencial.trim()}>
                {a.enviando
                  ? t('dispositivos.procesando')
                  : t(dialogo === 'revocar' ? 'dispositivos.revocarCredencial' : 'dispositivos.rotarCredencial')}
              </Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* FE-003: el token rotado se muestra UNA vez y se descarta al cerrar. */}
      <Dialog open={dialogo === 'token' && a.credencialRotada !== null} onOpenChange={alCambiar}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.tokenTitulo')}</DialogTitle>
          <DialogDescription>{t('dispositivos.tokenAdvertencia')}</DialogDescription>
          <div className="mt-4 space-y-3">
            <BloqueSecreto
              valor={a.credencialRotada?.token}
              testId="token-rotado"
              copiado={a.tokenCopiado}
              textoCopiar={t('dispositivos.copiarToken')}
              textoCopiado={t('dispositivos.tokenCopiado')}
              onCopiar={() => void a.copiarToken()}
            />
            {a.credencialRotada?.mensaje_broker && (
              <p role="alert" className="rounded-(--radius-field) bg-honey-100 px-3 py-2 text-[13px] leading-5 text-honey-700">
                {a.credencialRotada.mensaje_broker}
              </p>
            )}
            <p role="status" className="text-[13px] leading-5 text-muted">
              {t('dispositivos.credencialRotada')}{' '}
              {a.credencialRotada?.sesion_broker_cerrada === true
                ? t('dispositivos.sesionBrokerCerrada')
                : a.credencialRotada?.sesion_broker_cerrada === false
                  ? t('dispositivos.sesionBrokerNoCerrada')
                  : t('dispositivos.sesionBrokerSinApi')}
            </p>
            <PieDialogo>
              <Button variant="ghost" onClick={a.cerrarDialogo}>{t('comunes.cerrar')}</Button>
            </PieDialogo>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── HU-43/HU-44: confirmar la operación hecha en la consola del broker ── */}
      <Dialog open={dialogo === 'broker'} onOpenChange={alCambiar}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.confirmarBroker')}</DialogTitle>
          <DialogDescription>
            {d?.broker_pendiente
              ? t(`dispositivos.confirmarBrokerDescripcion.${d.broker_pendiente}`, { id: d.id })
              : d?.id}
          </DialogDescription>
          <form onSubmit={(e) => void a.enviarConfirmarBroker(e)} className="mt-4 space-y-3">
            {d?.broker_pendiente_desde && (
              <p className="nums text-[13px] leading-5 text-muted">
                {t('dispositivos.brokerPendienteDesde', { fecha: fechaHora(d.broker_pendiente_desde) })}
              </p>
            )}
            <Campo etiqueta={t('dispositivos.notaBroker')} htmlFor="broker-nota">
              <Input id="broker-nota" value={a.notaBroker} maxLength={500} onChange={(e) => a.setNotaBroker(e.target.value)} />
            </Campo>
            <MensajeFormulario mensaje={a.mensaje} />
            <PieDialogo>
              <Button variant="ghost" onClick={a.cerrarDialogo} disabled={a.enviando}>{t('usuarios.cancelar')}</Button>
              <Button type="submit" disabled={a.enviando}>
                {a.enviando ? t('dispositivos.procesando') : t('dispositivos.confirmarBroker')}
              </Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dar de baja ─────────────────────────────────────────── */}
      <Dialog open={dialogo === 'baja'} onOpenChange={alCambiar}>
        <DialogContent destructivo>
          <DialogTitle>{t('dispositivos.darDeBaja')}</DialogTitle>
          <DialogDescription>{t('dispositivos.confirmarBaja', { id: d?.id ?? '' })}</DialogDescription>
          <form onSubmit={(e) => void a.enviarBaja(e)} className="mt-4 space-y-3">
            <Campo etiqueta={t('dispositivos.motivo')} htmlFor="d-motivo">
              <NativeSelect
                id="d-motivo"
                value={a.formBaja.motivo}
                onChange={(e) => a.setFormBaja({ ...a.formBaja, motivo: e.target.value as MotivoBaja })}
              >
                {MOTIVOS_BAJA.map((motivo) => (
                  <option key={motivo} value={motivo}>
                    {t(`dispositivos.motivos.${motivo}`)}
                  </option>
                ))}
              </NativeSelect>
            </Campo>
            <Campo etiqueta={t('dispositivos.descripcionBaja')} htmlFor="d-descripcion">
              <Textarea
                id="d-descripcion"
                value={a.formBaja.descripcion}
                onChange={(e) => a.setFormBaja({ ...a.formBaja, descripcion: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={t('dispositivos.deviceIdReemplazo')} htmlFor="d-reemplazo">
              <Input
                id="d-reemplazo"
                value={a.formBaja.deviceIdReemplazo}
                onChange={(e) => a.setFormBaja({ ...a.formBaja, deviceIdReemplazo: e.target.value })}
                placeholder={t('dispositivos.deviceIdReemplazoPlaceholder')}
              />
            </Campo>
            <MensajeFormulario mensaje={a.mensaje} />
            <PieDialogo>
              <Button variant="ghost" onClick={a.cerrarDialogo} disabled={a.enviando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" variant="danger" disabled={a.enviando}>
                {a.enviando ? t('dispositivos.procesando') : t('dispositivos.confirmar')}
              </Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── HU-30: calibración ──────────────────────────────────── */}
      <Dialog open={dialogo === 'calibracion'} onOpenChange={alCambiar}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.registrarCalibracion')}</DialogTitle>
          <DialogDescription>{d?.id}</DialogDescription>
          <form onSubmit={(e) => void a.enviarCalibracion(e)} className="mt-4 space-y-3">
            <Campo etiqueta={t('dispositivos.fechaCalibracion')} htmlFor="c-fecha">
              <SelectorFecha
                id="c-fecha"
                valor={a.formCalibracion.fecha}
                invalido={a.fechaCalibracionInvalida}
                onCambiar={(fecha) => {
                  a.setFormCalibracion((previo) => ({ ...previo, fecha }))
                  if (fecha) a.setFechaCalibracionInvalida(false)
                }}
              />
            </Campo>
            <Campo etiqueta={t('dispositivos.numeroCertificado')} htmlFor="c-certificado">
              <Input
                id="c-certificado"
                value={a.formCalibracion.certificado}
                onChange={(e) => a.setFormCalibracion({ ...a.formCalibracion, certificado: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta={t('dispositivos.mesesVigencia')} htmlFor="c-vigencia" ayuda={t('dispositivos.mesesVigenciaAyuda')}>
              <Input
                id="c-vigencia"
                type="number"
                min={1}
                max={60}
                value={a.formCalibracion.mesesVigencia}
                onChange={(e) => a.setFormCalibracion({ ...a.formCalibracion, mesesVigencia: e.target.value })}
                aria-describedby="c-vigencia-ayuda"
                required
              />
            </Campo>
            <Campo etiqueta={t('dispositivos.observaciones')} htmlFor="c-observaciones">
              <Textarea
                id="c-observaciones"
                value={a.formCalibracion.observaciones}
                onChange={(e) => a.setFormCalibracion({ ...a.formCalibracion, observaciones: e.target.value })}
              />
            </Campo>
            <MensajeFormulario mensaje={a.mensaje} />
            <PieDialogo>
              <Button variant="ghost" onClick={a.cerrarDialogo} disabled={a.enviando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={a.enviando}>
                {a.enviando ? t('dispositivos.procesando') : t('comunes.guardar')}
              </Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── HU-51: ubicación e instalación ──────────────────────── */}
      <Dialog open={dialogo === 'instalacion'} onOpenChange={alCambiar}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.editarInstalacion')}</DialogTitle>
          <DialogDescription>{d?.id}</DialogDescription>
          <form onSubmit={(e) => void a.enviarInstalacion(e)} className="mt-4 space-y-3">
            <Campo etiqueta={t('dispositivos.ubicacion')} htmlFor="i-ubicacion">
              <Input
                id="i-ubicacion"
                value={a.formInstalacion.ubicacion}
                onChange={(e) => a.setFormInstalacion({ ...a.formInstalacion, ubicacion: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={t('dispositivos.fechaInstalacion')} htmlFor="i-fecha">
              <SelectorFecha
                id="i-fecha"
                valor={a.formInstalacion.fecha}
                onCambiar={(fecha) => a.setFormInstalacion((previo) => ({ ...previo, fecha }))}
              />
            </Campo>
            <Campo etiqueta={t('dispositivos.observaciones')} htmlFor="i-observaciones">
              <Textarea
                id="i-observaciones"
                value={a.formInstalacion.observaciones}
                onChange={(e) => a.setFormInstalacion({ ...a.formInstalacion, observaciones: e.target.value })}
              />
            </Campo>
            <p className="text-[13px] leading-5 text-muted">{t('dispositivos.instalacionAviso')}</p>
            <MensajeFormulario mensaje={a.mensaje} />
            <PieDialogo>
              <Button variant="ghost" onClick={a.cerrarDialogo} disabled={a.enviando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={a.enviando}>
                {a.enviando ? t('dispositivos.procesando') : t('comunes.guardar')}
              </Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── HU-53/HU-54: responsable (destinatario de avisos) ──────── */}
      <Dialog open={dialogo === 'responsable'} onOpenChange={alCambiar}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.editarResponsable')}</DialogTitle>
          <DialogDescription>{d?.id}</DialogDescription>
          <form onSubmit={(e) => void a.enviarResponsable(e)} className="mt-4 space-y-3">
            <Campo etiqueta={t('dispositivos.responsableNombre')} htmlFor="r-nombre">
              <Input
                id="r-nombre"
                value={a.formResponsable.nombre}
                onChange={(e) => a.setFormResponsable({ ...a.formResponsable, nombre: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={t('dispositivos.responsableEmail')} htmlFor="r-email">
              <Input
                id="r-email"
                type="email"
                value={a.formResponsable.email}
                onChange={(e) => a.setFormResponsable({ ...a.formResponsable, email: e.target.value })}
              />
            </Campo>
            <Campo etiqueta={t('dispositivos.responsableTelefono')} htmlFor="r-telefono">
              <Input
                id="r-telefono"
                type="tel"
                placeholder="+51999999999"
                value={a.formResponsable.telefono}
                onChange={(e) => a.setFormResponsable({ ...a.formResponsable, telefono: e.target.value })}
              />
            </Campo>
            <p className="text-[13px] leading-5 text-muted">{t('dispositivos.responsableAviso')}</p>
            <MensajeFormulario mensaje={a.mensaje} />
            <PieDialogo>
              <Button variant="ghost" onClick={a.cerrarDialogo} disabled={a.enviando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={a.enviando}>
                {a.enviando ? t('dispositivos.procesando') : t('comunes.guardar')}
              </Button>
            </PieDialogo>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── HU-49: historial auditable ──────────────────────────── */}
      <Dialog open={dialogo === 'historial'} onOpenChange={alCambiar}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.historialConfiguracion')}</DialogTitle>
          <DialogDescription>{d?.id}</DialogDescription>
          <div className="mt-4">
            {a.cargandoHistorial ? (
              <p role="status" className="text-sm text-muted">{t('app.cargando')}</p>
            ) : a.historial.length === 0 ? (
              <p className="text-sm text-muted">{t('dispositivos.sinHistorial')}</p>
            ) : (
              <ol className="divide-y divide-border">
                {a.historial.map((h) => (
                  <li key={h.id} className="py-3 text-[13.5px] leading-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium text-foreground [overflow-wrap:anywhere]">{h.campo}</span>
                      <span className="nums text-xs text-muted">{fechaHora(h.created_at)}</span>
                    </div>
                    <p className="mt-1 text-muted [overflow-wrap:anywhere]">
                      <span className="line-through opacity-70">{h.valor_anterior ?? '—'}</span>
                      {' → '}
                      <span className="font-medium text-foreground">{h.valor_nuevo ?? '—'}</span>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <PieDialogo>
            <Button variant="ghost" onClick={a.cerrarDialogo}>
              {t('comunes.cerrar')}
            </Button>
          </PieDialogo>
        </DialogContent>
      </Dialog>
    </>
  )
}
