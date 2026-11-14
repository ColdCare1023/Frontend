import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OctagonAlert, TriangleAlert } from 'lucide-react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { construirOpcionCurvaTermica } from '@/infrastructure/charts/curvaTermica'
import { useTemaResuelto } from '@/infrastructure/tema/tema'
import { fechaHora, hora as formatearHora } from '@/lib/formato'
import { clsx } from 'clsx'
import { GraficaDiferida } from '../../components/GraficaDiferida'
import { Paginacion } from '../../components/Paginacion'
import { RiskBadge } from '../../components/RiskBadge'
import { Button } from '../../components/ui/button'
import { Esqueleto } from '../../components/ui/esqueleto'
import { Segmentado } from '../../components/ui/segmentado'
import { useReloj } from '../../hooks/useReloj'
import { resumenVentana } from './utilidades'

// HU-31 criterio 4: opciones de rango para la curva térmica del dashboard.
// 24 h es el valor por defecto exigido por el criterio; las demás son la
// forma de "ampliar o modificar el rango" que pide el mismo criterio sin
// duplicar el panel de filtros completo de HU-36 (ese vive en Historial).
export const OPCIONES_VENTANA_HORAS = [1, 24, 24 * 7] as const

const FILAS_LISTA = 5

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

/** Vista Lista (alternativa completa a la gráfica, WCAG 1.1.1): 5 filas por página, la más reciente primero. */
function TablaLecturasVentana({ serie, titulo }: { serie: readonly LecturaTermica[]; titulo: string }) {
  const { t } = useTranslation()
  const [pagina, setPagina] = useState(1)
  const ordenadas = useMemo(() => [...serie].reverse(), [serie])
  const visibles = ordenadas.slice((pagina - 1) * FILAS_LISTA, pagina * FILAS_LISTA)
  const columnas = [
    t('historial.fecha'),
    t('dashboard.tempInterna'),
    t('dashboard.tempAmbiental'),
    t('dashboard.humedad'),
    t('historial.riesgo'),
    t('dashboard.eventoGrafica'),
  ]
  return (
    <div className="flex h-full min-h-0 flex-col animate-(--animate-fade)">
      <div className="min-h-0 flex-1 overflow-auto rounded-(--radius-field) border border-border">
        <table className="w-full text-left text-meta">
          <caption className="sr-only">{titulo}</caption>
          <thead className="sticky top-0 bg-surface-sunken">
            <tr className="h-9">
              {columnas.map((columna) => (
                <th key={columna} scope="col" className="px-3 font-medium whitespace-nowrap text-muted">
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibles.map((lectura) => (
              <tr key={lectura.id || lectura.timestamp} className="h-9">
                <td className="nums px-3 whitespace-nowrap text-muted">
                  <time dateTime={lectura.timestamp} title={fechaHora(lectura.timestamp)}>
                    {formatearHora(lectura.timestamp)}
                  </time>
                </td>
                <td className="nums px-3 font-semibold text-foreground">{lectura.temperatura_interna?.toFixed(1) ?? '—'}</td>
                <td className="nums px-3">{lectura.temperatura_ambiental?.toFixed(1) ?? '—'}</td>
                <td className="nums px-3">{lectura.humedad_ambiental?.toFixed(0) ?? '—'}</td>
                <td className="px-3">
                  <RiskBadge nivel={lectura.riesgo_efectivo} />
                </td>
                <td className="px-3">{lectura.excursion_confirmada ? t('dashboard.excursionEvento') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion total={ordenadas.length} pagina={pagina} onCambiar={setPagina} tamano={FILAS_LISTA} />
    </div>
  )
}

/**
 * Curva de la ventana (Dribbble D1, Finance Bento): título, selector de
 * periodo, vista Gráfica/Lista y la fila de cifras pegada a la curva. El
 * crosshair desglosa interna, ambiente, humedad y puerta del instante.
 */
export const CeldaCurva = memo(function CeldaCurva({
  serie,
  ultimaPresente,
  estadoHistorial,
  reintentar,
  horasVentana,
  onCambiarVentana,
  ventana,
}: {
  serie: LecturaTermica[]
  ultimaPresente: boolean
  estadoHistorial: 'cargando' | 'completo' | 'error'
  reintentar: () => void
  horasVentana: number
  onCambiarVentana: (horas: number) => void
  ventana: string
}) {
  const { t } = useTranslation()
  // Cuarto de minuto en curso: la ventana termina en «ahora» y avanza cada 15 s.
  const marcaVentana = Math.floor(useReloj(15_000) / 15_000)
  const [vista, setVista] = useState<'grafica' | 'lista'>('grafica')
  const tema = useTemaResuelto()
  const resumen = useMemo(() => resumenVentana(serie), [serie])

  const opcion = useMemo(() => {
    const hasta = Math.max(marcaVentana * 15_000, Date.parse(serie.at(-1)?.timestamp ?? '') || 0)
    const base = construirOpcionCurvaTermica(
      serie,
      {
        interna: t('dashboard.tempInterna'),
        ambiental: t('dashboard.tempAmbiental'),
        rangoEsperado: t('dashboard.rangoEsperadoCorto'),
        ahora: t('dashboard.ejeAhora'),
        excursion: t('dashboard.graficaExcursion'),
        sinDatos: t('dashboard.graficaSinDatos'),
      },
      { desde: hasta - horasVentana * 60 * 60 * 1000, hasta },
      tema,
    )
    // Desglose del instante (FB): la lectura completa, no solo la serie bajo el cursor.
    const porInstante = new Map<number, LecturaTermica>()
    for (const lectura of serie) porInstante.set(Date.parse(lectura.timestamp), lectura)
    const valor = (v: number | null | undefined, unidad: string, decimales = 1) =>
      v == null ? '—' : `${v.toFixed(decimales)} ${unidad}`
    const formatter = (params: unknown) => {
      const lista = Array.isArray(params) ? params : [params]
      const primero = lista[0] as { axisValue?: number; value?: [number, number] } | undefined
      const instante = typeof primero?.axisValue === 'number' ? primero.axisValue : primero?.value?.[0]
      const lectura = instante != null ? porInstante.get(instante) : undefined
      if (!lectura) return ''
      const filas: Array<[string, string]> = [
        [t('dashboard.tempInterna'), valor(lectura.temperatura_interna, '°C')],
        [t('dashboard.ambienteCorto'), valor(lectura.temperatura_ambiental, '°C')],
        [t('dashboard.humedadCorta'), valor(lectura.humedad_ambiental, '%', 0)],
      ]
      if (lectura.apertura_refrigerador !== null && lectura.apertura_refrigerador !== undefined) {
        filas.push([t('dashboard.puerta'), lectura.apertura_refrigerador ? t('dashboard.puertaAbierta') : t('dashboard.puertaCerrada')])
      }
      return [
        `<div style="font-weight:600;margin-bottom:4px">${escapar(fechaHora(lectura.timestamp))}</div>`,
        ...filas.map(
          ([k, v]) =>
            `<div style="display:flex;justify-content:space-between;gap:16px"><span>${escapar(k)}</span><b style="font-variant-numeric:tabular-nums">${escapar(v)}</b></div>`,
        ),
        lectura.excursion_confirmada ? `<div style="margin-top:4px;font-weight:600">${escapar(t('dashboard.graficaExcursion'))}</div>` : '',
      ].join('')
    }
    const tooltip = (base as { tooltip?: Record<string, unknown> }).tooltip ?? {}
    return { ...base, tooltip: { ...tooltip, formatter } }
    // Con el tema cambian los colores del canvas (tokens CSS): se reconstruye.
  }, [serie, t, horasVentana, marcaVentana, tema])

  const titulo = t('dashboard.graficaEtiqueta', { n: serie.length })

  let cuerpo: React.ReactNode
  if (!ultimaPresente && estadoHistorial === 'cargando') {
    cuerpo = <Esqueleto className="h-full rounded-(--radius-field)" />
  } else if (estadoHistorial === 'error' && serie.length === 0) {
    cuerpo = (
      <div role="alert" className="flex h-full flex-col items-start justify-center gap-3 rounded-(--radius-field) border border-dashed border-border p-4">
        <p className="flex items-center gap-2 text-body font-medium text-danger-700">
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          {t('dashboard.errorHistorial')}
        </p>
        <Button variant="secondary" size="sm" onClick={reintentar}>
          {t('comunes.reintentar')}
        </Button>
      </div>
    )
  } else if (serie.length === 0 && estadoHistorial !== 'cargando') {
    cuerpo = (
      <div role="status" className="trama-sin-datos flex h-full items-center justify-center rounded-(--radius-field) text-body text-muted">
        <span className="rounded-(--radius-small) bg-surface px-2 py-1">{t('dashboard.curvaSinLecturas', { ventana })}</span>
      </div>
    )
  } else if (vista === 'lista') {
    cuerpo = <TablaLecturasVentana key={horasVentana} serie={serie} titulo={titulo} />
  } else {
    cuerpo = (
      <div className="h-full animate-(--animate-fade)">
        <GraficaDiferida option={opcion} height="100%" ariaLabel={titulo} ariaDescribedBy="curva-resumen" />
      </div>
    )
  }

  return (
    <section aria-labelledby="curva-titulo" className="superficie col-span-4 flex min-w-0 flex-col p-4 sm:col-span-8 lg:col-span-8 lg:h-[360px] xl:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <h2 id="curva-titulo" className="text-title text-foreground">
            {t('dashboard.curvaTermica')}
          </h2>
          <p className="nums text-meta text-faint">
            {t('dashboard.ultimasLecturas', { n: serie.length })} · {t('dashboard.rangoConservacion')}
          </p>
        </div>
        {estadoHistorial === 'cargando' && ultimaPresente && (
          <span role="status" className="text-meta text-muted">
            {t('app.cargando')}
          </span>
        )}
        {/* HU-31 criterio 4: ventana de 24 h por defecto, con opción de ampliar o acotar sin salir del monitoreo. */}
        <Segmentado
          etiqueta={t('dashboard.rangoVentana')}
          valor={horasVentana}
          onCambiar={onCambiarVentana}
          opciones={OPCIONES_VENTANA_HORAS.map((horas) => ({
            valor: horas,
            etiqueta: horas === 1 ? t('dashboard.ventana1h') : horas === 24 ? t('dashboard.ventana24h') : t('dashboard.ventana7d'),
          }))}
        />
        <Segmentado
          etiqueta={t('dashboard.vistaCurva')}
          valor={vista}
          onCambiar={setVista}
          opciones={[
            { valor: 'grafica', etiqueta: t('dashboard.vistaGrafica') },
            { valor: 'lista', etiqueta: t('dashboard.vistaLista') },
          ]}
        />
      </div>
      {resumen && (
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-meta text-muted">
          {(
            [
              ['dashboard.resumenMinima', `${resumen.minima.toFixed(1)} °C`, false],
              ['dashboard.resumenMaxima', `${resumen.maxima.toFixed(1)} °C`, false],
              ['dashboard.resumenPromedio', `${resumen.promedio.toFixed(1)} °C`, false],
              ['dashboard.resumenFueraRango', String(resumen.fueraDeRango), resumen.fueraDeRango > 0],
            ] as const
          ).map(([clave, valor, alerta]) => (
            <div key={clave} className="flex items-baseline gap-1.5">
              <dt>{t(clave)}</dt>
              <dd className={clsx('nums flex items-center gap-1 text-body font-semibold', alerta ? 'text-danger-700' : 'text-foreground')}>
                {alerta && <OctagonAlert aria-hidden className="size-3.5" />}
                {valor}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p id="curva-resumen" className="sr-only">
        {resumen
          ? t('dashboard.resumenCurva', {
              ventana,
              min: resumen.minima.toFixed(1),
              max: resumen.maxima.toFixed(1),
              prom: resumen.promedio.toFixed(1),
              fuera: resumen.fueraDeRango,
            })
          : t('dashboard.curvaSinLecturas', { ventana })}
      </p>
      <div className="mt-3 h-[220px] min-h-0 sm:h-[260px] lg:h-auto lg:flex-1">{cuerpo}</div>
    </section>
  )
})
