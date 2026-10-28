import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  Fingerprint,
  FlaskConical,
  Link2,
  OctagonAlert,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  ShieldHalf,
  TriangleAlert,
} from 'lucide-react'

import { useTrazabilidad } from '@/application/hooks/useTrazabilidad'
import { useAuthStore } from '@/application/stores/authStore'
import type {
  DetalleInconsistencia,
  VerificacionIntegridad,
  VerificacionSegmento,
} from '@/domain/entities/RegistroTrazabilidad'
import { apiClient } from '@/infrastructure/api/apiClient'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { CompactWorkspace } from '../components/CompactWorkspace'
import { EstadoCarga, EstadoVacio } from '../components/EstadoPagina'
import { Paginacion } from '../components/Paginacion'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Detalles } from '../components/ui/detalles'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input, Label, NativeSelect } from '../components/ui/input'
import { SelectorFecha } from '../components/ui/selector-fecha'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const TIPOS_EVENTO = [
  'LECTURA_TERMICA',
  'ALERTA_TERMICA',
  'ACCION_CORRECTIVA',
  'REPORTE_BPA',
  'AUDITORIA',
  'CONECTIVIDAD',
]

type Traductor = ReturnType<typeof useTranslation>['t']

function etiquetaEvento(tipo: string, t: Traductor) {
  return t(`trazabilidad.eventos.${tipo}`, {
    defaultValue: tipo.replaceAll('_', ' ').toLocaleLowerCase(),
  })
}

