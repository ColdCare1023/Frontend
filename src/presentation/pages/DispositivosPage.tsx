import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Eye, FlaskConical, HardDrive, History, KeyRound, MapPin, Plus, PowerOff, UserRound } from 'lucide-react'

import { useDispositivos } from '@/application/hooks/useDispositivos'
import {
  estadoCalibracion,
  MOTIVOS_BAJA,
  type Dispositivo,
  type HistorialConfiguracion,
  type MotivoBaja,
} from '@/domain/entities/Dispositivo'
import { fechaCorta, fechaHora } from '@/lib/formato'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { Paginacion } from '../components/Paginacion'
import { BadgeConectividad } from '../components/BadgeConectividad'
import { ActionMenu } from '../components/ActionMenu'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input, Label, NativeSelect, Textarea } from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const FORM_BAJA_INICIAL: { motivo: MotivoBaja; descripcion: string; deviceIdReemplazo: string } = {
  motivo: MOTIVOS_BAJA[0],
  descripcion: '',
  deviceIdReemplazo: '',
}

const FORM_CALIBRACION_INICIAL = { fecha: '', certificado: '', validaHasta: '', margenAvisoDias: '30', observaciones: '' }
const FORM_INSTALACION_INICIAL = { ubicacion: '', fecha: '', observaciones: '' }
const FORM_RESPONSABLE_INICIAL = { nombre: '', email: '', telefono: '' }

type DialogoActivo = 'crear' | 'simulacion' | 'baja' | 'calibracion' | 'instalacion' | 'responsable' | 'historial' | 'sensores' | null
type EscenarioIoT = 'sin_datos' | 'buffer_pendiente' | 'buffer_lleno' | 'falla_sensor' | 'recuperar'

