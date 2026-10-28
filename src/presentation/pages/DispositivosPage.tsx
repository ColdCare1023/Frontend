import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  CircleCheck,
  FlaskConical,
  HardDrive,
  History,
  KeyRound,
  MapPin,
  Plus,
  PowerOff,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  UserRound,
} from 'lucide-react'

import { useDispositivos } from '@/application/hooks/useDispositivos'
import {
  CAPACIDAD_BUFFER_LITTLEFS,
  estadoCalibracion,
  estadoCredencial,
  MOTIVOS_BAJA,
  PATRON_DEVICE_ID,
  type CausaRotacion,
  type CredencialRotada,
  type Dispositivo,
  type EstadoCalibracion,
  type HistorialConfiguracion,
  type MotivoBaja,
} from '@/domain/entities/Dispositivo'
import { fechaCorta, fechaHora } from '@/lib/formato'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { Paginacion } from '../components/Paginacion'
import { BadgeConectividad } from '../components/BadgeConectividad'
import { ActionMenu } from '../components/ActionMenu'
import { EstadoCarga, EstadoVacio } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input, Label, NativeSelect, Textarea } from '../components/ui/input'
import { SelectorFecha } from '../components/ui/selector-fecha'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const FORM_BAJA_INICIAL: { motivo: MotivoBaja; descripcion: string; deviceIdReemplazo: string } = {
  motivo: MOTIVOS_BAJA[0],
  descripcion: '',
  deviceIdReemplazo: '',
}

// B-12: el backend calcula la próxima calibración con la vigencia en meses.
const FORM_CALIBRACION_INICIAL = { fecha: '', certificado: '', mesesVigencia: '12', observaciones: '' }
const FORM_INSTALACION_INICIAL = { ubicacion: '', fecha: '', observaciones: '' }
const FORM_RESPONSABLE_INICIAL = { nombre: '', email: '', telefono: '' }

// «Por vencer» avisa (ámbar); solo la calibración vencida es crítica.
const VARIANTE_CALIBRACION: Record<EstadoCalibracion, 'ok' | 'warn' | 'critical' | 'neutral'> = {
  vigente: 'ok',
  proxima_a_vencer: 'warn',
  vencida: 'critical',
  sin_registrar: 'neutral',
}

