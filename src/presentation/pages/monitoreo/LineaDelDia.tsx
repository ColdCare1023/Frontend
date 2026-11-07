import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { construirOpcionCurvaTermica } from '@/infrastructure/charts/curvaTermica'
import { EChartWrapper } from '@/infrastructure/charts/EChartWrapper'
import { useTemaResuelto } from '@/infrastructure/tema/tema'
import { cn } from '@/lib/utils'
import { Detalles } from '@/presentation/components/ui/detalles'
import { Indicador, Indicadores } from '@/presentation/components/ui/indicadores'
import { Segmentado } from '@/presentation/components/ui/segmentado'
import { useCoincideMedia } from '@/presentation/components/ui/useCoincideMedia'
import { anotacionesDelDia, conAnotaciones } from './anotaciones'
import { porcentajeEnRango } from './estadoEquipo'
import { useDelReloj } from './reloj'
import { fraseDelPeriodo } from './resumenPeriodo'
import { TablaDatos } from './TablaDatos'

// HU-31 criterio 4: opciones de rango para la curva térmica del dashboard.
// 24 h es el valor por defecto exigido por el criterio; las demás son la
// forma de "ampliar o modificar el rango" que pide el mismo criterio sin
// duplicar el panel de filtros completo de HU-36 (ese vive en Historial,
// sobre datos ya cerrados — este es el propio monitoreo en vivo).
const OPCIONES_VENTANA_HORAS = [1, 24, 24 * 7] as const
const TRAMOS = 48

type EstadoTramo = 'vacio' | 'ok' | 'aviso' | 'critico'

function resumenVentana(serie: LecturaTermica[]) {
  const temps = serie
    .map((l) => l.temperatura_interna)
    .filter((v): v is number => v != null)
  if (temps.length === 0) return null
  const fueraDeRango = serie.filter((l) => l.excursion_confirmada).length
  return {
    minima: Math.min(...temps),
    maxima: Math.max(...temps),
    promedio: temps.reduce((suma, v) => suma + v, 0) / temps.length,
    // HU-34: cuenta excursiones CONFIRMADAS por la regla directa de rango,
    // no por lo que haya clasificado la IA (`nivel_riesgo`/model_class).
    fueraDeRango,
    enRango: porcentajeEnRango(serie.filter((l) => l.temperatura_interna != null && !l.excursion_confirmada).length, temps.length),
  }
}

/**
 * Tira de la jornada (patrón «uptime» de Better Stack), pegada bajo el eje: cada tramo es un pedazo de
 * la ventana. Se calcula de las lecturas reales: un tramo sin lecturas se pinta como «sin datos»,
 * nunca como normal.
 */
const TiraJornada = memo(function TiraJornada({ serie, desde, hasta }: { serie: LecturaTermica[]; desde: number; hasta: number }) {
  const tramos = useMemo(() => {
    const paso = (hasta - desde) / TRAMOS
    const estados: EstadoTramo[] = Array.from({ length: TRAMOS }, () => 'vacio')
    const prioridad = { vacio: 0, ok: 1, aviso: 2, critico: 3 }
    for (const lectura of serie) {
      const indice = Math.floor((Date.parse(lectura.timestamp) - desde) / paso)
      if (indice < 0 || indice >= TRAMOS) continue
      const estado = lectura.excursion_confirmada || lectura.riesgo_efectivo === 'excursion_critica'
        ? 'critico'
        : lectura.riesgo_efectivo === 'riesgo_preventivo'
          ? 'aviso'
          : 'ok'
      if (prioridad[estado] > prioridad[estados[indice]]) estados[indice] = estado
    }
    return estados
  }, [serie, desde, hasta])

  return (
    <div aria-hidden className="tira-dia">
      {tramos.map((estado, indice) => (
        <span key={indice} data-estado={estado} />
      ))}
    </div>
  )
})

const NOMBRE_VENTANA: Record<number, string> = { 1: 'dashboard.ventanaNombre1h', 24: 'dashboard.ventanaNombre24h', 168: 'dashboard.ventanaNombre7d' }

/**
 * La línea del día: debajo de los campos, sin caja alrededor. Arriba, una frase que la resume
 * («Hoy estuvo dentro del rango todo el día», «Salió del rango 2 veces») y solo si las lecturas lo
 * sostienen; la gráfica manda; las cifras de la ventana quedan en «Ver más».
 */
