import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BellOff, CheckCheck, ClipboardPen, History, PencilLine, RadioTower } from 'lucide-react'

import { useAlertas, type FiltroEstado } from '@/application/hooks/useAlertas'
import { useIncidentesOperativos } from '@/application/hooks/useIncidentesOperativos'
import { useAuthStore } from '@/application/stores/authStore'
import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { EstadoAlerta } from '@/domain/value-objects/EstadoAlerta'
import { tienePermiso } from '@/domain/value-objects/Rol'
import { fechaCorta, fechaHora, hora } from '@/lib/formato'
import { rangoPagina } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { ActionMenu } from '../components/ActionMenu'
import { EstadoCarga, EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Paginacion } from '../components/Paginacion'
import { RiskBadge } from '../components/RiskBadge'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Label, Textarea } from '../components/ui/input'
import { Segmentado } from '../components/ui/segmentado'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

// HU-23: los tabs de filtro siguen la máquina de estados, no un booleano.
const FILTROS: FiltroEstado[] = ['pendiente', 'reconocida', 'atendida', 'todas']

const VARIANTE_POR_ESTADO: Record<EstadoAlerta, 'outline' | 'warn' | 'ok'> = {
  pendiente: 'outline',
  reconocida: 'warn',
  atendida: 'ok',
}

const VACIO_POR_FILTRO: Record<FiltroEstado, string> = {
  pendiente: 'alertas.sinPendientes',
  reconocida: 'alertas.sinRevisadas',
  atendida: 'alertas.sinAtendidas',
  todas: 'alertas.sinAlertas',
}

// Fecha, equipo, riesgo, estado y opciones tienen ancho propio y el mensaje
// se queda con el resto. Bajo 1280 px el relleno lateral se ciñe para que las
// seis columnas quepan sin desplazar la tabla.
const RELLENO = 'sm:px-2 xl:px-4'

/** Fecha arriba y hora debajo: ninguna de las dos se parte al estrechar la columna. */
function FechaYHora({ iso }: { iso: string | null }) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return <>{fechaHora(iso)}</>
  return (
    <>
      <span className="block whitespace-nowrap">{fechaCorta(iso)}</span>
      <span className="block whitespace-nowrap text-muted">{hora(iso)}</span>
    </>
  )
}

