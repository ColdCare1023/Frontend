import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ReporteBPA } from '@/application/hooks/useReportesBPA'
import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { EChartWrapper } from '@/infrastructure/charts/EChartWrapper'
import { useTemaResuelto } from '@/infrastructure/tema/tema'
import { fechaCorta, fechaHora, localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { ColdCareBrand } from '@/presentation/components/ColdCareBrand'
import { RiskBadge } from '@/presentation/components/RiskBadge'
import { NumeroAnimado } from '@/presentation/components/ui/numero-animado'
import { opcionCurvaSobrePapel } from './curvaSobrePapel'
import { diaLocal } from './periodo'
import './hoja-reporte.css'

const ALERTAS_VISIBLES = 4

/** Mínima, máxima, promedio y fuera de rango; a mano, porque un año de lecturas desborda `Math.min(...x)`. */
function extremosDe(temperaturas: number[]) {
  if (temperaturas.length === 0) return null
  let minima = Infinity
  let maxima = -Infinity
  let suma = 0
  let fuera = 0
  for (const valor of temperaturas) {
    if (valor < minima) minima = valor
    if (valor > maxima) maxima = valor
    suma += valor
    if (valor < RANGO_TERMICO.minimo || valor > RANGO_TERMICO.maximo) fuera += 1
  }
  return { minima, maxima, promedio: suma / temperaturas.length, fuera }
}

const CLAVES_EXTREMOS = [
  'dashboard.resumenMinima',
  'dashboard.resumenMaxima',
  'dashboard.resumenPromedio',
  'dashboard.resumenFueraRango',
] as const

function Rotulo({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="hoja-reporte__rotulo">
      {children}
    </h3>
  )
}

/** Lo que trae el reporte: la curva del periodo, sus extremos y las últimas alertas. */
function ContenidoReporte({ reporte }: { reporte: ReporteBPA }) {
  const { t } = useTranslation()
  const tema = useTemaResuelto()
  const serie = useMemo(
    () => [...reporte.lecturas].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
    [reporte.lecturas],
  )
  const opcion = useMemo(
    () =>
      opcionCurvaSobrePapel(
        serie,
        {
          interna: t('dashboard.tempInterna'),
          ambiental: t('dashboard.tempAmbiental'),
          rangoEsperado: t('dashboard.rangoEsperadoCorto'),
          ahora: t('dashboard.ejeAhora'),
          excursion: t('dashboard.graficaExcursion'),
          sinDatos: t('dashboard.graficaSinDatos'),
        },
        tema,
      ),
    [serie, t, tema],
  )
  const extremos = useMemo(
    () => extremosDe(serie.map((l) => l.temperatura_interna).filter((v): v is number => v != null && Number.isFinite(v))),
    [serie],
  )
  const alertas = [...reporte.alertas]
    .sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''))
    .slice(0, ALERTAS_VISIBLES)
  const valores = extremos && [
    `${extremos.minima.toFixed(1)} °C`,
    `${extremos.maxima.toFixed(1)} °C`,
    `${extremos.promedio.toFixed(1)} °C`,
    String(extremos.fuera),
  ]

  return (
    <>
      <section aria-labelledby="reporte-curva" className="hoja-reporte__seccion">
        <Rotulo id="reporte-curva">{t('reportes.comoCambio')}</Rotulo>
        {serie.length > 0 ? (
          <div className="mt-3">
            <EChartWrapper option={opcion} height="clamp(210px, 32cqw, 340px)" ariaLabel={t('dashboard.graficaEtiqueta', { n: serie.length })} />
          </div>
        ) : (
          <p className="hoja-reporte__pluma mt-3">{t('reportes.sinLecturas')}</p>
        )}
        {valores && (
          <dl className="hoja-reporte__extremos">
            {CLAVES_EXTREMOS.map((clave, i) => (
              <div key={clave} className="min-w-0">
                <dt className="text-xs leading-4 text-faint">{t(clave)}</dt>
                <dd className={cn('nums text-[22px] leading-7 font-semibold tracking-[-0.02em]', i === 3 && extremos.fuera > 0 && 'text-critical')}>
                  {valores[i]}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="reporte-alertas" className="hoja-reporte__seccion">
        <Rotulo id="reporte-alertas">{t('reportes.ultimasAlertas')}</Rotulo>
        {alertas.length > 0 ? (
          <ul>
            {alertas.map((a) => (
              <li key={a.id} className="hoja-reporte__alerta">
                <time dateTime={a.created_at ?? undefined} className="nums text-[13px] leading-5 whitespace-nowrap text-faint">
                  {fechaHora(a.created_at)}
                </time>
                <span className="justify-self-end">
                  <RiskBadge nivel={a.nivel_riesgo} />
                </span>
                <p className="line-clamp-2 text-sm leading-5">{a.mensaje}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hoja-reporte__pluma mt-3">{t('reportes.sinAlertas')}</p>
        )}
      </section>
    </>
  )
}

/** Sin reporte, la misma hoja en blanco: los mismos apartados y sus renglones por llenar. */
function HojaEnBlanco() {
  const { t } = useTranslation()
  return (
    <>
      <section aria-labelledby="reporte-curva" className="hoja-reporte__seccion">
        <Rotulo id="reporte-curva">{t('reportes.comoCambio')}</Rotulo>
        <div aria-hidden className="hoja-reporte__renglones h-[180px]" />
      </section>
      <section aria-labelledby="reporte-alertas" className="hoja-reporte__seccion flex flex-1 flex-col">
        <Rotulo id="reporte-alertas">{t('reportes.ultimasAlertas')}</Rotulo>
        <div aria-hidden className="hoja-reporte__renglones flex-1" />
      </section>
    </>
  )
}

/**
 * La hoja: membrete, periodo, las tres cifras y lo que el reporte trae. Es el mismo papel antes y
 * después de generar, así que las cifras ruedan en su sitio en lugar de cambiar de pantalla.
 */
export function HojaReporte({
  reporte,
  desde,
  hasta,
  equipo,
  generando,
}: {
  reporte: ReporteBPA | null
  desde: string
  hasta: string
  equipo: string
  generando: boolean
}) {
  const { t } = useTranslation()
  const periodo = reporte
    ? t('reportes.vista.periodo', { desde: fechaCorta(reporte.fecha_desde), hasta: fechaCorta(reporte.fecha_hasta) })
    : desde && hasta
      ? t('reportes.vista.periodo', { desde: diaLocal(desde), hasta: diaLocal(hasta) })
      : '—'
  const nombreEquipo = reporte ? reporte.device_id : equipo
  const cifras = [
    ['reportes.lecturas', reporte?.lecturas.length],
    ['reportes.alertas', reporte?.alertas.length],
    ['reportes.registrosTrazabilidad', reporte?.registros_trazabilidad.length],
  ] as const

  return (
    <article id="reportes-resumen" aria-labelledby="reportes-hoja-titulo" aria-busy={generando || undefined} className="hoja-reporte">
      <div className="hoja-reporte__interior">
        <div className="hoja-reporte__membrete">
          <ColdCareBrand className="[&>svg]:size-7 [&_p]:text-[15px]" />
          {MODO_DEMO && <span className="hoja-reporte__timbre">{t('demo.avisoTitulo')}</span>}
        </div>

        <h2 id="reportes-hoja-titulo" className="hoja-reporte__titulo">
          {t('reportes.vista.titulo')}
        </h2>
        <p className="nums mt-2 text-sm leading-5 text-muted sm:text-[15px]">
          {periodo}
          {' · '}
          <span className="break-words">{nombreEquipo || t('reportes.vista.todosEquipos')}</span>
        </p>

        <section aria-labelledby="reportes-resumen-rotulo" className="hoja-reporte__seccion">
          {reporte ? (
            <h3 id="reportes-resumen-rotulo" className="hoja-reporte__rotulo">
              {t('reportes.resumen')}
            </h3>
          ) : (
            <h3 id="reportes-resumen-rotulo" className="hoja-reporte__rotulo">
              <span className="hoja-reporte__pluma block -mb-0.5">{generando ? t('reportes.generando') : t('reportes.vista.pendiente')}</span>
            </h3>
          )}
          <dl className="hoja-reporte__cifras pt-3">
            {cifras.map(([clave, cantidad]) => (
              <div key={clave} className="hoja-reporte__cifra">
                <dt className="truncate text-xs leading-4 text-faint sm:text-[13px]">{t(clave)}</dt>
                <dd className="hoja-reporte__numero" data-vacio={cantidad === undefined}>
                  <NumeroAnimado valor={cantidad === undefined ? '—' : cantidad.toLocaleString(localeActual())} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Lo que el reporte trajo se funde sobre los renglones; `key` para que el fundido sea al llenarse. */}
        {reporte ? (
          <div key="lleno" className="animate-fade flex flex-1 flex-col">
            <ContenidoReporte reporte={reporte} />
          </div>
        ) : (
          <HojaEnBlanco />
        )}

        <div className="hoja-reporte__pie">
          {/* La advertencia honesta va en la hoja, con datos o sin ellos: es lo que la acompaña al papel. */}
          <p className="max-w-[46ch] text-xs leading-[18px] text-faint">{t('reportes.vista.pie')}</p>
        </div>
      </div>
    </article>
  )
}