export const LineaDelDia = memo(function LineaDelDia({
  serie,
  nombreEquipo,
  horasVentana,
  onVentana,
  cargando,
  equipos,
  deviceId,
  onEquipo,
  enSilencio = false,
}: {
  serie: LecturaTermica[]
  nombreEquipo: string | null
  horasVentana: number
  onVentana: (horas: number) => void
  cargando: boolean
  equipos: Dispositivo[]
  deviceId: string | null
  onEquipo: (id: string) => void
  /** El equipo dejó de reportar: la frase no puede decir «todo el día». */
  enSilencio?: boolean
}) {
  const { t } = useTranslation()
  const tema = useTemaResuelto()
  const compacto = !useCoincideMedia('(min-width: 640px)')
  const resumen = useMemo(() => resumenVentana(serie), [serie])

  // La ventana termina en «ahora» y avanza sola: se recalcula cada 15 s
  // (no cada segundo, que repintaría miles de puntos) y con cada lectura.
  const marcaVentana = useDelReloj((ahora) => Math.floor(ahora / 15_000))
  const ventana = useMemo(() => {
    const hasta = Math.max(marcaVentana * 15_000, Date.parse(serie.at(-1)?.timestamp ?? '') || 0)
    return { desde: hasta - horasVentana * 60 * 60 * 1000, hasta }
  }, [marcaVentana, serie, horasVentana])

  const frase = useMemo(() => fraseDelPeriodo(serie, ventana, horasVentana, enSilencio), [serie, ventana, horasVentana, enSilencio])

  // Con el tema cambian los colores del canvas (tokens CSS): se reconstruye.
  const opcionBase = useMemo(
    () =>
      construirOpcionCurvaTermica(
        serie,
        {
          interna: t('dashboard.tempInterna'),
          ambiental: t('dashboard.tempAmbiental'),
          rangoEsperado: t('dashboard.rangoEsperadoCorto'),
          ahora: t('dashboard.ejeAhora'),
          excursion: t('dashboard.graficaExcursion'),
          sinDatos: t('dashboard.graficaSinDatos'),
        },
        ventana,
        tema,
      ),
    [serie, t, ventana, tema],
  )
  const anotaciones = useMemo(
    () => anotacionesDelDia(serie, ventana, compacto).map((a) => ({ ...a, texto: t(a.clave, a.opciones) })),
    [serie, ventana, compacto, t],
  )
  // Con el mismo objeto de base y las mismas notas, la gráfica no repinta nada.
  const claveNotas = anotaciones.map((a) => `${a.ms}:${a.texto}`).join('|')
  const opcion = useMemo(
    () => conAnotaciones(opcionBase, anotaciones, ventana),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las notas cambian solo si cambia su clave
    [opcionBase, claveNotas],
  )

  return (
    <section aria-labelledby="linea-dia-titulo" className="linea-dia">
      <div className="linea-dia__cabeza">
        <div className="min-w-0">
          <h2 id="linea-dia-titulo" className="linea-dia__titulo">
            <span className="sr-only">{t('dashboard.curvaTermica')}:</span>{' '}
            {cargando && serie.length === 0 ? t('dashboard.curvaTermica') : t(frase.clave, { count: frase.count })}
          </h2>
          <p className="linea-dia__sub">
            {[nombreEquipo, t(NOMBRE_VENTANA[horasVentana] ?? 'dashboard.ventanaNombre24h'), t('dashboard.rangoConservacion')].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="linea-dia__controles">
          {cargando && <span role="status" className="text-xs text-muted">{t('app.cargando')}</span>}
          {equipos.length > 1 && deviceId && (
            <div className="linea-dia__equipos">
              <Segmentado
                etiqueta={t('dashboard.equipo')}
                valor={deviceId}
                onCambiar={onEquipo}
                opciones={equipos.map((equipo) => ({ valor: equipo.id, etiqueta: equipo.nombre || equipo.id }))}
              />
            </div>
          )}
          {/* HU-31 criterio 4: ventana de 24 h por defecto, con opción
              de ampliar o acotar sin salir del dashboard. */}
          <Segmentado
            etiqueta={t('dashboard.rangoVentana')}
            valor={horasVentana}
            onCambiar={onVentana}
            opciones={OPCIONES_VENTANA_HORAS.map((horas) => ({
              valor: horas,
              etiqueta: horas === 1 ? t('dashboard.ventana1h') : horas === 24 ? t('dashboard.ventana24h') : t('dashboard.ventana7d'),
            }))}
          />
        </div>
      </div>


      <div className={cn('linea-dia__grafica', compacto && 'linea-dia__grafica--compacta')}>
        <EChartWrapper
          option={opcion}
          height="clamp(240px, 40dvh, 440px)"
          ariaLabel={t('dashboard.graficaEtiqueta', { n: serie.length })}
          ariaDescribedBy="curva-termica-datos"
        />
        <TiraJornada serie={serie} desde={ventana.desde} hasta={ventana.hasta} />
      </div>
      {resumen && (
        <Detalles className="linea-dia__mas" titulo={t('dashboard.verCifrasPeriodo')}>
          <Indicadores className="linea-dia__cifras">
            <Indicador etiqueta={t('dashboard.resumenMinima')} valor={resumen.minima.toFixed(1)} unidad="°C" />
            <Indicador etiqueta={t('dashboard.resumenMaxima')} valor={resumen.maxima.toFixed(1)} unidad="°C" />
            <Indicador etiqueta={t('dashboard.resumenPromedio')} valor={resumen.promedio.toFixed(1)} unidad="°C" />
            <Indicador
              etiqueta={t('dashboard.resumenFueraRango')}
              valor={String(resumen.fueraDeRango)}
              tono={resumen.fueraDeRango > 0 ? 'critico' : 'neutro'}
            />
            <Indicador etiqueta={t('dashboard.enRangoVentana')} valor={resumen.enRango} unidad="%" />
            <Indicador etiqueta={t('dashboard.lecturasPeriodo')} valor={String(serie.length)} />
          </Indicadores>
        </Detalles>
      )}
      <TablaDatos serie={serie} titulo={t('dashboard.graficaEtiqueta', { n: serie.length })} />
    </section>
  )
})
