import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, HardDrive, History, MapPin, PowerOff, UserRound } from 'lucide-react'

import { useDispositivos } from '@/application/hooks/useDispositivos'
import {
  estadoCalibracion,
  MOTIVOS_BAJA,
  type Dispositivo,
  type HistorialConfiguracion,
  type MotivoBaja,
} from '@/domain/entities/Dispositivo'
import { fechaCorta, fechaHora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { Paginacion } from '../components/Paginacion'
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

const FORM_CALIBRACION_INICIAL = { fecha: '', certificado: '', observaciones: '', mesesVigencia: '12' }
const FORM_INSTALACION_INICIAL = { ubicacion: '', fecha: '', observaciones: '' }
const FORM_RESPONSABLE_INICIAL = { nombre: '', email: '', telefono: '' }

type DialogoActivo = 'baja' | 'calibracion' | 'instalacion' | 'responsable' | 'historial' | null

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
  } = useDispositivos()
  const [pagina, setPagina] = useState(1)
  // Solo se pinta la página visible: estas listas crecen sin techo.
  const visibles = useMemo(() => dispositivos.slice(...rangoPagina(pagina)), [dispositivos, pagina])

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

  const cerrarDialogo = () => {
    setDialogo(null)
    setDispositivoActivo(null)
    setMensaje(null)
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
      mesesVigencia: '12',
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
      Number(formCalibracion.mesesVigencia) || 12,
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
      />

      <div className="animate-rise">
        <Table titulo={t('dispositivos.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('dispositivos.id')}</TableHead>
              <TableHead>{t('dispositivos.conectividad')}</TableHead>
              <TableHead>{t('dispositivos.firmware')}</TableHead>
              <TableHead>{t('dispositivos.calibracion')}</TableHead>
              <TableHead>{t('dispositivos.ubicacion')}</TableHead>
              <TableHead>{t('dispositivos.estado')}</TableHead>
              <TableHead>{t('comunes.acciones')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableEmpty colSpan={7}>{t('app.cargando')}</TableEmpty>
            ) : dispositivos.length === 0 ? (
              <TableEmpty colSpan={7}>
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
                  <TableCell className="font-medium">{dispositivo.id}</TableCell>
                  <TableCell>
                    <Badge variant={dispositivo.estado_conectividad === 'online' ? 'ok' : 'neutral'}>
                      {dispositivo.estado_conectividad === 'online'
                        ? t('dashboard.dispositivoOnline')
                        : t('dashboard.dispositivoOffline')}
                    </Badge>
                  </TableCell>
                  <TableCell className="nums text-[13px] text-muted">
                    {dispositivo.firmware_version}
                  </TableCell>
                  <TableCell>
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
                  <TableCell className="max-w-[16rem] truncate text-[13px] text-muted" title={dispositivo.ubicacion ?? undefined}>
                    {dispositivo.ubicacion ?? '—'}
                  </TableCell>
                  <TableCell>
                    {dispositivo.activo ? (
                      <Badge variant="ok">{t('dispositivos.activo')}</Badge>
                    ) : (
                      <Badge variant="critical">
                        {t('dispositivos.inactivo')}
                        {dispositivo.motivo_baja && (
                          <span className="sr-only"> — {dispositivo.motivo_baja}</span>
                        )}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('dispositivos.calibrarA', { id: dispositivo.id })}
                        onClick={() => abrirCalibracion(dispositivo)}
                      >
                        <CalendarClock />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('dispositivos.editarInstalacionA', { id: dispositivo.id })}
                        onClick={() => abrirInstalacion(dispositivo)}
                      >
                        <MapPin />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('dispositivos.editarResponsableA', { id: dispositivo.id })}
                        onClick={() => abrirResponsable(dispositivo)}
                      >
                        <UserRound />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('dispositivos.verHistorialA', { id: dispositivo.id })}
                        onClick={() => void abrirHistorial(dispositivo)}
                      >
                        <History />
                      </Button>
                      {dispositivo.activo && (
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={t('dispositivos.darDeBajaA', { id: dispositivo.id })}
                          onClick={() => abrirBaja(dispositivo)}
                        >
                          <PowerOff />
                          {t('dispositivos.darDeBaja')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <Paginacion total={dispositivos.length} pagina={pagina} onCambiar={setPagina} />
      </div>

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
              <Label htmlFor="c-vigencia">{t('dispositivos.mesesVigencia')}</Label>
              <Input
                id="c-vigencia"
                type="number"
                min={1}
                max={60}
                value={formCalibracion.mesesVigencia}
                onChange={(e) => setFormCalibracion({ ...formCalibracion, mesesVigencia: e.target.value })}
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
          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
            {cargandoHistorial ? (
              <p className="text-sm text-muted">{t('app.cargando')}</p>
            ) : historial.length === 0 ? (
              <p className="text-sm text-muted">{t('dispositivos.sinHistorial')}</p>
            ) : (
              historial.map((h) => (
                <div key={h.id} className="rounded-(--radius-field) bg-cream-100 px-3 py-2 text-[13px]">
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
