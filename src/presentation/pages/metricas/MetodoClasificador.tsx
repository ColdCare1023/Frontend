import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'

import type { MetricasModelo, MetricasPorClase } from '@/application/hooks/useModeloIA'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { porcentaje } from './porcentaje'

const ORDEN_CLASES = ['riesgo_preventivo', 'normal'] as const

function esMetricaDeClase(valor: unknown): valor is MetricasPorClase {
  return typeof valor === 'object' && valor !== null && 'f1-score' in valor
}

function useFormato() {
  const { t, i18n } = useTranslation()
  const idioma = i18n.resolvedLanguage
  const locale = idioma?.startsWith('en') ? 'en-US' : 'es-PE'
  return {
    t,
    pct: (v: number, d?: number) => porcentaje(v, idioma, d),
    entero: (v: number) => v.toLocaleString(locale),
  }
}

/** Tabla por clase, visible (antes plegada). */
export function ResultadosPorClase({ metricas: m, className }: { metricas: MetricasModelo; className?: string }) {
  const { t, pct, entero } = useFormato()
  const clases = ORDEN_CLASES.filter((clase) => esMetricaDeClase(m.classification_report[clase]))
  return (
    <section aria-labelledby="clasificador-clases-titulo" className={cn('superficie flex min-w-0 flex-col p-4 xl:p-5', className)}>
      <h2 id="clasificador-clases-titulo" className="text-title text-foreground">{t('metricasIA.porClase')}</h2>
      <p className="text-meta text-muted">{t('metricasIA.porClaseAyuda')}</p>
      <p className="mt-2 text-body text-muted">{t('metricasIA.reglaIndependiente')}</p>
      {clases.length === 0 ? (
        <p className="mt-3 text-body text-muted">{t('metricasIA.sinClases')}</p>
      ) : (
        <Table mobileLayout="stack" className="mt-3 min-w-0" titulo={t('metricasIA.porClase')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('metricasIA.situacion')}</TableHead>
              <TableHead>F1</TableHead>
              <TableHead>{t('metricasIA.precision')}</TableHead>
              <TableHead>{t('metricasIA.deteccion')}</TableHead>
              <TableHead>{t('metricasIA.casosEvaluados')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clases.map((clase) => {
              const fila = m.classification_report[clase] as MetricasPorClase
              return (
                <TableRow key={clase}>
                  <TableCell data-label={t('metricasIA.situacion')} className="font-medium">{t(`riesgo.${clase}`)}</TableCell>
                  <TableCell data-label="F1" className="nums">{pct(fila['f1-score'])}</TableCell>
                  <TableCell data-label={t('metricasIA.precision')} className="nums">{pct(fila.precision)}</TableCell>
                  <TableCell data-label={t('metricasIA.deteccion')} className="nums">{pct(fila.recall)}</TableCell>
                  <TableCell data-label={t('metricasIA.casosEvaluados')} className="nums text-muted">{entero(fila.support)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      <p className="mt-auto flex items-start gap-2 pt-3 text-meta text-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>{t('metricasIA.definicionesTabla')}</span>
      </p>
    </section>
  )
}

/** Validación cruzada: promedio ± desviación, puntos por partición y conjunto. */
export function ComoSeEvaluo({ metricas: m, umbral, className }: { metricas: MetricasModelo; umbral: number; className?: string }) {
  const { t, pct, entero } = useFormato()
  const cv = m.cross_validation
  const x = (v: number) => ((Math.max(0.8, Math.min(1, v)) - 0.8) / 0.2) * 300
  return (
    <section aria-labelledby="clasificador-metodo-titulo" className={cn('superficie min-w-0 p-4 xl:p-5', className)}>
      <h2 id="clasificador-metodo-titulo" className="text-title text-foreground">{t('metricasIA.comoSeEvaluo')}</h2>
      <p className="text-meta text-muted">{t('metricasIA.comoSeEvaluoAyuda', { folds: cv.folds })}</p>

      <div className="mt-3">
        <p className="text-meta text-muted">{t('metricasIA.promedioF1')}</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="nums text-metric text-foreground">{pct(cv.mean)}</span>
          <span className="nums text-body text-muted">± {pct(cv.std)}</span>
        </p>
        <p className="text-meta text-muted">{t('metricasIA.variacionReportada', { variacion: pct(cv.std) })}</p>
      </div>

      {cv.scores.length > 0 && (
        <>
          <svg
            role="img"
            aria-label={t('metricasIA.dispersionAria', {
              valores: cv.scores.map((s) => pct(s)).join(', '),
              promedio: pct(cv.mean),
              umbral: pct(umbral, 0),
            })}
            viewBox="0 0 300 40"
            preserveAspectRatio="none"
            className="mt-3 h-10 w-full overflow-visible"
          >
            <line x1={0} x2={300} y1={20} y2={20} vectorEffect="non-scaling-stroke" className="stroke-border" />
            <line x1={x(umbral)} x2={x(umbral)} y1={4} y2={36} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" className="stroke-warning-600" />
            <line x1={x(cv.mean)} x2={x(cv.mean)} y1={8} y2={32} vectorEffect="non-scaling-stroke" className="stroke-foreground" />
            {cv.scores.map((s, i) => (
              <circle key={`${i}-${s}`} cx={x(s)} cy={20} r={4} className="fill-grafica-1" />
            ))}
          </svg>
          <div aria-hidden className="nums flex justify-between text-micro text-faint">
            {[80, 85, 90, 95, 100].map((v) => <span key={v}>{v}</span>)}
          </div>
          <p className="mt-2 text-meta text-muted">{t('metricasIA.resultadosPorParticion')}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {cv.scores.map((score, index) => (
              <li key={`${index}-${score}`} className="text-meta text-muted">
                {t('metricasIA.particionNumero', { numero: index + 1 })}:{' '}
                <strong className="nums font-semibold text-foreground">{pct(score)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

      <dl className="mt-3 divide-y divide-border border-t border-border">
        <div className="py-2.5">
          <dt className="text-meta text-muted">{t('metricasIA.particiones')}</dt>
          <dd className="text-body text-foreground">{t('metricasIA.agrupadasPorEscenario')}</dd>
          <dd className="text-meta text-muted">{t('metricasIA.agrupacionAyuda')}</dd>
        </div>
        <div className="py-2.5">
          <dt className="text-meta text-muted">{t('metricasIA.registrosConjunto')}</dt>
          <dd className="text-body text-foreground">
            {t('metricasIA.particionMuestrasValor', { entrenamiento: entero(m.n_samples_train), prueba: entero(m.n_samples_test) })}
          </dd>
          <dd className="text-meta text-muted">{t('metricasIA.totalRegistros', { total: entero(m.n_samples) })}</dd>
        </div>
        <div className="py-2.5">
          <dt className="text-meta text-muted">{t('metricasIA.queMide')}</dt>
          <dd className="text-meta text-muted">
            <strong className="font-medium text-foreground">{t('metricasIA.f1Ponderado')}:</strong> {t('metricasIA.definicionF1')}
          </dd>
          <dd className="mt-1 text-meta text-muted">
            <strong className="font-medium text-foreground">{t('metricasIA.exactitudGeneral')}:</strong> {t('metricasIA.definicionExactitud')}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/** Importancia de variables: barras estáticas en escala absoluta (scaleX). */
export function ImportanciaVariables({ metricas: m, className }: { metricas: MetricasModelo; className?: string }) {
  const { t, pct } = useFormato()
  const importancias = Object.entries(m.feature_importances).sort(([, a], [, b]) => b - a)
  const etiqueta = (variable: string) => t(`metricasIA.variables.${variable}`, { defaultValue: variable.replaceAll('_', ' ') })
  return (
    <section aria-labelledby="clasificador-variables-titulo" className={cn('superficie flex min-w-0 flex-col p-4 xl:p-5', className)}>
      <h2 id="clasificador-variables-titulo" className="text-title text-foreground">{t('metricasIA.variablesTitulo')}</h2>
      <p className="text-meta text-muted">{t('metricasIA.variablesAyuda')}</p>
      {importancias.length === 0 ? (
        <p className="mt-3 text-body text-muted">{t('metricasIA.noDisponible')}</p>
      ) : (
        <ul className="mt-3">
          {importancias.map(([variable, peso]) => (
            <li key={variable} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-1.5 sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
              <span className="truncate text-body text-foreground" title={etiqueta(variable)}>{etiqueta(variable)}</span>
              <div
                role="img"
                aria-label={t('metricasIA.barraImportancia', { variable: etiqueta(variable), valor: pct(peso, 1) })}
                className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken max-sm:order-last sm:col-span-1"
              >
                <div
                  className="h-full origin-left rounded-full bg-grafica-1"
                  style={{ transform: `scaleX(${Math.max(0, Math.min(1, peso))})` }}
                />
              </div>
              <span className="nums text-right text-meta text-muted">{pct(peso, 1)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto border-t border-border pt-3 text-meta text-muted">{t('metricasIA.notaImportancias')}</p>
    </section>
  )
}

/** Identificación del modelo y nota de reproducibilidad (ancho completo). */
export function FichaModelo({ metricas: m, className }: { metricas: MetricasModelo; className?: string }) {
  const { t } = useFormato()
  const filas = [
    [t('metricasIA.nombreModelo'), m.model_name, false],
    [t('metricasIA.version'), m.model_version, true],
    [t('metricasIA.entrenadoEl'), fechaHora(m.trained_at), false],
    ['scikit-learn', m.sklearn_version, true],
    [t('metricasIA.semilla'), String(m.random_state), true],
    [t('metricasIA.huellaConjunto'), m.dataset_hash ?? t('metricasIA.noDisponible'), Boolean(m.dataset_hash)],
    [t('metricasIA.huellaModelo'), m.model_hash ?? t('metricasIA.noDisponible'), Boolean(m.model_hash)],
  ] as const
  return (
    <section aria-labelledby="clasificador-ficha-titulo" className={cn('superficie p-4 xl:p-5', className)}>
      <h2 id="clasificador-ficha-titulo" className="text-title text-foreground">{t('metricasIA.fichaTitulo')}</h2>
      <dl className="mt-2 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {filas.map(([etiqueta, valor, codigo]) => (
          <div key={etiqueta} className="flex justify-between gap-3 border-b border-border py-2 text-meta">
            <dt className="text-muted">{etiqueta}</dt>
            <dd className={cn('nums min-w-0 break-all text-right font-medium text-foreground', codigo && 'codigo')}>{valor}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-meta text-muted">{t('metricasIA.notaReproducibilidad')}</p>
    </section>
  )
}