export function TrazabilidadPage() {
  const { t } = useTranslation()
  const {
    registros,
    cargando,
    consultar,
    verificacion,
    verificando,
    verificarIntegridad,
    estadoCadena,
    aislarCorrupcion,
    verificacionSegmento,
    verificandoSegmento,
    errorSegmento,
    verificarPorDispositivo,
  } = useTrazabilidad()
  const [pagina, setPagina] = useState(1)
  const tamanoPagina = useResponsivePageSize()
  // HU-37: verificación acotada a un dispositivo y periodo.
  const [segmentoDeviceId, setSegmentoDeviceId] = useState('')
  const [segmentoDesde, setSegmentoDesde] = useState('')
  const [segmentoHasta, setSegmentoHasta] = useState('')
  const [faltaDesde, setFaltaDesde] = useState(false)
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(
    () => registros.slice(...rangoPagina(pagina, tamanoPagina)),
    [registros, pagina, tamanoPagina],
  )
  const [tipoEvento, setTipoEvento] = useState('')
  const [mostrarSellos, setMostrarSellos] = useState(false)
  const [aislando, setAislando] = useState(false)
  const [confirmarAislar, setConfirmarAislar] = useState(false)
  const [errorAislar, setErrorAislar] = useState(false)
  const usuario = useAuthStore((s) => s.usuario)

  const detalle = verificacion?.detalle_inconsistencia ?? null
  // HU-26: backends previos (y el modo demo) solo envían `integra`.
  const estadoVerificacion =
    verificacion?.estado ?? (verificacion?.integra ? 'integra' : 'ruptura_detectada')
  const rupturaAislada = estadoVerificacion === 'ruptura_aislada'

  // El selector de fecha no impone `min`/`max` como el campo nativo: el rango
  // invertido se marca en los dos campos y se explica antes de enviar.
  const segmentoInvertido = Boolean(segmentoDesde && segmentoHasta && segmentoDesde > segmentoHasta)
  const mensajeSegmento =
    segmentoInvertido || errorSegmento === 'rango_invalido'
      ? t('trazabilidad.rangoInvalido')
      : errorSegmento
        ? t('comunes.error')
        : null

  const aislar = async () => {
    if (!detalle) return
    setAislando(true)
    setErrorAislar(false)
    const resultado = await aislarCorrupcion(detalle.id)
    setAislando(false)
    if (resultado === 'ok') setConfirmarAislar(false)
    else setErrorAislar(true)
  }

  const verificarSegmento = () => {
    // «Desde» es obligatorio: sin el aviso nativo del campo `date`, el campo
    // se marca y recibe el foco para que el envío no falle en silencio.
    if (!segmentoDesde) {
      setFaltaDesde(true)
      document.getElementById('seg-desde')?.focus()
      return
    }
    if (!segmentoDeviceId || segmentoInvertido) return
    const desdeISO = new Date(`${segmentoDesde}T00:00:00`).toISOString()
    const hastaISO = segmentoHasta
      ? new Date(`${segmentoHasta}T23:59:59.999`).toISOString()
      : new Date().toISOString()
    void verificarPorDispositivo(segmentoDeviceId, desdeISO, hastaISO)
  }

  return (
    <CompactWorkspace>
      <PageHeader eyebrow={t('nav.seccionCumplimiento')} titulo={t('trazabilidad.titulo')} descripcion={t('trazabilidad.descripcion')}>
        <Button onClick={() => void verificarIntegridad()} disabled={verificando}>
          <ShieldCheck />
          {verificando ? t('trazabilidad.verificando') : t('trazabilidad.verificar')}
        </Button>
      </PageHeader>

      {/* HU-47: una cadena de custodia comprometida es el equivalente
          documental de una excursión térmica; se anuncia (`role="alert"`),
          no solo se pinta en rojo (WCAG 4.1.3). */}
      {estadoCadena?.cadena_comprometida && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-(--radius-card) border border-critical/25 bg-critical-tint px-4 py-3.5 sm:px-5">
          <div role="alert" className="flex min-w-0 flex-1 basis-64 items-start gap-3">
            <OctagonAlert className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-critical">{t('trazabilidad.cadenaComprometida')}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-muted">{t('trazabilidad.cadenaComprometidaDetalle')}</p>
            </div>
          </div>
          {usuario?.rol === 'administrador' && detalle && (
            <Button variant="danger" size="sm" className="shrink-0" onClick={() => setConfirmarAislar(true)}>
              {t('trazabilidad.aislar')}
            </Button>
          )}
        </div>
      )}

      {verificacion && (
        <ResultadoVerificacion
          verificacion={verificacion}
          detalle={detalle}
          rupturaAislada={rupturaAislada}
        />
      )}

      {/* ── HU-37: verificación acotada a un dispositivo y periodo ──── */}
      <Card className="p-4 sm:px-5">
        <h2 id="segmento-titulo" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ScanSearch className="size-4 text-primary" aria-hidden />
          {t('trazabilidad.verificarSegmento')}
        </h2>
        <form
          aria-labelledby="segmento-titulo"
          className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            verificarSegmento()
          }}
        >
          <div>
            <Label htmlFor="seg-device">{t('historial.dispositivo')}</Label>
            <Input
              id="seg-device"
              value={segmentoDeviceId}
              onChange={(e) => setSegmentoDeviceId(e.target.value)}
              placeholder="FARM-01-CDL"
              required
            />
          </div>
          <div>
            <Label htmlFor="seg-desde">{t('historial.desde')}</Label>
            <SelectorFecha
              id="seg-desde"
              valor={segmentoDesde}
              onCambiar={setSegmentoDesde}
              invalido={(faltaDesde && !segmentoDesde) || segmentoInvertido}
              aria-describedby="segmento-desde-ayuda"
            />
          </div>
          <div>
            <Label htmlFor="seg-hasta">{t('historial.hasta')}</Label>
            <SelectorFecha
              id="seg-hasta"
              valor={segmentoHasta}
              onCambiar={setSegmentoHasta}
              invalido={segmentoInvertido}
              aria-describedby="segmento-hasta-ayuda"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={verificandoSegmento || segmentoInvertido}
            className="w-full sm:col-span-2 lg:col-span-1 lg:w-auto"
          >
            {verificandoSegmento ? t('trazabilidad.verificando') : t('trazabilidad.verificarSegmentoBoton')}
          </Button>
        </form>

        {mensajeSegmento && (
          <p role="alert" className="mt-3 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] text-critical">
            {mensajeSegmento}
          </p>
        )}

        {verificacionSegmento && <ResultadoSegmento resultado={verificacionSegmento} />}

        {/* Ayuda del formulario y alcance de la revisión: a un clic. */}
        <Detalles className="mt-2">
          <div className="space-y-2 text-xs leading-5 text-muted">
            <p className="max-w-[72ch]">{t('trazabilidad.cadenaExplicacion')}</p>
            <p id="segmento-desde-ayuda">
              <span className="font-medium text-foreground">{t('historial.desde')}:</span> {t('trazabilidad.desdeAyuda')}
            </p>
            <p id="segmento-hasta-ayuda">
              <span className="font-medium text-foreground">{t('historial.hasta')}:</span> {t('trazabilidad.hastaOpcional')}
            </p>
            {verificacionSegmento && <AlcanceVerificacion texto={verificacionSegmento.alcance} />}
          </div>
        </Detalles>
      </Card>

      {/* ── Registros: la tarea principal ───────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="w-full sm:w-64">
            <Label htmlFor="f-evento">{t('trazabilidad.tipoEvento')}</Label>
            <NativeSelect
              id="f-evento"
              value={tipoEvento}
              onChange={(e) => {
                setTipoEvento(e.target.value)
                void consultar(e.target.value || undefined)
              }}
            >
              <option value="">{t('trazabilidad.todosEventos')}</option>
              {TIPOS_EVENTO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {etiquetaEvento(tipo, t)}
                </option>
              ))}
            </NativeSelect>
          </div>
          {/* Controles secundarios, discretos: el detalle técnico de los sellos
              y la simulación del modo demo. */}
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={mostrarSellos}
              onClick={() => setMostrarSellos((actual) => !actual)}
            >
              <Fingerprint />
              {mostrarSellos ? t('trazabilidad.ocultarSellos') : t('trazabilidad.mostrarSellos')}
            </Button>
            {import.meta.env.MODE === 'demo' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await apiClient.post('/api/demo/trazabilidad/simular-inconsistencia')
                  await verificarIntegridad()
                }}
              >
                <FlaskConical />
                Simular inconsistencia (demo)
              </Button>
            )}
          </div>
        </div>

        {cargando && registros.length === 0 ? (
          <EstadoCarga />
        ) : registros.length === 0 ? (
          <EstadoVacio icono={Link2} titulo={t('trazabilidad.sinRegistros')} />
        ) : (
          <>
            <Table
              mobileLayout="stack"
              className={cn('table-fixed min-w-0 transition-opacity', cargando && 'opacity-60')}
              titulo={t('trazabilidad.titulo')}
              cargando={cargando}
            >
              <TableHeader>
                <TableRow>
                  <TableHead className={mostrarSellos ? 'w-[21%]' : 'w-[30%]'}>{t('trazabilidad.fecha')}</TableHead>
                  <TableHead className={mostrarSellos ? 'w-[26%]' : 'w-[40%]'}>{t('trazabilidad.evento')}</TableHead>
                  <TableHead className={mostrarSellos ? 'w-[18%]' : 'w-[30%]'}>{t('historial.dispositivo')}</TableHead>
                  {mostrarSellos && <TableHead className="w-[35%]">{t('trazabilidad.sellos')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((registro) => {
                  // El registro señalado por la verificación se marca en la
                  // propia tabla: quien llega a la fila desplazándose tiene que
                  // reconocerla.
                  const corrupto = detalle?.id === registro.id
                  return (
                    <TableRow
                      key={registro.id}
                      data-testid={corrupto ? 'fila-corrupta' : undefined}
                      className={cn(corrupto && 'bg-critical-tint hover:bg-critical-tint')}
                    >
                      <TableCell data-label={t('trazabilidad.fecha')} className="nums whitespace-nowrap text-[13px]">
                        {corrupto && (
                          <span className="mr-1.5 inline-flex align-[-2px] text-critical">
                            <TriangleAlert className="size-3.5" aria-hidden />
                            <span className="sr-only">{t('trazabilidad.registroAfectado')}: </span>
                          </span>
                        )}
                        {fechaHora(registro.timestamp)}
                      </TableCell>
                      <TableCell data-label={t('trazabilidad.evento')}>
                        <Badge variant="neutral" className="max-w-full max-sm:rounded-lg max-sm:whitespace-normal">
                          {etiquetaEvento(registro.tipo_evento, t)}
                        </Badge>
                      </TableCell>
                      <TableCell data-label={t('historial.dispositivo')} className="text-[13px] text-muted">
                        {registro.device_id ?? '—'}
                      </TableCell>
                      {mostrarSellos && (
                        <TableCell data-label={t('trazabilidad.sellos')} className="min-w-0 px-2 py-1.5">
                          <div className="grid min-w-0 grid-cols-2 gap-1">
                            <SelloTecnico etiqueta={t('trazabilidad.hashAnterior')} hash={registro.previous_hash} />
                            <SelloTecnico etiqueta={t('trazabilidad.hash')} hash={registro.hash_actual} />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <Paginacion total={registros.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
          </>
        )}
      </div>

      {/* Aislar un registro inconsistente es irreversible y afecta los datos
          que quedan disponibles para revisión: siempre con confirmación. */}
      <Dialog
        open={confirmarAislar}
        onOpenChange={(abierto) => {
          setConfirmarAislar(abierto)
          if (!abierto) setErrorAislar(false)
        }}
      >
        <DialogContent destructivo>
          <DialogTitle>{t('trazabilidad.aislar')}</DialogTitle>
          <DialogDescription>{t('trazabilidad.confirmarAislar')}</DialogDescription>
          {detalle && (
            <p className="nums mt-3 break-all rounded-(--radius-field) bg-surface-sunken px-3 py-2 text-[13px]">
              {detalle.id}
            </p>
          )}
          {errorAislar && (
            <p role="alert" className="mt-3 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13px] text-critical">
              {t('comunes.error')}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmarAislar(false)} disabled={aislando}>
              {t('comunes.cancelar')}
            </Button>
            <Button variant="danger" onClick={() => void aislar()} disabled={aislando}>
              {aislando ? t('trazabilidad.aislando') : t('trazabilidad.aislar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CompactWorkspace>
  )
}

/** Resultado de «Revisar integridad»: veredicto visible, detalle técnico plegado. */
function ResultadoVerificacion({
  verificacion,
  detalle,
  rupturaAislada,
}: {
  verificacion: VerificacionIntegridad
  detalle: DetalleInconsistencia | null
  rupturaAislada: boolean
}) {
  const { t } = useTranslation()
  const integra = verificacion.integra
  const Icono = integra ? ShieldCheck : rupturaAislada ? ShieldHalf : ShieldAlert
  const posteriores = verificacion.registros_posteriores_afectados
  // RF-15: «la cadena está rota en la posición 42» no permite actuar; el
  // auditor necesita saber qué registro es, de cuándo y en qué se diferencia el
  // sello recalculado del almacenado.
  const conDetalle = !integra && !rupturaAislada && detalle

  return (
    <Card className="p-4 sm:px-5">
      <div role="status" className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            integra ? 'bg-success-100 text-success-700' : rupturaAislada ? 'bg-honey-100 text-honey-700' : 'bg-critical-tint text-critical',
          )}
        >
          <Icono className="size-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p
            className={cn(
              'text-[15px] leading-6 font-semibold',
              integra ? 'text-success-700' : rupturaAislada ? 'text-honey-700' : 'text-critical',
            )}
          >
            {integra
              ? t('trazabilidad.cadenaIntegra')
              : rupturaAislada
                ? t('trazabilidad.rupturaAislada')
                : t('trazabilidad.cadenaRota')}
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-muted">
            {integra
              ? t('trazabilidad.cadenaIntegraDetalle', { n: verificacion.total_registros })
              : rupturaAislada
                ? t('trazabilidad.rupturaAisladaDetalle', {
                    n: verificacion.total_rupturas ?? 1,
                    fecha: fechaHora(verificacion.integra_desde),
                  })
                : t('trazabilidad.cadenaRotaDetalle', {
                    n: verificacion.primer_registro_inconsistente,
                  })}
          </p>
        </div>
      </div>

      {conDetalle ? (
        <div data-testid="detalle-inconsistencia" className="mt-4 border-t border-border pt-3 sm:pl-12">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
            <Dato etiqueta={t('trazabilidad.evento')}>{etiquetaEvento(detalle.tipo_evento, t)}</Dato>
            <Dato etiqueta={t('trazabilidad.fecha')} className="nums">{fechaHora(detalle.timestamp)}</Dato>
            {detalle.tipo_discrepancia && (
              <Dato etiqueta={t('trazabilidad.tipoDiscrepancia')}>
                {t(`trazabilidad.discrepancia_${detalle.tipo_discrepancia}`)}
              </Dato>
            )}
            {posteriores > 0 && (
              <Dato etiqueta={t('trazabilidad.posterioresAfectados')} className="nums text-critical">
                {posteriores}
              </Dato>
            )}
            {/* HU-26 escenario 2: una alteración puntual no invalida lo
                posterior; se informa cuánto sigue enlazado. */}
            {posteriores > 0 && verificacion.registros_posteriores_consistentes != null && (
              <Dato etiqueta={t('trazabilidad.posterioresConsistentes')} className="nums">
                {t('trazabilidad.posterioresConsistentesValor', {
                  c: verificacion.registros_posteriores_consistentes,
                  n: posteriores,
                })}
              </Dato>
            )}
            {(verificacion.total_rupturas ?? 0) > 1 && (
              <Dato etiqueta={t('trazabilidad.totalRupturas')} className="nums text-critical">
                {verificacion.total_rupturas}
              </Dato>
            )}
          </dl>
          <Detalles className="mt-2">
            <dl className="grid gap-3">
              <Dato etiqueta={t('trazabilidad.registroAfectado')} className="nums break-all">{detalle.id}</Dato>
              <Dato etiqueta={t('trazabilidad.hashEsperado')} className="nums break-all font-normal text-success-700">
                {detalle.hash_esperado}
              </Dato>
              <Dato etiqueta={t('trazabilidad.hashAlmacenado')} className="nums break-all font-normal text-critical">
                {detalle.hash_almacenado}
              </Dato>
            </dl>
            <AlcanceVerificacion texto={verificacion.alcance} className="mt-3" />
          </Detalles>
        </div>
      ) : (
        <Detalles className="mt-2 sm:pl-12">
          <AlcanceVerificacion texto={verificacion.alcance} />
        </Detalles>
      )}
    </Card>
  )
}

/** HU-37: resultado de la verificación por dispositivo y periodo. */
function ResultadoSegmento({ resultado }: { resultado: VerificacionSegmento }) {
  const { t } = useTranslation()
  const idResumen = useId()
  const Icono = resultado.integra ? ShieldCheck : ShieldAlert
  return (
    <div role="status" className="mt-4 border-t border-border pt-3">
      <p className={cn('flex items-center gap-2 text-sm font-semibold', resultado.integra ? 'text-success-700' : 'text-critical')}>
        <Icono className="size-4 shrink-0" aria-hidden />
        {resultado.integra ? t('trazabilidad.segmentoIntegro') : t('trazabilidad.segmentoRoto')}
      </p>
      <p id={idResumen} className="mt-0.5 text-[13px] text-muted">
        {t('trazabilidad.segmentoResumen', {
          n: resultado.total_bloques_verificados,
          device: resultado.device_id,
        })}
      </p>
      {resultado.registros_del_dispositivo.length > 0 && (
        // Lista con desplazamiento propio: alcanzable con el teclado.
        <ul
          tabIndex={0}
          aria-labelledby={idResumen}
          className="mt-2 max-h-56 divide-y divide-border overflow-y-auto rounded-md text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {resultado.registros_del_dispositivo.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span className="nums shrink-0 text-muted sm:w-48">{fechaHora(r.timestamp)}</span>
              <span className="min-w-0 flex-1 font-medium">{etiquetaEvento(r.tipo_evento, t)}</span>
              <Badge variant={r.integro ? 'ok' : 'critical'}>
                {r.integro ? t('trazabilidad.integro') : t('trazabilidad.corrupto')}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Dato({ etiqueta, className, children }: { etiqueta: string; className?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className={cn('mt-0.5 text-[13px] font-medium text-foreground', className)}>{children}</dd>
    </div>
  )
}

function SelloTecnico({ etiqueta, hash }: { etiqueta: string; hash: string }) {
  return (
    <details className="group min-w-0 text-left">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-1 rounded-md px-1.5 py-1 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted">{etiqueta}</span>
          <code className="nums block max-w-full truncate text-[11px] leading-4 text-foreground">{hash.slice(0, 12)}…{hash.slice(-8)}</code>
        </span>
        <ChevronDown aria-hidden className="size-3 shrink-0 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <code className="nums mt-1 block break-all rounded-md border border-border bg-surface-sunken p-2 text-[11px] leading-4 text-muted">{hash}</code>
    </details>
  )
}

/** HU-26 escenario 4: el resultado declara qué certifica y qué no. */
function AlcanceVerificacion({ texto, className }: { texto?: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <p data-testid="alcance-verificacion" className={cn('max-w-[72ch] text-xs leading-5 text-muted', className)}>
      {texto ?? t('trazabilidad.alcanceVerificacion')}
    </p>
  )
}
