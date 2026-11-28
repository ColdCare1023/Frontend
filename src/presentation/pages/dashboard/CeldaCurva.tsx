import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarX2, Info, OctagonAlert, TriangleAlert } from 'lucide-react'

import type { CoberturaHistorial } from '@/application/hooks/useMonitoreoTermico'
import { estadoRiesgoDe, lecturaSinHora, serieGraficable, type LecturaTermica } from '@/domain/entities/LecturaTermica'
import { resumenCombinado, type ResumenCurva, type SerieTermica } from '@/domain/entities/SerieTermica'
import { anotarCalibracionVencida } from '@/infrastructure/charts/calibracionCurva'
import { construirOpcionCurvaAgregada, puntosCurvaAgregada, type PuntoCurva } from '@/infrastructure/charts/curvaAgregada'
import { construirOpcionCurvaTermica } from '@/infrastructure/charts/curvaTermica'
import { useTemaResuelto } from '@/infrastructure/tema/tema'
import { fechaDia, fechaHora, hora as formatearHora } from '@/lib/formato'
import { clsx } from 'clsx'
import { GraficaDiferida } from '../../components/GraficaDiferida'
import { HoraLectura } from '../../components/HoraLectura'
import { Paginacion } from '../../components/Paginacion'
import { RiskBadge } from '../../components/RiskBadge'
import { Button } from '../../components/ui/button'
import { Esqueleto } from '../../components/ui/esqueleto'
import { DECIMALES_HUMEDAD } from '../../components/ui/formato-cifra'
import { Segmentado } from '../../components/ui/segmentado'
import { useReloj } from '../../hooks/useReloj'
import { etiquetaIntervalo, resumenVentana } from './utilidades'

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
                  {/* HU-07: un arranque sin hora sincronizada se rotula «Sin hora». */}
                  <HoraLectura lectura={lectura} formato="hora" />
                </td>
                <td className="nums px-3 font-semibold text-foreground">{lectura.temperatura_interna?.toFixed(1) ?? '—'}</td>
                <td className="nums px-3">{lectura.temperatura_ambiental?.toFixed(1) ?? '—'}</td>
                <td className="nums px-3">{lectura.humedad_ambiental?.toFixed(DECIMALES_HUMEDAD) ?? '—'}</td>
                <td className="px-3">
                  <RiskBadge nivel={estadoRiesgoDe(lectura)} />
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

