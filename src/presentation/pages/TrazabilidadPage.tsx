import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertOctagon, Link2, ScanSearch, ShieldAlert, ShieldCheck } from 'lucide-react'

import { useTrazabilidad } from '@/application/hooks/useTrazabilidad'
import { useAuthStore } from '@/application/stores/authStore'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { rangoPagina } from '@/lib/paginacion'
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

function HashCorto({ hash }: { hash: string }) {
  return (
    <span className="nums text-xs text-muted" title={hash}>
      {hash.slice(0, 10)}…{hash.slice(-6)}
    </span>
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
  // HU-37: verificación acotada a un dispositivo y periodo.
  const [segmentoDeviceId, setSegmentoDeviceId] = useState('')
  const [segmentoDesde, setSegmentoDesde] = useState('')
  const [segmentoHasta, setSegmentoHasta] = useState('')
  // La lista completa puede tener miles de filas; solo se pinta la página
  // visible. Al cambiar la lista (filtro nuevo) se vuelve a la primera.
  const visibles = useMemo(
    () => registros.slice(...rangoPagina(pagina)),
    [registros, pagina],
  )
  const [tipoEvento, setTipoEvento] = useState('')
  const [mostrarSellos, setMostrarSellos] = useState(false)
  const [aislando, setAislando] = useState(false)
  const [confirmarAislar, setConfirmarAislar] = useState(false)
  const [errorAislar, setErrorAislar] = useState(false)
  const usuario = useAuthStore((s) => s.usuario)

  const detalle = verificacion?.detalle_inconsistencia ?? null

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
    <div>
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
            <AlertOctagon className="size-5 shrink-0 text-clay-600" aria-hidden />
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
              : 'border-clay-100 bg-clay-100/60',
          )}
        >
          <CardContent role="status" className="flex items-start gap-3 p-4">
            {verificacion.integra ? (
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-pine-600" aria-hidden />
            ) : (
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-clay-600" aria-hidden />
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  'text-sm font-semibold',
                  verificacion.integra ? 'text-success-700' : 'text-clay-700',
                )}
              >
                {verificacion.integra ? t('trazabilidad.cadenaIntegra') : t('trazabilidad.cadenaRota')}
              </p>
              <p className="text-[13px] text-muted">
                {verificacion.integra
                  ? t('trazabilidad.cadenaIntegraDetalle', { n: verificacion.total_registros })
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
              {!verificacion.integra && detalle && (
                <dl
                  data-testid="detalle-inconsistencia"
                  className="mt-3 grid gap-x-4 gap-y-1.5 border-t border-clay-100 pt-3 text-[13px] sm:grid-cols-[auto_1fr]"
                >
                  <dt className="text-muted">{t('trazabilidad.registroAfectado')}</dt>
                  <dd className="nums break-all font-medium">{detalle.id}</dd>

                  <dt className="text-muted">{t('trazabilidad.evento')}</dt>
                  <dd className="font-medium">{detalle.tipo_evento}</dd>

                  <dt className="text-muted">{t('trazabilidad.fecha')}</dt>
                  <dd className="nums font-medium">{fechaHora(detalle.timestamp)}</dd>

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
                </dl>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-(--radius-card) border border-border bg-surface px-4 py-3 text-sm text-muted">
        <span className="font-medium text-foreground">{t('trazabilidad.registroN')}</span>
        <span aria-hidden className="text-pine-600">→</span>
        <span>{t('trazabilidad.selloCompartido')}</span>
        <span aria-hidden className="text-pine-600">→</span>
        <span className="font-medium text-foreground">{t('trazabilidad.registroSiguiente')}</span>
        <span className="w-full text-xs">{t('trazabilidad.cadenaExplicacion')}</span>
      </div>

      {/* ── HU-37: verificación acotada a un dispositivo y periodo ──── */}
      <Card className="mb-5 animate-rise">
        <CardContent className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ScanSearch className="size-4 text-pine-600" aria-hidden />
            {t('trazabilidad.verificarSegmento')}
          </p>
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault()
              if (!segmentoDeviceId || !segmentoDesde || !segmentoHasta) return
              void verificarPorDispositivo(
                segmentoDeviceId,
                new Date(segmentoDesde).toISOString(),
                new Date(segmentoHasta).toISOString(),
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
                type="datetime-local"
                value={segmentoDesde}
                onChange={(e) => setSegmentoDesde(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="seg-hasta">{t('historial.hasta')}</Label>
              <Input
                id="seg-hasta"
                type="datetime-local"
                value={segmentoHasta}
                onChange={(e) => setSegmentoHasta(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={verificandoSegmento} className="w-full sm:w-auto">
                {verificandoSegmento ? t('trazabilidad.verificando') : t('trazabilidad.verificarSegmentoBoton')}
              </Button>
            </div>
          </form>

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
                      <span className="font-medium">{r.tipo_evento}</span>
                      <Badge variant={r.integro ? 'ok' : 'critical'}>
                        {r.integro ? t('trazabilidad.integro') : t('trazabilidad.corrupto')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Filtro por tipo ─────────────────────────────────── */}
      <div className="mb-4 max-w-64 animate-rise">
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

      <div className="animate-rise" style={{ animationDelay: '60ms' }}>
        <button
          type="button"
          aria-expanded={mostrarSellos}
          onClick={() => setMostrarSellos((actual) => !actual)}
          className="mb-3 rounded-md text-sm font-medium text-pine-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {mostrarSellos ? t('trazabilidad.ocultarSellos') : t('trazabilidad.mostrarSellos')}
        </button>
        <Table titulo={t('trazabilidad.titulo')} cargando={cargando}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('trazabilidad.fecha')}</TableHead>
              <TableHead>{t('trazabilidad.evento')}</TableHead>
              <TableHead>{t('historial.dispositivo')}</TableHead>
              {mostrarSellos && (
                <>
                  <TableHead title={t('trazabilidad.selloAyuda')} className="cursor-help">
                    {t('trazabilidad.hashAnterior')}
                  </TableHead>
                  <TableHead title={t('trazabilidad.selloAyuda')} className="cursor-help">
                    {t('trazabilidad.hash')}
                  </TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableEmpty colSpan={mostrarSellos ? 5 : 3}>{t('app.cargando')}</TableEmpty>
            ) : registros.length === 0 ? (
              <TableEmpty colSpan={mostrarSellos ? 5 : 3}>
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
                  <TableCell className="nums text-[13px]">
                    {corrupto && (
                      <span className="mr-1.5 font-semibold text-clay-700">
                        <span aria-hidden>⚠</span>
                        <span className="sr-only">{t('trazabilidad.registroAfectado')}: </span>
                      </span>
                    )}
                    {fechaHora(registro.timestamp)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{registro.tipo_evento}</Badge>
                  </TableCell>
                  <TableCell className="text-[13px]">{registro.device_id ?? '—'}</TableCell>
                  {mostrarSellos && (
                    <>
                      <TableCell><HashCorto hash={registro.previous_hash} /></TableCell>
                      <TableCell><HashCorto hash={registro.hash_actual} /></TableCell>
                    </>
                  )}
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <Paginacion total={registros.length} pagina={pagina} onCambiar={setPagina} />
      </div>

      {/* Aislar un registro corrupto es irreversible y afecta a la evidencia
          que se presenta en una inspección. Era la única acción destructiva
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
    </div>
  )
}