type DialogoActivo =
  | 'crear' | 'simulacion' | 'baja' | 'calibracion' | 'instalacion' | 'responsable' | 'historial' | 'sensores'
  | 'rotar' | 'revocar' | 'token' | 'broker'
  | null
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
    confirmarBroker,
    reenviarDesafio,
    simularEscenario,
  } = useDispositivos()
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // Solo se pinta la página visible: estas listas crecen sin techo.
  const visibles = useMemo(() => dispositivos.slice(...rangoPagina(pagina, tamanoPagina)), [dispositivos, pagina, tamanoPagina])
  const resumen = useMemo(
    () => [
      { clave: 'dispositivos.equiposRegistrados', valor: dispositivos.length, problema: false },
      { clave: 'dispositivos.sinDatos', valor: dispositivos.filter((d) => d.estado_operativo === 'SIN_DATOS').length, problema: true },
      { clave: 'dispositivos.fallasSensor', valor: dispositivos.filter((d) => d.estado_operativo === 'FALLA_SENSOR').length, problema: true },
      { clave: 'dispositivos.bufferPendiente', valor: dispositivos.reduce((total, d) => total + (d.buffer_littlefs?.pendientes ?? 0), 0), problema: false },
    ],
    [dispositivos],
  )

  const [dispositivoActivo, setDispositivoActivo] = useState<Dispositivo | null>(null)
  const [dialogo, setDialogo] = useState<DialogoActivo>(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [formBaja, setFormBaja] = useState(FORM_BAJA_INICIAL)
  const [formCalibracion, setFormCalibracion] = useState(FORM_CALIBRACION_INICIAL)
  // El selector de fecha no tiene `required` nativo: la fecha vacía se marca aquí.
  const [fechaCalibracionInvalida, setFechaCalibracionInvalida] = useState(false)
  const [formInstalacion, setFormInstalacion] = useState(FORM_INSTALACION_INICIAL)
  const [formResponsable, setFormResponsable] = useState(FORM_RESPONSABLE_INICIAL)
  const [historial, setHistorial] = useState<HistorialConfiguracion[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [mensajeFlota, setMensajeFlota] = useState<string | null>(null)
  const [formNuevo, setFormNuevo] = useState({ id: '', nombre: '', ubicacion: '', mc38: false })
  const [motivoCredencial, setMotivoCredencial] = useState('')
  const [causaRotacion, setCausaRotacion] = useState<CausaRotacion>('preventiva')
  const [notaBroker, setNotaBroker] = useState('')
  // FE-003: el token rotado vive solo mientras su diálogo está abierto; no se
  // persiste, no se registra y se descarta al cerrar.
  const [credencialRotada, setCredencialRotada] = useState<CredencialRotada | null>(null)
  const [tokenCopiado, setTokenCopiado] = useState(false)

  const cerrarDialogo = () => {
    setDialogo(null)
    setDispositivoActivo(null)
    setMensaje(null)
    setCredencialRotada(null)
    setTokenCopiado(false)
  }

  const enviarNuevoDispositivo = async (event: React.FormEvent) => {
    event.preventDefault()
    const deviceId = formNuevo.id.trim().toUpperCase()
    if (!PATRON_DEVICE_ID.test(deviceId)) {
      setMensaje({ tipo: 'error', texto: t('dispositivos.codigoInvalido') })
      return
    }
    setEnviando(true)
    setMensaje(null)
    const resultado = await registrarDispositivo({
      device_id: deviceId,
      nombre: formNuevo.nombre.trim(),
      ubicacion: formNuevo.ubicacion.trim(),
      sensores: formNuevo.mc38 ? ['DS18B20', 'SHT31', 'MC-38'] : ['DS18B20', 'SHT31'],
    })
    setEnviando(false)
    if (resultado.resultado === 'ok') {
      // HU-43: el alta emitió la credencial; se muestra UNA vez, como en la rotación.
      setFormNuevo({ id: '', nombre: '', ubicacion: '', mc38: false })
      setCredencialRotada(resultado.credencial)
      setMensajeFlota(t('dispositivos.equipoRegistrado'))
      setDialogo('token')
    } else {
      setMensaje({ tipo: 'error', texto: t(resultado.resultado === 'duplicado' ? 'dispositivos.codigoDuplicado' : 'comunes.error') })
    }
  }

  const abrirSensores = (dispositivo: Dispositivo) => {
    setDispositivoActivo(dispositivo)
    setDialogo('sensores')
  }

  const abrirConfirmarBroker = (dispositivo: Dispositivo) => {
    setDispositivoActivo(dispositivo)
    setNotaBroker('')
    setMensaje(null)
    setDialogo('broker')
  }

  const enviarConfirmarBroker = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await confirmarBroker(dispositivoActivo.id, notaBroker.trim())
    setEnviando(false)
    if (resultado === 'ok') {
      cerrarDialogo()
      setMensajeFlota(t('dispositivos.brokerConfirmado'))
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const enviarReenviarDesafio = async (dispositivo: Dispositivo) => {
    // Un doble clic expulsaría la sesión dos veces seguidas.
    if (enviando) return
    setEnviando(true)
    const resultado = await reenviarDesafio(dispositivo.id)
    setEnviando(false)
    setMensajeFlota(t(resultado === 'ok' ? 'dispositivos.desafioReenviado' : 'comunes.error'))
  }

  const ejecutarEscenario = async (escenario: EscenarioIoT) => {
    if (!dispositivoActivo) return
    setEnviando(true)
    setMensaje(null)
    const resultado = await simularEscenario(dispositivoActivo.id, escenario)
    setEnviando(false)
    setMensaje({ tipo: resultado ? 'ok' : 'error', texto: t(resultado ? 'dispositivos.escenarioAplicado' : 'comunes.error') })
  }

  const abrirCredencial = (dispositivo: Dispositivo, accion: 'rotar' | 'revocar') => {
    setDispositivoActivo(dispositivo)
    setMotivoCredencial('')
    setCausaRotacion('preventiva')
    setMensaje(null)
    setDialogo(accion)
  }

  const enviarCredencial = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dispositivoActivo || !motivoCredencial.trim()) return
    setEnviando(true)
    setMensaje(null)
    if (dialogo === 'rotar') {
      const credencial = await rotarCredencial(dispositivoActivo.id, motivoCredencial.trim(), causaRotacion)
      setEnviando(false)
      if (credencial) {
        setCredencialRotada(credencial)
        setDialogo('token')
      } else {
        setMensaje({ tipo: 'error', texto: t('comunes.error') })
      }
      return
    }
    const resultado = await revocarCredencial(dispositivoActivo.id, motivoCredencial.trim())
    setEnviando(false)
    if (resultado === 'revocada') {
      cerrarDialogo()
      setMensajeFlota(t('dispositivos.credencialRevocada'))
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  const copiarToken = async () => {
    if (!credencialRotada) return
    try {
      await navigator.clipboard.writeText(credencialRotada.token)
      setTokenCopiado(true)
    } catch {
      setTokenCopiado(false)
    }
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
    setFechaCalibracionInvalida(false)
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
    if (!dispositivoActivo) return
    if (!formCalibracion.fecha) {
      // Equivale al `required` del campo nativo: se marca y recibe el foco.
      setFechaCalibracionInvalida(true)
      document.getElementById('c-fecha')?.focus()
      return
    }
    if (!formCalibracion.certificado) return
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
        <p role="status" className="mb-4 rounded-(--radius-field) bg-success-100 px-4 py-3 text-sm text-success-700 ring-1 ring-inset ring-success-600/25">
          {mensajeFlota}
        </p>
      )}

      {cargando ? (
        <EstadoCarga />
      ) : dispositivos.length === 0 ? (
        <EstadoVacio icono={HardDrive} titulo={t('dispositivos.sinDispositivos')} />
      ) : (
        <>
          {/* Totales en una línea discreta; la tabla es la protagonista. */}
          <section aria-label={t('dispositivos.resumenIoT')} className="mb-3 px-1">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:flex sm:flex-wrap sm:items-baseline">
              {resumen.map(({ clave, valor, problema }) => (
                <div key={clave} className="flex items-baseline justify-between gap-2 sm:justify-start">
                  <dt className="text-muted">{t(clave)}</dt>
                  <dd className={cn('nums font-semibold', problema && valor > 0 ? 'text-critical' : 'text-foreground')}>{valor}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div>
            <Table mobileLayout="stack" titulo={t('dispositivos.titulo')}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">{t('dispositivos.id')}</TableHead>
                  <TableHead className="w-[38%]">{t('dispositivos.estado')}</TableHead>
                  <TableHead className="w-[14%]">{t('dispositivos.calibracion')}</TableHead>
                  <TableHead className="w-[14%] text-right">{t('comunes.acciones')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((dispositivo) => {
                  const calibracion = estadoCalibracion(dispositivo)
                  return (
                    <TableRow key={dispositivo.id}>
                      <TableCell data-label={t('dispositivos.id')} className="mobile-full">
                        <p className="nums font-semibold text-foreground">{dispositivo.id}</p>
                        <p className="mt-0.5 break-words text-[13px] leading-5 text-muted">{dispositivo.ubicacion ?? '—'}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          <span aria-hidden className={cn('size-1.5 rounded-full', dispositivo.activo ? 'bg-success-600' : 'bg-faint')} />
                          {dispositivo.activo ? t('dispositivos.activo') : t('dispositivos.inactivo')}
                          {!dispositivo.activo && dispositivo.motivo_baja && <span className="sr-only"> — {dispositivo.motivo_baja}</span>}
                        </p>
                      </TableCell>
                      <TableCell data-label={t('dispositivos.estado')} className="mobile-full">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <BadgeConectividad
                            estado={dispositivo.estado_conectividad}
                            desde={dispositivo.conectividad_cambiada_en}
                          />
                          {dispositivo.estado_operativo && dispositivo.estado_operativo !== 'OPERATIVO' && (
                            <Badge variant="critical">{t(`dispositivos.estadoOperativo.${dispositivo.estado_operativo}`)}</Badge>
                          )}
                        </div>
                        {/* Pendientes que piden una acción (consola del broker, prueba de posesión). */}
                        {(dispositivo.broker_pendiente || dispositivo.rotacion_por_compromiso || dispositivo.posesion_pendiente) && (
                          <ul className="mt-2 space-y-1 text-xs font-medium leading-4">
                            {dispositivo.broker_pendiente && (
                              <Aviso
                                tono="warn"
                                title={dispositivo.broker_pendiente_desde
                                  ? t('dispositivos.brokerPendienteDesde', { fecha: fechaHora(dispositivo.broker_pendiente_desde) })
                                  : undefined}
                              >
                                {t(`dispositivos.brokerPendiente.${dispositivo.broker_pendiente}`)}
                              </Aviso>
                            )}
                            {dispositivo.rotacion_por_compromiso && (
                              <Aviso tono="critical" title={t('dispositivos.telemetriaRetenidaAyuda')}>
                                {t('dispositivos.telemetriaRetenida')}
                              </Aviso>
                            )}
                            {dispositivo.posesion_pendiente && (
                              <Aviso tono="warn" title={t('dispositivos.posesionPendienteAyuda')}>
                                {t('dispositivos.posesionPendiente')}
                              </Aviso>
                            )}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell data-label={t('dispositivos.calibracion')}>
                        <Badge
                          variant={VARIANTE_CALIBRACION[calibracion]}
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
                      <TableCell data-label={t('comunes.acciones')} className="mobile-actions text-right">
                        <ActionMenu label={dispositivo.id}>
                          <Button variant="ghost" size="sm" onClick={() => abrirSensores(dispositivo)}>
                            <HardDrive />
                            {t('dispositivos.sensores')}
                          </Button>
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
                            onClick={() => abrirCredencial(dispositivo, 'rotar')}
                          >
                            <KeyRound />
                            {t('dispositivos.rotarCredencial')}
                          </Button>
                          {dispositivo.broker_pendiente && (
                            <Button variant="ghost" size="sm" onClick={() => abrirConfirmarBroker(dispositivo)}>
                              <CircleCheck />
                              {t('dispositivos.confirmarBroker')}
                            </Button>
                          )}
                          {dispositivo.posesion_pendiente && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title={t('dispositivos.reenviarDesafioAyuda')}
                              disabled={enviando}
                              onClick={() => void enviarReenviarDesafio(dispositivo)}
                            >
                              <RefreshCw />
                              {t('dispositivos.reenviarDesafio')}
                            </Button>
                          )}
                          {estadoCredencial(dispositivo) !== 'revocada' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title={t('dispositivos.revocarCredencial')}
                              onClick={() => abrirCredencial(dispositivo, 'revocar')}
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
                })}
              </TableBody>
            </Table>
            <Paginacion total={dispositivos.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
          </div>
        </>
      )}

      {/* Ficha técnica del equipo: sensores a la vista; el resto, plegado. */}
      <Dialog open={dialogo === 'sensores'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{t('dispositivos.sensores')}</DialogTitle>
          <DialogDescription>{dispositivoActivo?.id} · {dispositivoActivo?.ubicacion ?? '—'}</DialogDescription>
          {dispositivoActivo && (
            <div className="mt-5 space-y-3">
              <section aria-label={t('dispositivos.sensores')}>
                <ul className="divide-y divide-border border-y border-border">
                  {(dispositivoActivo.sensores ?? []).map((sensor) => (
                    <li key={sensor.modelo} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-sm font-semibold text-foreground">{sensor.modelo}</span>
                      <Badge variant={sensor.estado === 'ok' ? 'ok' : sensor.estado === 'error' ? 'critical' : 'neutral'}>
                        {t(`dispositivos.sensorEstado.${sensor.estado}`)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
              <dl className="text-[13px]">
                <Dato etiqueta={t('dispositivos.ultimoReporte')}>
                  <span className="nums">{dispositivoActivo.ultimo_reporte_en ? fechaHora(dispositivoActivo.ultimo_reporte_en) : '—'}</span>
                </Dato>
              </dl>
              <Detalles>
                <dl className="grid gap-x-5 text-[13px] sm:grid-cols-2">
                  {(dispositivoActivo.sensores ?? []).map((sensor) => (
                    <Dato key={sensor.modelo} etiqueta={sensor.modelo}>
                      <span className="break-words font-mono text-xs">{sensor.campo_telemetria}</span>
                    </Dato>
                  ))}
                  <Dato etiqueta={t('dispositivos.firmware')}>{dispositivoActivo.firmware_version ?? '—'}</Dato>
                  <Dato etiqueta={t('dispositivos.intervaloReporte')}>
                    {t('dispositivos.reporteCada', { s: dispositivoActivo.intervalo_reporte_segundos ?? 30 })}
                  </Dato>
                  <Dato etiqueta="Buffer local">
                    <span className="nums">
                      {dispositivoActivo.buffer_littlefs?.pendientes ?? 0} / {dispositivoActivo.buffer_littlefs?.limite ?? CAPACIDAD_BUFFER_LITTLEFS} · {t('dispositivos.perdidas', { n: dispositivoActivo.buffer_littlefs?.perdidas ?? 0 })}
                    </span>
                  </Dato>
                  <Dato etiqueta={t('dispositivos.credencialEstado')}>
                    {t(`dispositivos.credencial.${estadoCredencial(dispositivoActivo)}`)}
                  </Dato>
                  {dispositivoActivo.buffer_littlefs?.desde && (
                    <Dato etiqueta="Periodo en cola">
                      <span className="nums">
                        {fechaHora(dispositivoActivo.buffer_littlefs.desde)} – {dispositivoActivo.buffer_littlefs.hasta ? fechaHora(dispositivoActivo.buffer_littlefs.hasta) : '—'}
                      </span>
                    </Dato>
                  )}
                  {dispositivoActivo.ultimo_evento && (
                    <div className="py-2 sm:col-span-2">
                      <dt className="text-muted">Telemetría</dt>
                      <dd className="mt-1 break-all font-mono text-xs">
                        schema {dispositivoActivo.ultimo_evento.schema_version} · boot_id {dispositivoActivo.ultimo_evento.boot_id} · seq_no {dispositivoActivo.ultimo_evento.seq_no} · {dispositivoActivo.ultimo_evento.time_quality}
                      </dd>
                    </div>
                  )}
                </dl>
              </Detalles>
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

      {/* ── FE-003: rotar / revocar credencial MQTT (motivo obligatorio) ── */}
      <Dialog open={dialogo === 'rotar' || dialogo === 'revocar'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent destructivo={dialogo === 'revocar'}>
          <DialogTitle>
            {t(dialogo === 'revocar' ? 'dispositivos.revocarCredencial' : 'dispositivos.rotarCredencial')}
          </DialogTitle>
          <DialogDescription>
            {t(
              dialogo === 'revocar' ? 'dispositivos.revocarCredencialDescripcion' : 'dispositivos.rotarCredencialDescripcion',
              { id: dispositivoActivo?.id ?? '' },
            )}
          </DialogDescription>
          <form onSubmit={(e) => void enviarCredencial(e)} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="credencial-motivo">{t('dispositivos.motivoCredencial')}</Label>
              <Input
                id="credencial-motivo"
                value={motivoCredencial}
                maxLength={200}
                required
                aria-describedby="credencial-motivo-ayuda"
                onChange={(e) => setMotivoCredencial(e.target.value)}
              />
              <p id="credencial-motivo-ayuda" className="mt-1 text-xs text-muted">{t('dispositivos.motivoCredencialAyuda')}</p>
            </div>
            {dialogo === 'rotar' && (
              <div>
                <Label htmlFor="credencial-causa">{t('dispositivos.causaRotacion')}</Label>
                <NativeSelect
                  id="credencial-causa"
                  value={causaRotacion}
                  aria-describedby="credencial-causa-ayuda"
                  onChange={(e) => setCausaRotacion(e.target.value as CausaRotacion)}
                >
                  <option value="preventiva">{t('dispositivos.causasRotacion.preventiva')}</option>
                  <option value="compromiso">{t('dispositivos.causasRotacion.compromiso')}</option>
                </NativeSelect>
                <p id="credencial-causa-ayuda" className="mt-1 text-xs text-muted">
                  {t(`dispositivos.causaRotacionAyuda.${causaRotacion}`)}
                </p>
              </div>
            )}
            <MensajeFormulario mensaje={mensaje} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={cerrarDialogo} disabled={enviando}>{t('usuarios.cancelar')}</Button>
              <Button type="submit" variant={dialogo === 'revocar' ? 'danger' : 'primary'} disabled={enviando || !motivoCredencial.trim()}>
                {enviando
                  ? t('dispositivos.procesando')
                  : t(dialogo === 'revocar' ? 'dispositivos.revocarCredencial' : 'dispositivos.rotarCredencial')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* FE-003: el token rotado se muestra UNA vez y se descarta al cerrar. */}
      <Dialog open={dialogo === 'token' && credencialRotada !== null} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.tokenTitulo')}</DialogTitle>
          <DialogDescription>{t('dispositivos.tokenAdvertencia')}</DialogDescription>
          <div className="mt-4 space-y-3">
            <code
              data-testid="token-rotado"
              className="block break-all rounded-(--radius-field) border border-border bg-secondary-tint px-3 py-2 font-mono text-sm select-all"
            >
              {credencialRotada?.token}
            </code>
            {credencialRotada?.mensaje_broker && (
              <p role="alert" className="rounded-(--radius-field) bg-honey-100 px-3 py-2 text-[13px] text-honey-700">
                {credencialRotada.mensaje_broker}
              </p>
            )}
            <p role="status" className="text-xs text-muted">
              {t('dispositivos.credencialRotada')}{' '}
              {credencialRotada?.sesion_broker_cerrada === true
                ? t('dispositivos.sesionBrokerCerrada')
                : credencialRotada?.sesion_broker_cerrada === false
                  ? t('dispositivos.sesionBrokerNoCerrada')
                  : t('dispositivos.sesionBrokerSinApi')}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => void copiarToken()}>
                <KeyRound />
                {t(tokenCopiado ? 'dispositivos.tokenCopiado' : 'dispositivos.copiarToken')}
              </Button>
              <Button variant="ghost" onClick={cerrarDialogo}>{t('comunes.cerrar')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── HU-43/HU-44: confirmar la operación hecha en la consola del broker ── */}
      <Dialog open={dialogo === 'broker'} onOpenChange={(abierto) => !abierto && cerrarDialogo()}>
        <DialogContent>
          <DialogTitle>{t('dispositivos.confirmarBroker')}</DialogTitle>
          <DialogDescription>
            {dispositivoActivo?.broker_pendiente
              ? t(`dispositivos.confirmarBrokerDescripcion.${dispositivoActivo.broker_pendiente}`, { id: dispositivoActivo.id })
              : dispositivoActivo?.id}
          </DialogDescription>
          <form onSubmit={(e) => void enviarConfirmarBroker(e)} className="mt-4 space-y-3">
            {dispositivoActivo?.broker_pendiente_desde && (
              <p className="text-xs text-muted">
                {t('dispositivos.brokerPendienteDesde', { fecha: fechaHora(dispositivoActivo.broker_pendiente_desde) })}
              </p>
            )}
            <div>
              <Label htmlFor="broker-nota">{t('dispositivos.notaBroker')}</Label>
              <Input id="broker-nota" value={notaBroker} maxLength={500} onChange={(e) => setNotaBroker(e.target.value)} />
            </div>
            <MensajeFormulario mensaje={mensaje} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={cerrarDialogo} disabled={enviando}>{t('usuarios.cancelar')}</Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? t('dispositivos.procesando') : t('dispositivos.confirmarBroker')}
              </Button>
            </div>
          </form>
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
              <SelectorFecha
                id="c-fecha"
                valor={formCalibracion.fecha}
                invalido={fechaCalibracionInvalida}
                onCambiar={(fecha) => {
                  setFormCalibracion((previo) => ({ ...previo, fecha }))
                  if (fecha) setFechaCalibracionInvalida(false)
                }}
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
                aria-describedby="c-vigencia-ayuda"
                required
              />
              <p id="c-vigencia-ayuda" className="mt-1 text-xs text-muted">{t('dispositivos.mesesVigenciaAyuda')}</p>
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
              <SelectorFecha
                id="i-fecha"
                valor={formInstalacion.fecha}
                onCambiar={(fecha) => setFormInstalacion((previo) => ({ ...previo, fecha }))}
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

/** Aviso pendiente de un equipo: una línea con icono; la ayuda larga va en `title`. */
function Aviso({ tono, title, children }: { tono: 'warn' | 'critical'; title?: string; children: React.ReactNode }) {
  const Icono = tono === 'critical' ? ShieldAlert : TriangleAlert
  return (
    <li title={title} className={cn('flex items-start gap-1.5', tono === 'critical' ? 'text-critical' : 'text-honey-700')}>
      <Icono aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </li>
  )
}

/** Fila «etiqueta — valor» de la ficha técnica. */
function Dato({ etiqueta, children }: { etiqueta: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2">
      <dt className="text-muted">{etiqueta}</dt>
      <dd className="text-right font-medium">{children}</dd>
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
          : 'rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] text-critical'
      }
    >
      {mensaje.texto}
    </p>
  )
}