const valorCon = (v: number | null | undefined, unidad: string, decimales = 1) =>
  v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(decimales)} ${unidad}`

const filaTooltip = ([k, v]: [string, string]) =>
  `<div style="display:flex;justify-content:space-between;gap:16px"><span>${escapar(k)}</span><b style="font-variant-numeric:tabular-nums">${escapar(v)}</b></div>`

interface AvisoCurva {
  clave: string
  texto: string
  tono: 'aviso' | 'info'
}

/**
 * Curva de la ventana (Dribbble D1, Finance Bento): título, selector de
 * periodo, vista Gráfica/Lista y la fila de cifras pegada a la curva. El
 * crosshair desglosa interna, ambiente, humedad y puerta del instante.
 *
 * HU-31: con `agregada` (24 h y 7 d) la curva y el resumen cubren el periodo
 * completo con la serie agregada del backend; sin ella (1 h o backend
 * anterior) se dibujan las lecturas crudas y, si el historial vino recortado
 * (`X-Total-Count` mayor que lo recibido), se avisa en vez de callarlo.
 */
export const CeldaCurva = memo(function CeldaCurva({
  serie,
  ultimaPresente,
  estadoHistorial,
  reintentar,
  horasVentana,
  onCambiarVentana,
  ventana,
  agregada = null,
  resumen: resumenExterno,
  cobertura = null,
  calibracionVencidaDesde = null,
  vencimientoCalibracion = null,
}: {
  serie: LecturaTermica[]
  ultimaPresente: boolean
  estadoHistorial: 'cargando' | 'completo' | 'error'
  reintentar: () => void
  horasVentana: number
  onCambiarVentana: (horas: number) => void
  ventana: string
  /** HU-31: serie agregada del periodo completo (null: lecturas crudas). */
  agregada?: SerieTermica | null
  /** Resumen ya calculado (el de la serie agregada); si falta, el de lo crudo. */
  resumen?: ResumenCurva | null
  /** Lecturas crudas recibidas frente al total de la ventana. */
  cobertura?: CoberturaHistorial | null
  /** HU-30 esc. 3: desde cuándo (ms) el sensor en pantalla tiene la calibración vencida. */
  calibracionVencidaDesde?: number | null
  vencimientoCalibracion?: string | null
}) {
  const { t } = useTranslation()
  // Cuarto de minuto en curso: la ventana termina en «ahora» y avanza cada 15 s.
  const marcaVentana = Math.floor(useReloj(15_000) / 15_000)
  const [vista, setVista] = useState<'grafica' | 'lista'>('grafica')
  const tema = useTemaResuelto()
  const resumenPropio = useMemo(
    () => (resumenExterno !== undefined ? null : agregada ? resumenCombinado(agregada, serie) : resumenVentana(serie)),
    [resumenExterno, agregada, serie],
  )
  const resumen = resumenExterno === undefined ? resumenPropio : resumenExterno
  // HU-07: lo que se dibuja (sin las lecturas sin hora, en su hora de captura).
  const graficable = useMemo(() => serieGraficable(serie), [serie])
  const puntos = useMemo(() => (agregada ? puntosCurvaAgregada(agregada, serie) : null), [agregada, serie])
  const intervalo = agregada ? etiquetaIntervalo(agregada.bucket_segundos) : null

  const opcion = useMemo(() => {
    const ultimoMs = puntos ? (puntos.at(-1)?.x ?? 0) : Date.parse(graficable.at(-1)?.timestamp ?? '') || 0
    const hasta = Math.max(marcaVentana * 15_000, ultimoMs)
    const rango = { desde: hasta - horasVentana * 60 * 60 * 1000, hasta }
    const etiquetas = {
      interna: t('dashboard.tempInterna'),
      ambiental: t('dashboard.tempAmbiental'),
      rangoEsperado: t('dashboard.rangoEsperadoCorto'),
      ahora: t('dashboard.ejeAhora'),
      excursion: t('dashboard.graficaExcursion'),
      sinDatos: t('dashboard.graficaSinDatos'),
      bufferAgotado: t('dashboard.graficaBufferAgotado'),
    }
    const base =
      puntos && agregada
        ? construirOpcionCurvaAgregada(puntos, agregada, etiquetas, rango, tema)
        : construirOpcionCurvaTermica(serie, etiquetas, rango, tema)
    // Desglose del instante (FB): la lectura completa, no solo la serie bajo el cursor.
    const porInstante = new Map<number, LecturaTermica>()
    const porPunto = new Map<number, PuntoCurva>()
    if (puntos) for (const punto of puntos) porPunto.set(punto.x, punto)
    else for (const lectura of graficable) porInstante.set(Date.parse(lectura.timestamp), lectura)
    const detalleLectura = (lectura: LecturaTermica) => {
      const filas: Array<[string, string]> = [
        [t('dashboard.tempInterna'), valorCon(lectura.temperatura_interna, '°C')],
        [t('dashboard.ambienteCorto'), valorCon(lectura.temperatura_ambiental, '°C')],
        [t('dashboard.humedadCorta'), valorCon(lectura.humedad_ambiental, '%', DECIMALES_HUMEDAD)],
      ]
      if (lectura.apertura_refrigerador !== null && lectura.apertura_refrigerador !== undefined) {
        filas.push([t('dashboard.puerta'), lectura.apertura_refrigerador ? t('dashboard.puertaAbierta') : t('dashboard.puertaCerrada')])
      }
      return [
        `<div style="font-weight:600;margin-bottom:4px">${escapar(fechaHora(lectura.timestamp))}</div>`,
        ...filas.map(filaTooltip),
        lectura.excursion_confirmada ? `<div style="margin-top:4px;font-weight:600">${escapar(t('dashboard.graficaExcursion'))}</div>` : '',
      ].join('')
    }
    const detallePunto = (punto: PuntoCurva) => {
      if (punto.lectura) return detalleLectura(punto.lectura)
      const { interna } = punto
      const filas: Array<[string, string]> = [
        [t('dashboard.tempInterna'), valorCon(interna.promedio, '°C')],
        [t('dashboard.tooltipExtremos'), interna.min == null ? '—' : t('dashboard.tooltipMinMax', { min: interna.min.toFixed(1), max: (interna.max ?? interna.min).toFixed(1) })],
        [t('dashboard.ambienteCorto'), valorCon(punto.ambiental.promedio, '°C')],
        [t('dashboard.humedadCorta'), valorCon(punto.humedad.promedio, '%', DECIMALES_HUMEDAD)],
      ]
      return [
        `<div style="font-weight:600">${escapar(`${fechaHora(new Date(punto.inicio).toISOString())} – ${formatearHora(new Date(punto.fin).toISOString())}`)}</div>`,
        `<div style="margin-bottom:4px;opacity:.8">${escapar(t('dashboard.tooltipLecturas', { count: punto.lecturas, intervalo: intervalo ?? '' }))}</div>`,
        ...filas.map(filaTooltip),
        punto.excursiones > 0
          ? `<div style="margin-top:4px;font-weight:600">${escapar(t('dashboard.tooltipExcursiones', { count: punto.excursiones }))}</div>`
          : '',
      ].join('')
    }
    const formatter = (params: unknown) => {
      const lista = Array.isArray(params) ? params : [params]
      const primero = lista[0] as { axisValue?: number; value?: [number, number] } | undefined
      const instante = typeof primero?.axisValue === 'number' ? primero.axisValue : primero?.value?.[0]
      if (instante == null) return ''
      if (puntos) {
        const punto = porPunto.get(instante)
        return punto ? detallePunto(punto) : ''
      }
      const lectura = porInstante.get(instante)
      return lectura ? detalleLectura(lectura) : ''
    }
    const tooltip = (base as { tooltip?: Record<string, unknown> }).tooltip ?? {}
    const conTooltip = { ...base, tooltip: { ...tooltip, formatter } }
    if (calibracionVencidaDesde === null) return conTooltip
    return anotarCalibracionVencida(
      conTooltip,
      [{ desde: Math.max(calibracionVencidaDesde, hasta - horasVentana * 60 * 60 * 1000), hasta, etiqueta: t('dashboard.graficaCalibracionVencida') }],
      tema,
    )
    // Con el tema cambian los colores del canvas (tokens CSS): se reconstruye.
  }, [serie, graficable, puntos, agregada, intervalo, t, horasVentana, marcaVentana, tema, calibracionVencidaDesde])

  // HU-31: lo crudo no cubre la ventana si el total supera lo recibido.
  const recorte =
    cobertura && cobertura.total !== null && cobertura.total > cobertura.recibidas
      ? { mostradas: cobertura.recibidas.toLocaleString(), total: cobertura.total.toLocaleString() }
      : null
  const sinHora = agregada ? agregada.lecturas_sin_hora : serie.filter((l) => lecturaSinHora(l)).length
  const avisos: AvisoCurva[] = []
  if (recorte && !agregada) avisos.push({ clave: 'recorte', tono: 'aviso', texto: t('dashboard.curvaRecortada', recorte) })
  if (recorte && agregada && vista === 'lista') avisos.push({ clave: 'lista', tono: 'info', texto: t('dashboard.listaRecortada', recorte) })
  if (sinHora > 0 && vista === 'grafica') avisos.push({ clave: 'sin-hora', tono: 'info', texto: t('dashboard.lecturasSinHoraCurva', { count: sinHora }) })
  if (agregada?.brechas_truncadas && vista === 'grafica') avisos.push({ clave: 'brechas', tono: 'info', texto: t('dashboard.brechasTruncadas') })

  const lecturasEnCurva = agregada ? (resumen?.lecturas ?? agregada.total_lecturas) : serie.length
  const hayDatos = puntos ? puntos.length > 0 : serie.length > 0
  const titulo = intervalo
    ? t('dashboard.graficaEtiquetaAgregada', { n: lecturasEnCurva.toLocaleString(), ventana, intervalo })
    : t('dashboard.graficaEtiqueta', { n: serie.length })

  let cuerpo: React.ReactNode
  if (!ultimaPresente && estadoHistorial === 'cargando') {
    cuerpo = <Esqueleto className="h-full rounded-(--radius-field)" />
  } else if (estadoHistorial === 'error' && !hayDatos) {
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
  } else if (!hayDatos && estadoHistorial !== 'cargando') {
    cuerpo = (
      <div role="status" className="flex h-full items-center justify-center rounded-(--radius-field) bg-surface-sunken text-center text-body text-muted">
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
    <section aria-labelledby="curva-titulo" className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <h2 id="curva-titulo" className="text-title text-foreground">
            {t('dashboard.curvaTermica')}
          </h2>
          <p className="nums text-meta text-faint">
            {intervalo
              ? t('dashboard.lecturasAgregadas', { n: lecturasEnCurva.toLocaleString(), intervalo })
              : t('dashboard.ultimasLecturas', { n: serie.length })}
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
      {calibracionVencidaDesde !== null && (
        <p role="note" className="mt-2 flex items-start gap-1.5 text-meta font-medium text-warning-700">
          <CalendarX2 aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {t('dashboard.curvaCalibracionVencida', { fecha: fechaDia(vencimientoCalibracion) })}
        </p>
      )}
      {avisos.map((aviso) => (
        <p
          key={aviso.clave}
          role="note"
          data-testid={`aviso-curva-${aviso.clave}`}
          className={clsx('mt-1.5 flex items-start gap-1.5 text-meta', aviso.tono === 'aviso' ? 'font-medium text-warning-700' : 'text-muted')}
        >
          {aviso.tono === 'aviso' ? (
            <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          ) : (
            <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          )}
          {aviso.texto}
        </p>
      ))}
      <p id="curva-resumen" className="sr-only">
        {intervalo && `${t('dashboard.franjaAgregada', { intervalo })} `}
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
      <div className={clsx("mt-3 min-h-0", hayDatos ? "h-[165px] sm:h-[185px]" : "min-h-16 [&>div]:min-h-16")}>{cuerpo}</div>
      {resumen && (
        <details className="mt-1 text-meta text-muted">
          <summary className="w-fit cursor-pointer rounded-sm py-2 font-medium focus-visible:outline-ring">{t('dashboard.estadisticasCurva')}</summary>
          <dl className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-meta text-muted">
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
        </details>
      )}
    </section>
  )
})