export function AlertasPage() {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const {
    alertas,
    cargando,
    errorCarga,
    reintentar,
    filtro,
    setFiltro,
    reconocerAlerta,
    registrarAccionCorrectiva,
    obtenerCicloAtencion,
    rectificarAccion,
  } = useAlertas()
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // Solo se pinta la página visible: estas listas crecen sin techo.
  const visibles = useMemo(() => alertas.slice(...rangoPagina(pagina, tamanoPagina)), [alertas, pagina, tamanoPagina])

  const [alertaSeleccionada, setAlertaSeleccionada] = useState<AlertaTermica | null>(null)
  const [descripcionAccion, setDescripcionAccion] = useState('')
  const [guardandoAccion, setGuardandoAccion] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(false)
  // HU-27 Escenario 2: la alerta pudo cambiar de estado entre que se cargó
  // la lista y este click (otro usuario la atendió primero).
  const [conflictoAccion, setConflictoAccion] = useState(false)
  const [conflictoReconocer, setConflictoReconocer] = useState<string | null>(null)

  // HU-23 criterio 4: cronología de atención de la alerta seleccionada.
  const [alertaDetalle, setAlertaDetalle] = useState<AlertaTermica | null>(null)
  const [ciclo, setCiclo] = useState<AccionCorrectiva[]>([])
  const [cargandoCiclo, setCargandoCiclo] = useState(false)
  const [errorCiclo, setErrorCiclo] = useState(false)

  // HU-28: rectificación en línea dentro de la cronología.
  const [accionARectificar, setAccionARectificar] = useState<AccionCorrectiva | null>(null)
  const [textoRectificacion, setTextoRectificacion] = useState('')
  const [motivoRectificacion, setMotivoRectificacion] = useState('')
  const [guardandoRectificacion, setGuardandoRectificacion] = useState(false)
  const [errorRectificacion, setErrorRectificacion] = useState<'conflicto' | 'prohibido' | 'error' | null>(null)

  const verDetalle = async (alerta: AlertaTermica) => {
    setAccionARectificar(null)
    setAlertaDetalle(alerta)
    setCiclo([])
    setErrorCiclo(false)
    setCargandoCiclo(true)
    try {
      setCiclo(await obtenerCicloAtencion(alerta.id))
    } catch {
      setErrorCiclo(true)
    } finally {
      setCargandoCiclo(false)
    }
  }

  // HU-23/HU-41: reconocer (PENDIENTE -> RECONOCIDA) es exclusivo del
  // farmacéutico, igual que ya exige `require_roles(Rol.FARMACEUTICO)` en el
  // backend. Registrar una acción correctiva la permiten farmacéutico y
  // técnico. AUDITOR no aparece en ninguna de las dos listas: es de solo
  // lectura, así que ambos botones quedan ocultos para ese rol.
  const puedeReconocer = usuario !== null && tienePermiso(usuario.rol, ['farmaceutico'])
  const puedeRegistrarAccion =
    usuario !== null && tienePermiso(usuario.rol, ['farmaceutico', 'tecnico'])

  const guardarAccion = async () => {
    if (!alertaSeleccionada || descripcionAccion.trim().length === 0) return
    setGuardandoAccion(true)
    setConflictoAccion(false)
    try {
      const resultado = await registrarAccionCorrectiva(alertaSeleccionada.id, descripcionAccion.trim())
      if (resultado === 'ok') {
        setMensajeExito(true)
        setTimeout(() => {
          setAlertaSeleccionada(null)
          setDescripcionAccion('')
          setMensajeExito(false)
        }, 1200)
      } else if (resultado === 'conflicto') {
        // HU-27 Escenario 2: otro usuario ya atendió esta alerta. La lista
        // ya se refrescó (dentro del hook); aquí solo se informa por qué
        // este envío en particular no se aplicó.
        setConflictoAccion(true)
      }
    } finally {
      setGuardandoAccion(false)
    }
  }

  // HU-28 (P5): rectifica su autor o un farmacéutico (el administrador por
  // acceso implícito). El auditor nunca. Solo la versión vigente.
  const puedeRectificar = (accion: AccionCorrectiva) =>
    usuario !== null &&
    accion.vigente !== false &&
    (tienePermiso(usuario.rol, ['farmaceutico']) ||
      (accion.usuario_id === usuario.id && tienePermiso(usuario.rol, ['tecnico'])))

  const abrirRectificacion = (accion: AccionCorrectiva) => {
    setAccionARectificar(accion)
    setTextoRectificacion(accion.descripcion)
    setMotivoRectificacion('')
    setErrorRectificacion(null)
  }

  const guardarRectificacion = async () => {
    if (!accionARectificar || !alertaDetalle) return
    setGuardandoRectificacion(true)
    setErrorRectificacion(null)
    try {
      const resultado = await rectificarAccion(
        accionARectificar.id,
        textoRectificacion.trim(),
        motivoRectificacion.trim(),
      )
      if (resultado === 'ok') {
        await verDetalle(alertaDetalle)
      } else {
        setErrorRectificacion(resultado)
        // Otro usuario la rectificó antes: la cronología cambió.
        if (resultado === 'conflicto') setCiclo(await obtenerCicloAtencion(alertaDetalle.id))
      }
    } finally {
      setGuardandoRectificacion(false)
    }
  }

  const fechaDeAccion = (id: string | null | undefined) =>
    fechaHora(ciclo.find((a) => a.id === id)?.created_at ?? null)

  const reconocer = async (alertaId: string) => {
    setConflictoReconocer(null)
    const resultado = await reconocerAlerta(alertaId)
    if (resultado === 'conflicto') setConflictoReconocer(alertaId)
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t('nav.seccionOperacion')} titulo={t('alertas.titulo')} descripcion={t('alertas.descripcion')} />

      {/* ── Estado de seguimiento ───────────────────────────── */}
      <div>
        <Segmentado
          etiqueta={t('alertas.filtroEstado')}
          valor={filtro}
          onCambiar={setFiltro}
          opciones={FILTROS.map((opcion) => ({ valor: opcion, etiqueta: t(`alertas.filtro.${opcion}`) }))}
          className="grid w-full grid-cols-4 sm:inline-flex sm:w-auto"
          botonClassName="px-1.5 text-xs sm:px-3.5 sm:text-[13px]"
        />
      </div>

      {/* ── Lista de alertas: la tarea principal de la pantalla ── */}
      <div>
        {errorCarga ? (
          <EstadoError mensaje={t('alertas.errorCargar')}>
            <Button variant="secondary" size="sm" className="mt-3" onClick={reintentar}>
              {t('comunes.reintentar')}
            </Button>
          </EstadoError>
        ) : !cargando && alertas.length === 0 ? (
          <EstadoVacio icono={BellOff} titulo={t(VACIO_POR_FILTRO[filtro])} />
        ) : (
          <>
            <Table mobileLayout="stack" className="min-w-0" titulo={t('alertas.titulo')} cargando={cargando}>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn('h-11 w-36', RELLENO)}>{t('alertas.fecha')}</TableHead>
                  <TableHead className={cn('h-11 w-28', RELLENO)}>{t('historial.dispositivo')}</TableHead>
                  <TableHead className={cn('h-11 w-44', RELLENO)}>{t('historial.riesgo')}</TableHead>
                  <TableHead className={cn('h-11', RELLENO)}>{t('alertas.mensaje')}</TableHead>
                  <TableHead className={cn('h-11 w-28', RELLENO)}>{t('alertas.estado')}</TableHead>
                  <TableHead className={cn('h-11 w-32 text-right', RELLENO)}>{t('alertas.acciones')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando ? (
                  <TableEmpty colSpan={6}>
                    <EstadoCarga className="py-0" />
                  </TableEmpty>
                ) : (
                  visibles.map((alerta) => (
                    <TableRow key={alerta.id}>
                      <TableCell data-label={t('alertas.fecha')} className={cn('nums py-4 text-[13px] leading-5', RELLENO)}>
                        <FechaYHora iso={alerta.created_at} />
                      </TableCell>
                      <TableCell data-label={t('historial.dispositivo')} className={cn('py-4 whitespace-nowrap text-[13px] font-medium', RELLENO)}>
                        {alerta.device_id}
                      </TableCell>
                      {/* En móvil cada alerta es una ficha: el riesgo la encabeza a lo
                          ancho y el mensaje ocupa su propia fila. */}
                      <TableCell data-label={t('historial.riesgo')} className={cn('mobile-full py-4 max-sm:order-first', RELLENO)}>
                        <RiskBadge nivel={alerta.nivel_riesgo} />
                      </TableCell>
                      <TableCell data-label={t('alertas.mensaje')} className={cn('mobile-full py-4 text-sm leading-5 text-balance', RELLENO)}>
                        {alerta.mensaje}
                        {conflictoReconocer === alerta.id && (
                          <p role="alert" className="mt-1.5 text-xs leading-4 text-critical">
                            {t('alertas.conflictoEstado')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell data-label={t('alertas.estado')} className={cn('py-4', RELLENO)}>
                        <Badge variant={VARIANTE_POR_ESTADO[alerta.estado]}>
                          {t(`alertas.estadoAlerta.${alerta.estado}`)}
                        </Badge>
                      </TableCell>
                      <TableCell data-label={t('alertas.acciones')} className={cn('mobile-actions py-4 text-right', RELLENO)}>
                        <div className="flex justify-end">
                          <ActionMenu label={`${t('alertas.acciones')}: ${alerta.device_id}`}>
                            {alerta.estado === 'pendiente' && puedeReconocer && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void reconocer(alerta.id)}
                                title={t('alertas.marcarRevisada')}
                              >
                                <CheckCheck />
                                {t('alertas.marcarRevisada')}
                              </Button>
                            )}
                            {alerta.estado !== 'atendida' && puedeRegistrarAccion && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setAlertaSeleccionada(alerta)}
                                title={t('alertas.registrarAccion')}
                              >
                                <ClipboardPen />
                                {t('alertas.accionCorrectiva')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void verDetalle(alerta)}
                              aria-label={`${t('alertas.verDetalle')}: ${alerta.device_id}`}
                            >
                              <History />
                              {t('alertas.verDetalle')}
                            </Button>
                          </ActionMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Paginacion total={alertas.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
          </>
        )}
      </div>

      <IncidentesOperativos />

      {/* ── Diálogo de acción correctiva ────────────────────── */}
      <Dialog
        open={alertaSeleccionada !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setAlertaSeleccionada(null)
            setDescripcionAccion('')
            setMensajeExito(false)
            setConflictoAccion(false)
          }
        }}
      >
        <DialogContent>
          <DialogTitle>{t('alertas.registrarAccion')}</DialogTitle>
          <DialogDescription>{alertaSeleccionada?.mensaje}</DialogDescription>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="accion-descripcion">{t('alertas.etiquetaAccion')}</Label>
              <Textarea
                id="accion-descripcion"
                value={descripcionAccion}
                onChange={(e) => setDescripcionAccion(e.target.value)}
                placeholder={t('alertas.descripcionAccionPlaceholder')}
                maxLength={2000}
                aria-describedby="accion-ayuda"
              />
              <p id="accion-ayuda" className="mt-1 text-xs text-faint">
                {t('alertas.descripcionAccionAyuda')}
              </p>
            </div>
            {mensajeExito && (
              <p
                role="status"
                className="rounded-(--radius-field) bg-success-100 px-3 py-2 text-[13px] text-success-700"
              >
                {t('alertas.accionRegistrada')}
              </p>
            )}
            {conflictoAccion && (
              <p
                role="alert"
                className="rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] text-critical"
              >
                {t('alertas.conflictoEstado')}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="ghost"
                onClick={() => setAlertaSeleccionada(null)}
                disabled={guardandoAccion}
              >
                {t('comunes.cancelar')}
              </Button>
              <Button
                onClick={() => void guardarAccion()}
                disabled={guardandoAccion || descripcionAccion.trim().length === 0}
              >
                {guardandoAccion ? t('alertas.guardando') : t('alertas.guardarAccion')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── HU-23 criterio 4: cronología de atención (solo lectura) ──────── */}
      <Dialog open={alertaDetalle !== null} onOpenChange={(abierto) => !abierto && setAlertaDetalle(null)}>
        <DialogContent>
          <DialogTitle>{t('alertas.cicloAtencion')}</DialogTitle>
          <DialogDescription>{alertaDetalle?.mensaje}</DialogDescription>
          {alertaDetalle && (
            <dl className="mt-5 grid grid-cols-1 gap-4 border-y border-border py-4 text-sm min-[420px]:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">{t('historial.dispositivo')}</dt>
                <dd className="nums mt-1 font-medium">{alertaDetalle.device_id}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t('historial.riesgo')}</dt>
                <dd className="mt-1"><RiskBadge nivel={alertaDetalle.nivel_riesgo} /></dd>
              </div>
            </dl>
          )}
          <ol className="mt-3 max-h-96 space-y-5 overflow-y-auto border-l border-border pl-4 [&>li]:relative [&>li]:before:absolute [&>li]:before:-left-[21px] [&>li]:before:top-1 [&>li]:before:size-2 [&>li]:before:rounded-full [&>li]:before:bg-primary">
            {alertaDetalle?.created_at && (
              <li>
                <p className="text-[13px] font-medium">{t('alertas.eventoCreada')}</p>
                <p className="nums text-xs text-faint">{fechaHora(alertaDetalle.created_at)}</p>
              </li>
            )}
            {alertaDetalle?.reconocida_en && (
              <li>
                <p className="text-[13px] font-medium">{t('alertas.eventoReconocida')}</p>
                <p className="nums text-xs text-faint">{fechaHora(alertaDetalle.reconocida_en)}</p>
                {alertaDetalle.revisada_por && (
                  <p className="nums text-xs text-muted">
                    {t('alertas.responsable')}: {alertaDetalle.revisada_por_nombre ?? alertaDetalle.revisada_por}
                  </p>
                )}
              </li>
            )}
            {cargandoCiclo ? (
              <li className="text-sm text-muted">{t('app.cargando')}</li>
            ) : errorCiclo ? (
              <li role="alert" className="text-sm text-critical">{t('comunes.error')}</li>
            ) : (
              ciclo.map((accion) => (
                <li key={accion.id}>
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                    {accion.corrige_accion_id ? t('alertas.eventoRectificada') : t('alertas.eventoAtendida')}
                    {accion.vigente === false && <Badge variant="outline">{t('alertas.rectificada')}</Badge>}
                  </p>
                  <p className="nums text-xs text-faint">{fechaHora(accion.created_at)}</p>
                  <p className="nums text-xs text-muted">
                    {t('alertas.responsable')}: {accion.usuario_nombre ?? accion.usuario_id}
                  </p>
                  {accion.corrige_accion_id && (
                    <p className="text-xs text-muted">
                      {t('alertas.rectificaA', { fecha: fechaDeAccion(accion.corrige_accion_id) })}
                    </p>
                  )}
                  <p className={cn('mt-1 text-[13px]', accion.vigente === false ? 'text-muted' : 'text-foreground')}>
                    {accion.descripcion}
                  </p>
                  {accion.motivo_rectificacion && (
                    <p className="mt-1 text-xs text-muted">
                      {t('alertas.motivo')}: {accion.motivo_rectificacion}
                    </p>
                  )}
                  {puedeRectificar(accion) && accionARectificar?.id !== accion.id && (
                    <Button size="sm" variant="ghost" className="mt-1" onClick={() => abrirRectificacion(accion)}>
                      <PencilLine />
                      {t('alertas.rectificar')}
                    </Button>
                  )}
                  {accionARectificar?.id === accion.id && (
                    <div className="mt-2 space-y-2 rounded-(--radius-field) border border-border p-3">
                      <p className="text-xs text-muted">{t('alertas.rectificarAyuda')}</p>
                      <div>
                        <Label htmlFor="rectificacion-texto">{t('alertas.nuevaDescripcion')}</Label>
                        <Textarea
                          id="rectificacion-texto"
                          value={textoRectificacion}
                          onChange={(e) => setTextoRectificacion(e.target.value)}
                          maxLength={2000}
                        />
                      </div>
                      <div>
                        <Label htmlFor="rectificacion-motivo">{t('alertas.motivoRectificacion')}</Label>
                        <Textarea
                          id="rectificacion-motivo"
                          value={motivoRectificacion}
                          onChange={(e) => setMotivoRectificacion(e.target.value)}
                          maxLength={500}
                          aria-describedby="rectificacion-motivo-ayuda"
                        />
                        <p id="rectificacion-motivo-ayuda" className="mt-1 text-xs text-faint">
                          {t('alertas.motivoRectificacionAyuda')}
                        </p>
                      </div>
                      {errorRectificacion && (
                        <p role="alert" className="text-xs text-critical">
                          {t(`alertas.errorRectificacion.${errorRectificacion}`)}
                        </p>
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAccionARectificar(null)}
                          disabled={guardandoRectificacion}
                        >
                          {t('comunes.cancelar')}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void guardarRectificacion()}
                          disabled={
                            guardandoRectificacion ||
                            textoRectificacion.trim().length === 0 ||
                            motivoRectificacion.trim().length < 10
                          }
                        >
                          {guardandoRectificacion ? t('alertas.guardando') : t('alertas.guardarRectificacion')}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))
            )}
            {!cargandoCiclo && !errorCiclo && ciclo.length === 0 && (
              <li className="text-sm text-muted">{t('alertas.sinAcciones')}</li>
            )}
          </ol>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Link to="/historial" onClick={() => setAlertaDetalle(null)} className="text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors duration-(--duration-micro) hover:decoration-primary">
              {t('nav.historial')}
            </Link>
            <Button variant="ghost" onClick={() => setAlertaDetalle(null)}>
              {t('comunes.cerrar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * HU-54 / A-3: incidentes SIN_DATOS como alerta OPERATIVA, distinta de las
 * térmicas: el nodo dejó de reportar, no hay temperatura que clasificar.
 * Sección secundaria y discreta, debajo de la lista principal; la explicación
 * larga queda plegada.
 */
function IncidentesOperativos() {
  const { t } = useTranslation()
  const { incidentes, cargando, errorCarga } = useIncidentesOperativos()
  // Sin incidentes (o si el historial no responde) no se muestra; el estado
  // operativo en vivo sigue en el dashboard.
  if (cargando || errorCarga || incidentes.length === 0) return null

  return (
    <section aria-labelledby="incidentes-operativos-titulo" className="mt-10">
      <h2 id="incidentes-operativos-titulo" className="flex items-center gap-2 text-[15px] leading-6 font-semibold text-foreground">
        <RadioTower className="size-4 text-muted" aria-hidden />
        {t('alertas.incidentesOperativos')}
      </h2>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {incidentes.map((incidente) => (
          <li key={incidente.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1.5 py-3 text-sm">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-foreground">{incidente.device_id}</span>
                <Badge variant={incidente.estado === 'activo' ? 'critical' : 'ok'}>
                  {t(`alertas.incidenteEstado.${incidente.estado}`)}
                </Badge>
                <span className="text-xs text-muted">{t(`alertas.incidenteTipo.${incidente.tipo ?? 'sin_datos'}`)}</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {(incidente.tipo ?? 'sin_datos') === 'sin_datos'
                  ? t('alertas.incidenteDetectado', {
                      fecha: fechaHora(incidente.detectado_en),
                      segundos: incidente.umbral_silencio_segundos,
                    })
                  : t('alertas.incidenteAbierto', { fecha: fechaHora(incidente.detectado_en) })}
                {incidente.tipo === 'excursion_no_verificada' && incidente.detalle?.temperatura_interna != null && (
                  <> · {t('alertas.incidenteTemperatura', { temperatura: incidente.detalle.temperatura_interna.toFixed(2) })}</>
                )}
                {incidente.ultimo_reporte_en && <> · {t('alertas.incidenteUltimoReporte', { fecha: fechaHora(incidente.ultimo_reporte_en) })}</>}
              </p>
            </div>
            <div className="text-xs leading-5 text-muted sm:text-right">
              {incidente.recuperado_en && <p>{t('alertas.incidenteRecuperado', { fecha: fechaHora(incidente.recuperado_en) })}</p>}
              <p>
                {incidente.notificado_en
                  ? t('alertas.incidenteNotificado', { fecha: fechaHora(incidente.notificado_en) })
                  : t('alertas.incidenteSinAviso')}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <Detalles className="mt-1">
        <p className="max-w-[72ch] pb-2 text-[13px] leading-5 text-muted">{t('alertas.incidentesOperativosDetalle')}</p>
      </Detalles>
    </section>
  )
}
