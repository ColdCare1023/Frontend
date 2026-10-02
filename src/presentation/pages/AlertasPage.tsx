import { CompactWorkspace } from '../components/CompactWorkspace'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BellOff, CheckCheck, ClipboardPen, History } from 'lucide-react'

import { useAlertas, type FiltroEstado } from '@/application/hooks/useAlertas'
import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso } from '@/domain/value-objects/Rol'
import type { EstadoAlerta } from '@/domain/value-objects/EstadoAlerta'
import type { AccionCorrectiva, AlertaTermica } from '@/domain/entities/AlertaTermica'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { rangoPagina } from '@/lib/paginacion'
import { ActionMenu } from '../components/ActionMenu'
import { Paginacion } from '../components/Paginacion'
import { EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { RiskBadge } from '../components/RiskBadge'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../components/ui/dialog'
import { Label, Textarea } from '../components/ui/input'
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
  } = useAlertas()
  const [pagina, setPagina] = useState(1)
  // Solo se pinta la página visible: estas listas crecen sin techo.
  const visibles = useMemo(() => alertas.slice(...rangoPagina(pagina)), [alertas, pagina])

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

  const verDetalle = async (alerta: AlertaTermica) => {
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

  const reconocer = async (alertaId: string) => {
    setConflictoReconocer(null)
    const resultado = await reconocerAlerta(alertaId)
    if (resultado === 'conflicto') setConflictoReconocer(alertaId)
  }

  return (
    <CompactWorkspace>
      <PageHeader eyebrow={t('nav.seccionOperacion')} titulo={t('alertas.titulo')} descripcion={t('alertas.descripcion')} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={t('alertas.filtroEstado')}
          className="grid w-full grid-cols-4 gap-1 border-b border-border sm:inline-flex sm:w-auto"
        >
          {FILTROS.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setFiltro(opcion)}
              aria-pressed={filtro === opcion}
              className={cn(
                'min-h-11 cursor-pointer whitespace-nowrap border-b-2 px-2 py-2 text-center text-xs sm:px-4 sm:text-sm font-medium transition-colors duration-150',
                filtro === opcion
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted hover:text-foreground',
              )}
            >
              {t(`alertas.filtro.${opcion}`)}
            </button>
          ))}
        </div>
      </div>

      {errorCarga && (
        <div className="mb-4">
          <EstadoError mensaje={t('alertas.errorCargar')}>
            <Button variant="secondary" size="sm" className="mt-3" onClick={reintentar}>
              {t('comunes.reintentar')}
            </Button>
          </EstadoError>
        </div>
      )}

      <div className="animate-rise [&_thead]:bg-cream-100 ">
        <Table mobileLayout="stack" className="table-fixed min-w-[0]" titulo={t('alertas.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[16%] px-2 text-center text-xs">{t('alertas.fecha')}</TableHead>
              <TableHead className="w-[14%] px-2 text-center text-xs">{t('historial.dispositivo')}</TableHead>
              <TableHead className="w-[17%] px-2 text-center text-xs">{t('historial.riesgo')}</TableHead>
              <TableHead className="w-[23%] px-2 text-center text-xs">{t('alertas.mensaje')}</TableHead>
              <TableHead className="w-[12%] px-2 text-center text-xs">{t('alertas.estado')}</TableHead>
              <TableHead className="w-[18%] px-2 text-center text-xs">{t('alertas.acciones')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errorCarga ? (
              <TableEmpty colSpan={6}>{t('alertas.errorTabla')}</TableEmpty>
            ) : cargando ? (
              <TableEmpty colSpan={6}>{t('app.cargando')}</TableEmpty>
            ) : alertas.length === 0 ? (
              <TableEmpty colSpan={6}>
                <span className="inline-flex flex-col items-center gap-2">
                  <BellOff className="size-5 text-faint" />
                  {t(
                    filtro === 'pendiente'
                      ? 'alertas.sinPendientes'
                      : filtro === 'reconocida'
                        ? 'alertas.sinRevisadas'
                        : filtro === 'atendida'
                          ? 'alertas.sinAtendidas'
                          : 'alertas.sinAlertas',
                  )}
                </span>
              </TableEmpty>
            ) : (
              visibles.map((alerta) => (
                <TableRow key={alerta.id}>
                  <TableCell data-label={t('alertas.fecha')} className="nums whitespace-nowrap px-2 text-center text-[11px]">
                    {fechaHora(alerta.created_at)}
                  </TableCell>
                  <TableCell data-label={t('historial.dispositivo')} className="whitespace-nowrap px-2 text-center text-[11px]">{alerta.device_id}</TableCell>
                  <TableCell data-label={t('historial.riesgo')} className="text-center">
                    <span className="inline-flex justify-center"><RiskBadge nivel={alerta.nivel_riesgo} /></span>
                  </TableCell>
                  <TableCell data-label={t('alertas.mensaje')} className="px-2 text-center text-xs leading-5 text-muted">{alerta.mensaje}</TableCell>
                  <TableCell data-label={t('alertas.estado')} className="text-center">
                    <Badge variant={VARIANTE_POR_ESTADO[alerta.estado]}>
                      {t(`alertas.estadoAlerta.${alerta.estado}`)}
                    </Badge>
                  </TableCell>
                  <TableCell data-label={t('alertas.acciones')} className="mobile-full mobile-actions text-center">
                    <div className="flex flex-col items-center gap-1.5">
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
                    {conflictoReconocer === alerta.id && (
                      <p role="alert" className="text-xs text-clay-700">
                        {t('alertas.conflictoEstado')}
                      </p>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!errorCarga && <Paginacion total={alertas.length} pagina={pagina} onCambiar={setPagina} />}
      </div>

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
                className="rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700"
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
                  <p className="nums text-xs text-muted">{t('alertas.responsable')}: {alertaDetalle.revisada_por}</p>
                )}
              </li>
            )}
            {cargandoCiclo ? (
              <li className="text-sm text-muted">{t('app.cargando')}</li>
            ) : errorCiclo ? (
              <li role="alert" className="text-sm text-clay-700">{t('comunes.error')}</li>
            ) : (
              ciclo.map((accion) => (
                <li key={accion.id}>
                  <p className="text-[13px] font-medium">
                    {accion.corrige_accion_id ? t('alertas.eventoRectificada') : t('alertas.eventoAtendida')}
                  </p>
                  <p className="nums text-xs text-faint">{fechaHora(accion.created_at)}</p>
                  <p className="nums text-xs text-muted">{t('alertas.responsable')}: {accion.usuario_id}</p>
                  <p className="mt-1 text-[13px] text-foreground">{accion.descripcion}</p>
                </li>
              ))
            )}
            {!cargandoCiclo && !errorCiclo && ciclo.length === 0 && (
              <li className="text-sm text-muted">{t('alertas.sinAcciones')}</li>
            )}
          </ol>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Link to="/historial" onClick={() => setAlertaDetalle(null)} className="text-sm font-medium text-pine-700 underline-offset-2 hover:underline">
              {t('nav.historial')}
            </Link>
            <Button variant="ghost" onClick={() => setAlertaDetalle(null)}>
              {t('comunes.cerrar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CompactWorkspace>
  )
}