export function DispositivosPage() {
  const { t } = useTranslation()
  const {
    dispositivos,
    cargando,
    darDeBaja,
    registrarCalibracion,
    actualizarInstalacion,
    actualizarResponsable,
    obtenerHistorialConfiguracion,
    registrarDispositivo,
    rotarCredencial,
    revocarCredencial,
    simularEscenario,
  } = useDispositivos()
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // Solo se pinta la página visible: estas listas crecen sin techo.
  const visibles = useMemo(() => dispositivos.slice(...rangoPagina(pagina, tamanoPagina)), [dispositivos, pagina, tamanoPagina])

  const [dispositivoActivo, setDispositivoActivo] = useState<Dispositivo | null>(null)
  const [dialogo, setDialogo] = useState<DialogoActivo>(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [formBaja, setFormBaja] = useState(FORM_BAJA_INICIAL)
  const [formCalibracion, setFormCalibracion] = useState(FORM_CALIBRACION_INICIAL)
  const [formInstalacion, setFormInstalacion] = useState(FORM_INSTALACION_INICIAL)
  const [formResponsable, setFormResponsable] = useState(FORM_RESPONSABLE_INICIAL)
  const [historial, setHistorial] = useState<HistorialConfiguracion[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [mensajeFlota, setMensajeFlota] = useState<string | null>(null)
  const [formNuevo, setFormNuevo] = useState({ id: '', nombre: '', ubicacion: '', mc38: false })

  const cerrarDialogo = () => {
    setDialogo(null)
    setDispositivoActivo(null)
    setMensaje(null)
  }

  const enviarNuevoDispositivo = async (event: React.FormEvent) => {
    event.preventDefault()
    setEnviando(true)
    setMensaje(null)
    const resultado = await registrarDispositivo({
      device_id: formNuevo.id.trim().toUpperCase(),
      nombre: formNuevo.nombre.trim(),
      ubicacion: formNuevo.ubicacion.trim(),
      sensores: formNuevo.mc38 ? ['DS18B20', 'SHT31', 'MC-38'] : ['DS18B20', 'SHT31'],
    })
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.equipoRegistrado') })
      setFormNuevo({ id: '', nombre: '', ubicacion: '', mc38: false })
    } else {
      setMensaje({ tipo: 'error', texto: t(resultado === 'duplicado' ? 'dispositivos.codigoDuplicado' : 'comunes.error') })
    }
  }

  const ejecutarEscenario = async (escenario: EscenarioIoT) => {
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await simularEscenario(dispositivoActivo.id, escenario)
    setEnviando(false)
    setMensaje({ tipo: resultado ? 'ok' : 'error', texto: t(resultado ? 'dispositivos.escenarioAplicado' : 'comunes.error') })
  }

  const solicitarRotacion = async (dispositivo: Dispositivo) => {
    const resultado = await rotarCredencial(dispositivo.id)
    setMensajeFlota(t(resultado === 'solicitada' ? 'dispositivos.credencialPendiente' : 'comunes.error'))
  }

  const solicitarRevocacion = async (dispositivo: Dispositivo) => {
    if (!window.confirm(t('dispositivos.confirmarRevocacion', { id: dispositivo.id }))) return
    const resultado = await revocarCredencial(dispositivo.id)
    setMensajeFlota(t(resultado === 'revocada' ? 'dispositivos.credencialRevocada' : 'comunes.error'))
  }

  const abrirBaja = (dispositivo: Dispositivo) => {
    setDispositivoActivo(dispositivo)
    setFormBaja(FORM_BAJA_INICIAL)
    setMensaje(null)
    setDialogo('baja')
  }

  const abrirCalibracion = (dispositivo: Dispositivo) => {
    setDispositivoActivo(dispositivo)
    setFormCalibracion({
      fecha: '',
      certificado: dispositivo.numero_certificado_calibracion ?? '',
      observaciones: dispositivo.observaciones_calibracion ?? '',
      validaHasta: dispositivo.fecha_proxima_calibracion ?? '',
      margenAvisoDias: String(dispositivo.margen_aviso_calibracion_dias ?? 30),
    })
    setMensaje(null)
    setDialogo('calibracion')
  }

  const abrirInstalacion = (dispositivo: Dispositivo) => {
    setDispositivoActivo(dispositivo)
    setFormInstalacion({
      ubicacion: dispositivo.ubicacion ?? '',
      fecha: dispositivo.fecha_instalacion ?? '',
      observaciones: dispositivo.observaciones_instalacion ?? '',
    })
    setMensaje(null)
    setDialogo('instalacion')
  }

  const abrirResponsable = (dispositivo: Dispositivo) => {
    setDispositivoActivo(dispositivo)
    setFormResponsable({
      nombre: dispositivo.responsable_nombre ?? '',
      email: dispositivo.responsable_email ?? '',
      telefono: dispositivo.responsable_telefono ?? '',
    })
    setMensaje(null)
    setDialogo('responsable')
  }

  const abrirHistorial = async (dispositivo: Dispositivo) => {
    setDispositivoActivo(dispositivo)
    setDialogo('historial')
    setCargandoHistorial(true)
    try {
      setHistorial(await obtenerHistorialConfiguracion(dispositivo.id))
    } finally {
      setCargandoHistorial(false)
    }
  }

  const enviarBaja = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await darDeBaja(
      dispositivoActivo.id,
      formBaja.motivo,
      formBaja.descripcion,
      formBaja.deviceIdReemplazo,
    )
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.bajaExitosa') })
      setTimeout(cerrarDialogo, 1000)
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const enviarCalibracion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo || !formCalibracion.fecha || !formCalibracion.certificado) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await registrarCalibracion(
      dispositivoActivo.id,
      formCalibracion.fecha,
      formCalibracion.certificado,
      formCalibracion.observaciones,
      formCalibracion.validaHasta,
      Number(formCalibracion.margenAvisoDias) || 30,
    )
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.calibracionGuardada') })
      setTimeout(cerrarDialogo, 1000)
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const enviarInstalacion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await actualizarInstalacion(
      dispositivoActivo.id,
      formInstalacion.ubicacion,
      formInstalacion.fecha,
      formInstalacion.observaciones,
    )
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.instalacionGuardada') })
      setTimeout(cerrarDialogo, 1000)
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const enviarResponsable = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await actualizarResponsable(
      dispositivoActivo.id,
      formResponsable.nombre,
      formResponsable.email,
      formResponsable.telefono,
    )
    setEnviando(false)
    if (resultado === 'ok') {
      setMensaje({ tipo: 'ok', texto: t('dispositivos.responsableGuardado') })
      setTimeout(cerrarDialogo, 1000)
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.seccionAdministracion')}
        titulo={t('dispositivos.titulo')}
        descripcion={t('dispositivos.descripcion')}
      >
        <Button onClick={() => {
          setFormNuevo({ id: '', nombre: '', ubicacion: '', mc38: false })
          setMensaje(null)
          setDialogo('crear')
        }}>
          <Plus />
          {t('dispositivos.nuevoEquipo')}
        </Button>
      </PageHeader>

      {mensajeFlota && (
        <p role="status" className="mb-4 rounded-xl border border-[#BCEFFF] bg-[#E6FBFF] px-4 py-3 text-sm text-[#07546A]">
          {mensajeFlota}
        </p>
      )}

      <section aria-label={t('dispositivos.resumenIoT')} className="mb-6 grid grid-cols-2 divide-x divide-border border-y border-border bg-surface/60 lg:grid-cols-4">
        {[
          { clave: 'dispositivos.equiposRegistrados', valor: dispositivos.length, color: 'text-foreground' },
          { clave: 'dispositivos.sinDatos', valor: dispositivos.filter((d) => d.estado_operativo === 'SIN_DATOS').length, color: 'text-clay-700' },
          { clave: 'dispositivos.fallasSensor', valor: dispositivos.filter((d) => d.estado_operativo === 'FALLA_SENSOR').length, color: 'text-clay-700' },
          { clave: 'dispositivos.bufferPendiente', valor: dispositivos.reduce((total, d) => total + (d.buffer_littlefs?.pendientes ?? 0), 0), color: 'text-glacier-700' },
        ].map((resumen) => (
          <div key={resumen.clave} className="min-w-0 px-4 py-3 sm:px-5">
            <p className="text-xs font-medium leading-5 text-muted">{t(resumen.clave)}</p>
            <p className={`nums mt-1 text-2xl font-semibold ${resumen.valor === 0 ? 'text-foreground' : resumen.color}`}>{resumen.valor}</p>
          </div>
        ))}
      </section>

      <div className="animate-rise [&_thead]:bg-background/60 [&_tbody_td]:align-middle [&_tbody_td]:py-3">
        <Table mobileLayout="stack" className="table-fixed min-w-[820px]" titulo={t('dispositivos.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">{t('dispositivos.id')}</TableHead>
              <TableHead className="w-[23%]">{t('dispositivos.conectividad')}</TableHead>
              <TableHead className="w-[26%]">{t('dispositivos.sensores')}</TableHead>
              <TableHead className="w-[12%]">{t('dispositivos.calibracion')}</TableHead>
              <TableHead className="w-[14%]">{t('comunes.acciones')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableEmpty colSpan={5}>{t('app.cargando')}</TableEmpty>
            ) : dispositivos.length === 0 ? (
              <TableEmpty colSpan={5}>
                <span className="inline-flex flex-col items-center gap-2">
                  <HardDrive className="size-5 text-faint" />
                  {t('dispositivos.sinDispositivos')}
                </span>
              </TableEmpty>
            ) : (
              visibles.map((dispositivo) => {
                const calibracion = estadoCalibracion(dispositivo)
                return (
                <TableRow key={dispositivo.id}>
                  <TableCell data-label={t('dispositivos.id')} className="mobile-full min-w-48">
                    <p className="font-semibold text-foreground">{dispositivo.id}</p>
                    <p className="mt-1 max-w-72 break-words text-xs leading-5 text-muted">{dispositivo.ubicacion ?? '—'}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <span aria-hidden className={`size-1.5 rounded-full ${dispositivo.activo ? 'bg-success-600' : 'bg-faint'}`} />
                      {dispositivo.activo ? t('dispositivos.activo') : t('dispositivos.inactivo')}
                      {!dispositivo.activo && dispositivo.motivo_baja && <span className="sr-only"> — {dispositivo.motivo_baja}</span>}
                    </p>
                  </TableCell>
                  <TableCell data-label={t('dispositivos.conectividad')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgeConectividad
                        estado={dispositivo.estado_conectividad}
                        desde={dispositivo.conectividad_cambiada_en}
                      />
                      {dispositivo.estado_operativo && dispositivo.estado_operativo !== 'OPERATIVO' && (
                        <Badge variant="critical">{t(`dispositivos.estadoOperativo.${dispositivo.estado_operativo}`)}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell data-label={t('dispositivos.sensores')} className="mobile-full">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto min-h-11 max-w-full justify-start gap-2 whitespace-normal px-2 text-left sm:min-h-9"
                      onClick={() => { setDispositivoActivo(dispositivo); setDialogo('sensores') }}
                      aria-label={`${(dispositivo.sensores ?? []).length} sensores. ${t('dispositivos.verMapaIoT')} — ${dispositivo.id}`}
                    >
                      <HardDrive className="size-4 shrink-0" />
                      <span className="shrink-0 font-semibold">{(dispositivo.sensores ?? []).length} sensores</span>
                      <span className="min-w-0 truncate text-xs font-normal text-muted">{(dispositivo.sensores ?? []).map((sensor) => sensor.modelo).join(' · ')}</span>
                      <Eye className="ml-auto size-4 shrink-0 text-muted" aria-hidden />
                    </Button>
                  </TableCell>
                  <TableCell data-label={t('dispositivos.calibracion')} className="max-sm:col-start-2 max-sm:row-start-2 text-center">
                    <Badge
                      variant={
                        calibracion === 'vigente'
                          ? 'ok'
                          : calibracion === 'sin_registrar'
                            ? 'neutral'
                            : 'critical'
                      }
                      title={
                        dispositivo.fecha_proxima_calibracion
                          ? t('dispositivos.calibracionVence', {
                              fecha: fechaCorta(dispositivo.fecha_proxima_calibracion),
                            })
                          : undefined
                      }
                    >
                      {t(`dispositivos.calibracionEstado.${calibracion}`)}
                    </Badge>
                  </TableCell>
                  <TableCell data-label={t('comunes.acciones')} className="mobile-full mobile-actions text-center">
                    <ActionMenu label={dispositivo.id}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirCalibracion(dispositivo)}
                      >
                        <CalendarClock />
                        {t('dispositivos.registrarCalibracion')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirInstalacion(dispositivo)}
                      >
                        <MapPin />
                        {t('dispositivos.editarInstalacion')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirResponsable(dispositivo)}
                      >
                        <UserRound />
                        {t('dispositivos.editarResponsable')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void abrirHistorial(dispositivo)}
                      >
                        <History />
                        {t('dispositivos.historialConfiguracion')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={t('dispositivos.rotarCredencial')}
                        disabled={!dispositivo.activo}
                        onClick={() => void solicitarRotacion(dispositivo)}
                      >
                        <KeyRound />
                        {t('dispositivos.rotarCredencial')}
                      </Button>
                      {dispositivo.estado_credencial_broker !== 'revocada' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title={t('dispositivos.revocarCredencial')}
                          onClick={() => void solicitarRevocacion(dispositivo)}
                        >
                          <PowerOff />
                          {t('dispositivos.revocarCredencial')}
                        </Button>
                      )}
                      {MODO_DEMO && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setDispositivoActivo(dispositivo); setMensaje(null); setDialogo('simulacion') }}
                        >
                          <FlaskConical />
                          {t('dispositivos.probarIoT')}
                        </Button>
                      )}
                      {dispositivo.activo && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => abrirBaja(dispositivo)}
                        >
                          <PowerOff />
                          {t('dispositivos.darDeBaja')}
                        </Button>
                      )}
                    </ActionMenu>
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <Paginacion total={dispositivos.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
      </div>

      <Dialog open={dialogo === 'sensores'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{t('dispositivos.sensores')}</DialogTitle>
          <DialogDescription>{dispositivoActivo?.id} · {dispositivoActivo?.ubicacion ?? '—'}</DialogDescription>
          {dispositivoActivo && (
            <div className="mt-5 space-y-4">
              <section aria-label={t('dispositivos.sensores')} className="grid gap-2 sm:grid-cols-2">
                {(dispositivoActivo.sensores ?? []).map((sensor) => (
                  <article key={sensor.modelo} className="rounded-lg border border-border bg-cream-100/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 font-semibold">
                        <span aria-hidden className={`size-2 rounded-full ${sensor.estado === 'error' ? 'bg-accent' : sensor.estado === 'ok' ? 'bg-success-600' : 'bg-faint'}`} />
                        {sensor.modelo}
                      </p>
                      <Badge variant={sensor.estado === 'ok' ? 'ok' : sensor.estado === 'error' ? 'critical' : 'neutral'}>
                        {t(`dispositivos.sensorEstado.${sensor.estado}`)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted">{sensor.campo_telemetria}</p>
                  </article>
                ))}
              </section>
              <dl className="grid gap-x-5 rounded-lg border border-border p-3 text-[13px] sm:grid-cols-2">
                <div className="flex justify-between gap-3 border-b border-border py-2"><dt className="text-muted">{t('dispositivos.firmware')}</dt><dd className="font-medium">{dispositivoActivo.firmware_version ?? '—'}</dd></div>
                <div className="flex justify-between gap-3 border-b border-border py-2"><dt className="text-muted">{t('dispositivos.intervaloReporte')}</dt><dd className="font-medium">{t('dispositivos.reporteCada', { s: dispositivoActivo.intervalo_reporte_segundos ?? 30 })}</dd></div>
                <div className="flex justify-between gap-3 border-b border-border py-2"><dt className="text-muted">Buffer local</dt><dd className="font-medium">{dispositivoActivo.buffer_littlefs?.pendientes ?? 0} / {dispositivoActivo.buffer_littlefs?.limite ?? 128} · {t('dispositivos.perdidas', { n: dispositivoActivo.buffer_littlefs?.perdidas ?? 0 })}</dd></div>
                <div className="flex justify-between gap-3 border-b border-border py-2"><dt className="text-muted">{t('dispositivos.credencialEstado')}</dt><dd className="font-medium">{t(`dispositivos.credencial.${dispositivoActivo.estado_credencial_broker ?? 'sin_reportar'}`)}</dd></div>
                <div className="flex justify-between gap-3 border-b border-border py-2"><dt className="text-muted">{t('dispositivos.ultimoReporte')}</dt><dd className="text-right font-medium">{dispositivoActivo.ultimo_reporte_en ? fechaHora(dispositivoActivo.ultimo_reporte_en) : '—'}</dd></div>
                {dispositivoActivo.buffer_littlefs?.desde && <div className="flex justify-between gap-3 border-b border-border py-2"><dt className="text-muted">Periodo en cola</dt><dd className="text-right font-medium">{fechaHora(dispositivoActivo.buffer_littlefs.desde)} – {dispositivoActivo.buffer_littlefs.hasta ? fechaHora(dispositivoActivo.buffer_littlefs.hasta) : '—'}</dd></div>}
                {dispositivoActivo.ultimo_evento && <div className="py-2 sm:col-span-2"><dt className="text-muted">Telemetría</dt><dd className="mt-1 break-all font-mono text-xs">schema {dispositivoActivo.ultimo_evento.schema_version} · boot_id {dispositivoActivo.ultimo_evento.boot_id} · seq_no {dispositivoActivo.ultimo_evento.seq_no} · {dispositivoActivo.ultimo_evento.time_quality}</dd></div>}
              </dl>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={cerrarDialogo}>{t('comunes.cerrar')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === 'crear'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.nuevoEquipo')}</DialogTitle>
          <DialogDescription>{t('dispositivos.registroAyuda')}</DialogDescription>
          <form onSubmit={(e) => void enviarNuevoDispositivo(e)} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="nuevo-device-id">{t('dispositivos.id')}</Label>
              <Input id="nuevo-device-id" value={formNuevo.id} onChange={(e) => setFormNuevo({ ...formNuevo, id: e.target.value.toUpperCase() })} placeholder="FARM-03-CDL" pattern="[A-Z0-9][A-Z0-9-]{2,39}" required />
              <p className="mt-1 text-xs text-muted">{t('dispositivos.codigoUnicoAyuda')}</p>
            </div>
            <div>
              <Label htmlFor="nuevo-device-nombre">{t('dispositivos.nombreEquipo')}</Label>
              <Input id="nuevo-device-nombre" value={formNuevo.nombre} onChange={(e) => setFormNuevo({ ...formNuevo, nombre: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="nuevo-device-ubicacion">{t('dispositivos.ubicacion')}</Label>
              <Input id="nuevo-device-ubicacion" value={formNuevo.ubicacion} onChange={(e) => setFormNuevo({ ...formNuevo, ubicacion: e.target.value })} required />
            </div>
            <fieldset className="rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-medium">{t('dispositivos.sensores')}</legend>
              <p className="text-xs text-muted">DS18B20 · SHT31</p>
              <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={formNuevo.mc38} onChange={(e) => setFormNuevo({ ...formNuevo, mc38: e.target.checked })} />
                MC-38 · {t('dispositivos.opcional')}
              </label>
            </fieldset>
            <MensajeFormulario mensaje={mensaje} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={cerrarDialogo} disabled={enviando}>{t('usuarios.cancelar')}</Button>
              <Button type="submit" disabled={enviando}>{enviando ? t('dispositivos.procesando') : t('dispositivos.registrarEquipo')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={MODO_DEMO && dialogo === 'simulacion'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.probarIoT')}</DialogTitle>
          <DialogDescription>{t('dispositivos.simulacionSoloDemo', { id: dispositivoActivo?.id ?? '' })}</DialogDescription>
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
                variant={escenario === 'recuperar' ? 'secondary' : 'primary'}
                className="h-auto min-h-11 w-full min-w-0 justify-start px-3 py-2 text-left"
                disabled={enviando}
                onClick={() => void ejecutarEscenario(escenario)}
              >
                {escenario === 'recuperar' ? <KeyRound /> : <FlaskConical />}
                <span className="min-w-0 whitespace-normal break-words leading-snug">{t(clave)}</span>
              </Button>
            ))}
          </div>
          <MensajeFormulario mensaje={mensaje} />
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" onClick={cerrarDialogo}>{t('comunes.cerrar')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dar de baja ─────────────────────────────────────────── */}
      <Dialog open={dialogo === 'baja'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent destructivo>
          <DialogTitle>{t('dispositivos.darDeBaja')}</DialogTitle>
          <DialogDescription>
            {t('dispositivos.confirmarBaja', { id: dispositivoActivo?.id ?? '' })}
          </DialogDescription>
          <form onSubmit={(e) => void enviarBaja(e)} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="d-motivo">{t('dispositivos.motivo')}</Label>
              <NativeSelect
                id="d-motivo"
                value={formBaja.motivo}
                onChange={(e) => setFormBaja({ ...formBaja, motivo: e.target.value as MotivoBaja })}
              >
                {MOTIVOS_BAJA.map((motivo) => (
                  <option key={motivo} value={motivo}>
                    {t(`dispositivos.motivos.${motivo}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="d-descripcion">{t('dispositivos.descripcionBaja')}</Label>
              <Textarea
                id="d-descripcion"
                value={formBaja.descripcion}
                onChange={(e) => setFormBaja({ ...formBaja, descripcion: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="d-reemplazo">{t('dispositivos.deviceIdReemplazo')}</Label>
              <Input
                id="d-reemplazo"
                value={formBaja.deviceIdReemplazo}
                onChange={(e) => setFormBaja({ ...formBaja, deviceIdReemplazo: e.target.value })}
                placeholder={t('dispositivos.deviceIdReemplazoPlaceholder')}
              />
            </div>
            <MensajeFormulario mensaje={mensaje} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={cerrarDialogo} disabled={enviando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" variant="danger" disabled={enviando}>
                {enviando ? t('dispositivos.procesando') : t('dispositivos.confirmar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── HU-30: calibración ──────────────────────────────────── */}
      <Dialog open={dialogo === 'calibracion'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.registrarCalibracion')}</DialogTitle>
          <DialogDescription>{dispositivoActivo?.id}</DialogDescription>
          <form onSubmit={(e) => void enviarCalibracion(e)} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="c-fecha">{t('dispositivos.fechaCalibracion')}</Label>
              <Input
                id="c-fecha"
                type="date"
                value={formCalibracion.fecha}
                onChange={(e) => setFormCalibracion({ ...formCalibracion, fecha: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="c-certificado">{t('dispositivos.numeroCertificado')}</Label>
              <Input
                id="c-certificado"
                value={formCalibracion.certificado}
                onChange={(e) => setFormCalibracion({ ...formCalibracion, certificado: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="c-vigencia">{t('dispositivos.validaHasta')}</Label>
              <Input
                id="c-vigencia"
                type="date"
                value={formCalibracion.validaHasta}
                onChange={(e) => setFormCalibracion({ ...formCalibracion, validaHasta: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="c-margen">{t('dispositivos.margenAviso')}</Label>
              <Input
                id="c-margen"
                type="number"
                min={0}
                max={365}
                value={formCalibracion.margenAvisoDias}
                onChange={(e) => setFormCalibracion({ ...formCalibracion, margenAvisoDias: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="c-observaciones">{t('dispositivos.observaciones')}</Label>
              <Textarea
                id="c-observaciones"
                value={formCalibracion.observaciones}
                onChange={(e) => setFormCalibracion({ ...formCalibracion, observaciones: e.target.value })}
              />
            </div>
            <MensajeFormulario mensaje={mensaje} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={cerrarDialogo} disabled={enviando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? t('dispositivos.procesando') : t('comunes.guardar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── HU-51: ubicación e instalación ──────────────────────── */}
      <Dialog open={dialogo === 'instalacion'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.editarInstalacion')}</DialogTitle>
          <DialogDescription>{dispositivoActivo?.id}</DialogDescription>
          <form onSubmit={(e) => void enviarInstalacion(e)} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="i-ubicacion">{t('dispositivos.ubicacion')}</Label>
              <Input
                id="i-ubicacion"
                value={formInstalacion.ubicacion}
                onChange={(e) => setFormInstalacion({ ...formInstalacion, ubicacion: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="i-fecha">{t('dispositivos.fechaInstalacion')}</Label>
              <Input
                id="i-fecha"
                type="date"
                value={formInstalacion.fecha}
                onChange={(e) => setFormInstalacion({ ...formInstalacion, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="i-observaciones">{t('dispositivos.observaciones')}</Label>
              <Textarea
                id="i-observaciones"
                value={formInstalacion.observaciones}
                onChange={(e) => setFormInstalacion({ ...formInstalacion, observaciones: e.target.value })}
              />
            </div>
            <p className="text-xs text-faint">{t('dispositivos.instalacionAviso')}</p>
            <MensajeFormulario mensaje={mensaje} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={cerrarDialogo} disabled={enviando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? t('dispositivos.procesando') : t('comunes.guardar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── HU-53/HU-54: responsable (destinatario de avisos) ──────── */}
      <Dialog open={dialogo === 'responsable'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.editarResponsable')}</DialogTitle>
          <DialogDescription>{dispositivoActivo?.id}</DialogDescription>
          <form onSubmit={(e) => void enviarResponsable(e)} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="r-nombre">{t('dispositivos.responsableNombre')}</Label>
              <Input
                id="r-nombre"
                value={formResponsable.nombre}
                onChange={(e) => setFormResponsable({ ...formResponsable, nombre: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="r-email">{t('dispositivos.responsableEmail')}</Label>
              <Input
                id="r-email"
                type="email"
                value={formResponsable.email}
                onChange={(e) => setFormResponsable({ ...formResponsable, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="r-telefono">{t('dispositivos.responsableTelefono')}</Label>
              <Input
                id="r-telefono"
                type="tel"
                placeholder="+51999999999"
                value={formResponsable.telefono}
                onChange={(e) => setFormResponsable({ ...formResponsable, telefono: e.target.value })}
              />
            </div>
            <p className="text-xs text-faint">{t('dispositivos.responsableAviso')}</p>
            <MensajeFormulario mensaje={mensaje} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={cerrarDialogo} disabled={enviando}>
                {t('usuarios.cancelar')}
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? t('dispositivos.procesando') : t('comunes.guardar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── HU-49: historial auditable ──────────────────────────── */}
      <Dialog open={dialogo === 'historial'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.historialConfiguracion')}</DialogTitle>
          <DialogDescription>{dispositivoActivo?.id}</DialogDescription>
          <div className="mt-5 max-h-96 divide-y divide-border overflow-y-auto">
            {cargandoHistorial ? (
              <p className="text-sm text-muted">{t('app.cargando')}</p>
            ) : historial.length === 0 ? (
              <p className="text-sm text-muted">{t('dispositivos.sinHistorial')}</p>
            ) : (
              historial.map((h) => (
                <div key={h.id} className="border-l-2 border-primary/20 py-4 pl-4 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{h.campo}</span>
                    <span className="nums text-xs text-faint">{fechaHora(h.created_at)}</span>
                  </div>
                  <p className="mt-1 text-muted">
                    <span className="line-through opacity-70">{h.valor_anterior ?? '—'}</span>
                    {' → '}
                    <span className="font-medium text-foreground">{h.valor_nuevo ?? '—'}</span>
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={cerrarDialogo}>
              {t('comunes.cerrar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MensajeFormulario({ mensaje }: { mensaje: { tipo: 'ok' | 'error'; texto: string } | null }) {
  if (!mensaje) return null
  return (
    <p
      role={mensaje.tipo === 'error' ? 'alert' : 'status'}
      className={
        mensaje.tipo === 'ok'
          ? 'rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700'
          : 'rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700'
      }
    >
      {mensaje.texto}
    </p>
  )
}
