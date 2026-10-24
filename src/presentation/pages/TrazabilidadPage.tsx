import { CompactWorkspace } from '../components/CompactWorkspace'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertOctagon, ChevronDown, Info, Link2, ScanSearch, ShieldAlert, ShieldCheck, ShieldHalf } from 'lucide-react'

import { useTrazabilidad } from '@/application/hooks/useTrazabilidad'
import { useAuthStore } from '@/application/stores/authStore'
import { apiClient } from '@/infrastructure/api/apiClient'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { rangoPagina } from '@/lib/paginacion'
import { useResponsivePageSize } from '@/presentation/hooks/useResponsivePageSize'
import { Paginacion } from '../components/Paginacion'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input, Label, NativeSelect } from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
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

function etiquetaEvento(tipo: string, t: ReturnType<typeof useTranslation>['t']) {
  return t(`trazabilidad.eventos.${tipo}`, {
    defaultValue: tipo.replaceAll('_', ' ').toLocaleLowerCase(),
  })
}

function SelloTecnico({ etiqueta, hash, textoCompleto }: { etiqueta: string; hash: string; textoCompleto: string }) {
  return (
    <details className="group min-w-0 text-left">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-1 rounded-md px-1.5 py-1 hover:bg-background focus-visible:outline-2 focus-visible:outline-primary">
        <span className="min-w-0">
          <span className="block text-[9px] font-medium uppercase tracking-wide text-muted">{etiqueta}</span>
          <code className="nums block max-w-full truncate font-mono text-[10px] leading-4 text-foreground">{hash.slice(0, 12)}…{hash.slice(-8)}</code>
        </span>
        <ChevronDown aria-hidden className="size-3 shrink-0 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <code className="mt-1 block break-all rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-4 text-muted">{textoCompleto}</code>
    </details>
  )
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

  const aislar = async () => {
    if (!detalle) return
    setAislando(true)
    setErrorAislar(false)
    const resultado = await aislarCorrupcion(detalle.id)
    setAislando(false)
    if (resultado === 'ok') setConfirmarAislar(false)
    else setErrorAislar(true)
  }

  return (
    <CompactWorkspace>
      <PageHeader eyebrow={t('nav.seccionCumplimiento')} titulo={t('trazabilidad.titulo')} descripcion={t('trazabilidad.descripcion')}>
        <Button onClick={() => void verificarIntegridad()} disabled={verificando}>
          <ShieldCheck />
          {verificando ? t('trazabilidad.verificando') : t('trazabilidad.verificar')}
        </Button>
      </PageHeader>

      {/* ── HU-47: banner de cadena comprometida ────────────── */}
      {/* `role="alert"`: una cadena de custodia comprometida es el equivalente
          documental de una excursión térmica. Se pintaba en rojo y nada más,
          de modo que quien no ve la pantalla no se enteraba (WCAG 4.1.3). */}
      {estadoCadena?.cadena_comprometida && (
        <Card className="mb-5 animate-rise border-clay-100 bg-clay-100/60">
          <CardContent role="alert" className="flex flex-wrap items-center gap-3 p-4">
            <AlertOctagon className="size-5 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-clay-700">{t('trazabilidad.cadenaComprometida')}</p>
              <p className="text-[13px] text-muted">{t('trazabilidad.cadenaComprometidaDetalle')}</p>
            </div>
            {usuario?.rol === 'administrador' && detalle && (
              <Button
                variant="danger"
                size="sm"
                className="shrink-0"
                onClick={() => setConfirmarAislar(true)}
              >
                {t('trazabilidad.aislar')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Resultado de verificación ───────────────────────── */}
      {verificacion && (
        <Card
          className={cn(
            'mb-5 animate-rise',
            verificacion.integra
              ? 'border-pine-200 bg-pine-100/60'
              : rupturaAislada
                ? 'border-honey-600/25 bg-honey-100/60'
                : 'border-clay-100 bg-clay-100/60',
          )}
        >
          <CardContent role="status" className="flex items-start gap-3 p-4">
            {verificacion.integra ? (
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-pine-600" aria-hidden />
            ) : rupturaAislada ? (
              <ShieldHalf className="mt-0.5 size-5 shrink-0 text-honey-700" aria-hidden />
            ) : (
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  'text-sm font-semibold',
                  verificacion.integra ? 'text-success-700' : rupturaAislada ? 'text-honey-700' : 'text-clay-700',
                )}
              >
                {verificacion.integra
                  ? t('trazabilidad.cadenaIntegra')
                  : rupturaAislada
                    ? t('trazabilidad.rupturaAislada')
                    : t('trazabilidad.cadenaRota')}
              </p>
              <p className="text-[13px] text-muted">
                {verificacion.integra
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

              {/* RF-15: «la cadena está rota en la posición 42» no permite
                  actuar. El auditor necesita saber **qué** registro es, de
                  cuándo, y en qué se diferencia el sello recalculado del
                  almacenado. El backend ya lo devolvía en
                  `detalle_inconsistencia`; la pantalla lo descartaba y solo lo
                  usaba para el botón de aislar. */}
              {!verificacion.integra && !rupturaAislada && detalle && (
                <dl
                  data-testid="detalle-inconsistencia"
                  className="mt-3 grid gap-x-4 gap-y-1.5 border-t border-clay-100 pt-3 text-[13px] sm:grid-cols-[auto_1fr]"
                >
                  <dt className="text-muted">{t('trazabilidad.registroAfectado')}</dt>
                  <dd className="nums break-all font-medium">{detalle.id}</dd>

                  <dt className="text-muted">{t('trazabilidad.evento')}</dt>
                  <dd className="font-medium">{etiquetaEvento(detalle.tipo_evento, t)}</dd>

                  <dt className="text-muted">{t('trazabilidad.fecha')}</dt>
                  <dd className="nums font-medium">{fechaHora(detalle.timestamp)}</dd>

                  {detalle.tipo_discrepancia && (
                    <>
                      <dt className="text-muted">{t('trazabilidad.tipoDiscrepancia')}</dt>
                      <dd className="font-medium">{t(`trazabilidad.discrepancia_${detalle.tipo_discrepancia}`)}</dd>
                    </>
                  )}

                  <dt className="text-muted">{t('trazabilidad.hashEsperado')}</dt>
                  <dd className="nums break-all text-success-700">{detalle.hash_esperado}</dd>

                  <dt className="text-muted">{t('trazabilidad.hashAlmacenado')}</dt>
                  <dd className="nums break-all text-clay-700">{detalle.hash_almacenado}</dd>

                  {verificacion.registros_posteriores_afectados > 0 && (
                    <>
                      <dt className="text-muted">{t('trazabilidad.posterioresAfectados')}</dt>
                      <dd className="nums font-medium text-clay-700">
                        {verificacion.registros_posteriores_afectados}
                      </dd>
                    </>
                  )}

                  {/* HU-26 escenario 2: una alteración puntual no invalida lo
                      posterior; se informa cuánto sigue enlazado. */}
                  {verificacion.registros_posteriores_afectados > 0 &&
                    verificacion.registros_posteriores_consistentes != null && (
                    <>
                      <dt className="text-muted">{t('trazabilidad.posterioresConsistentes')}</dt>
                      <dd className="nums font-medium">
                        {t('trazabilidad.posterioresConsistentesValor', {
                          c: verificacion.registros_posteriores_consistentes,
                          n: verificacion.registros_posteriores_afectados,
                        })}
                      </dd>
                    </>
                  )}

                  {(verificacion.total_rupturas ?? 0) > 1 && (
                    <>
                      <dt className="text-muted">{t('trazabilidad.totalRupturas')}</dt>
                      <dd className="nums font-medium text-clay-700">{verificacion.total_rupturas}</dd>
                    </>
                  )}
                </dl>
              )}

              <AlcanceVerificacion texto={verificacion.alcance} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-3 flex items-start gap-2 text-xs leading-5 text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p>{t('trazabilidad.cadenaExplicacion')}</p>
      </div>

      {/* ── HU-37: verificación acotada a un dispositivo y periodo ──── */}
      <Card className="mb-4 rounded-lg border border-border bg-surface shadow-none">
        <CardContent className="p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted">
            <ScanSearch className="size-4 text-pine-600" aria-hidden />
            {t('trazabilidad.verificarSegmento')}
          </p>
          <form
            className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault()
              if (!segmentoDeviceId || !segmentoDesde) return
              if (segmentoHasta && segmentoDesde > segmentoHasta) return
              const desdeISO = new Date(`${segmentoDesde}T00:00:00`).toISOString()
              const hastaISO = segmentoHasta
                ? new Date(`${segmentoHasta}T23:59:59.999`).toISOString()
                : new Date().toISOString()
              void verificarPorDispositivo(
                segmentoDeviceId,
                desdeISO,
                hastaISO,
              )
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
              <Input
                id="seg-desde"
                type="date"
                value={segmentoDesde}
                onChange={(e) => setSegmentoDesde(e.target.value)}
                required
                max={segmentoHasta || undefined}
                aria-describedby="segmento-desde-ayuda"
              />
            </div>
            <div>
              <Label htmlFor="seg-hasta">{t('historial.hasta')}</Label>
              <Input
                id="seg-hasta"
                type="date"
                value={segmentoHasta}
                onChange={(e) => setSegmentoHasta(e.target.value)}
                min={segmentoDesde || undefined}
                aria-describedby="segmento-hasta-ayuda"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={verificandoSegmento} className="w-full sm:w-auto">
                {verificandoSegmento ? t('trazabilidad.verificando') : t('trazabilidad.verificarSegmentoBoton')}
              </Button>
            </div>
          </form>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <p id="segmento-desde-ayuda">{t('trazabilidad.desdeAyuda')}</p>
            <p id="segmento-hasta-ayuda">{t('trazabilidad.hastaOpcional')}</p>
          </div>

          {errorSegmento && (
            <p role="alert" className="mt-3 rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700">
              {errorSegmento === 'rango_invalido'
                ? t('trazabilidad.rangoInvalido')
                : t('comunes.error')}
            </p>
          )}

          {verificacionSegmento && (
            <div
              role="status"
              className={cn(
                'mt-3 rounded-(--radius-field) border p-3',
                verificacionSegmento.integra
                  ? 'border-pine-200 bg-pine-100/60'
                  : 'border-clay-100 bg-clay-100/60',
              )}
            >
              <p
                className={cn(
                  'text-sm font-semibold',
                  verificacionSegmento.integra ? 'text-success-700' : 'text-clay-700',
                )}
              >
                {verificacionSegmento.integra
                  ? t('trazabilidad.segmentoIntegro')
                  : t('trazabilidad.segmentoRoto')}
              </p>
              <p className="text-[13px] text-muted">
                {t('trazabilidad.segmentoResumen', {
                  n: verificacionSegmento.total_bloques_verificados,
                  device: verificacionSegmento.device_id,
                })}
              </p>
              {verificacionSegmento.registros_del_dispositivo.length > 0 && (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[13px]">
                  {verificacionSegmento.registros_del_dispositivo.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="nums text-muted">{fechaHora(r.timestamp)}</span>
                      <span className="font-medium">{etiquetaEvento(r.tipo_evento, t)}</span>
                      <Badge variant={r.integro ? 'ok' : 'critical'}>
                        {r.integro ? t('trazabilidad.integro') : t('trazabilidad.corrupto')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <AlcanceVerificacion texto={verificacionSegmento.alcance} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Filtro por tipo ─────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-start gap-3 border-b border-border pb-4">
      <div className="w-full max-w-sm sm:w-72">
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
              {tipo}
            </option>
          ))}
        </NativeSelect>
      </div>
      {import.meta.env.MODE === 'demo' && (
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11"
          onClick={async () => {
            await apiClient.post('/api/demo/trazabilidad/simular-inconsistencia')
            await verificarIntegridad()
          }}
        >
          Simular inconsistencia (demo)
        </Button>
      )}

        <button
          type="button"
          aria-expanded={mostrarSellos}
          onClick={() => setMostrarSellos((actual) => !actual)}
          className="inline-flex min-h-11 items-center rounded-(--radius-field) border border-border bg-surface px-4 text-sm font-medium text-primary underline-offset-2 hover:bg-primary-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {mostrarSellos ? t('trazabilidad.ocultarSellos') : t('trazabilidad.mostrarSellos')}
        </button>
      </div>
      <div className="animate-rise [&_thead]:bg-cream-100" style={{ animationDelay: '60ms' }}>
        <Table mobileLayout="stack" className="table-fixed min-w-0" titulo={t('trazabilidad.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead className={mostrarSellos ? 'w-[21%]' : 'w-[30%]'}>{t('trazabilidad.fecha')}</TableHead>
              <TableHead className={mostrarSellos ? 'w-[26%]' : 'w-[40%]'}>{t('trazabilidad.evento')}</TableHead>
              <TableHead className={mostrarSellos ? 'w-[18%]' : 'w-[30%]'}>{t('historial.dispositivo')}</TableHead>
              {mostrarSellos && <TableHead className="w-[35%]">{t('trazabilidad.sellos')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableEmpty colSpan={mostrarSellos ? 4 : 3}>{t('app.cargando')}</TableEmpty>
            ) : registros.length === 0 ? (
              <TableEmpty colSpan={mostrarSellos ? 4 : 3}>
                <span className="inline-flex flex-col items-center gap-2">
                  <Link2 className="size-5 text-faint" aria-hidden />
                  {t('trazabilidad.sinRegistros')}
                </span>
              </TableEmpty>
            ) : (
              visibles.map((registro) => {
                // El registro señalado por la verificación se marca en la
                // propia tabla, no solo en la tarjeta de arriba: si el auditor
                // llega a la fila desplazándose, tiene que reconocerla.
                const corrupto = detalle?.id === registro.id
                return (
                  <TableRow
                    key={registro.id}
                    data-testid={corrupto ? 'fila-corrupta' : undefined}
                    className={cn(corrupto && 'bg-clay-100/70 hover:bg-clay-100')}
                  >
                    <TableCell data-label={t('trazabilidad.fecha')} className="nums whitespace-nowrap text-[13px]">
                      {corrupto && (
                        <span className="mr-1.5 font-semibold text-clay-700">
                          <span aria-hidden>⚠</span>
                          <span className="sr-only">{t('trazabilidad.registroAfectado')}: </span>
                        </span>
                      )}
                      {fechaHora(registro.timestamp)}
                    </TableCell>
                    <TableCell data-label={t('trazabilidad.evento')}>
                      <Badge variant="neutral">{etiquetaEvento(registro.tipo_evento, t)}</Badge>
                    </TableCell>
                    <TableCell data-label={t('historial.dispositivo')} className="text-[13px]">{registro.device_id ?? '—'}</TableCell>
                    {mostrarSellos && (
                      <TableCell data-label={t('trazabilidad.sellos')} className="min-w-0 px-2 py-1.5">
                        <div className="grid min-w-0 grid-cols-2 gap-1">
                          <SelloTecnico etiqueta={t('trazabilidad.hashAnterior')} hash={registro.previous_hash} textoCompleto={registro.previous_hash} />
                          <SelloTecnico etiqueta={t('trazabilidad.hash')} hash={registro.hash_actual} textoCompleto={registro.hash_actual} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <Paginacion total={registros.length} pagina={pagina} onCambiar={setPagina} tamano={tamanoPagina} />
      </div>

      {/* Aislar un registro inconsistente es irreversible y afecta los datos
          que quedan disponibles para revisión. Era la única acción destructiva
          del sistema que se ejecutaba con un solo clic, sin confirmación. */}
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
            <p className="nums mt-3 break-all rounded-(--radius-field) bg-cream-100 px-3 py-2 text-[13px]">
              {detalle.id}
            </p>
          )}
          {errorAislar && (
            <p
              role="alert"
              className="mt-3 rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700"
            >
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

/** HU-26 escenario 4: el resultado declara qué certifica y qué no. */
function AlcanceVerificacion({ texto }: { texto?: string }) {
  const { t } = useTranslation()
  return (
    <p
      data-testid="alcance-verificacion"
      className="mt-3 flex items-start gap-1.5 border-t border-border/70 pt-2 text-xs leading-5 text-muted"
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{texto ?? t('trazabilidad.alcanceVerificacion')}</span>
    </p>
  )
}
