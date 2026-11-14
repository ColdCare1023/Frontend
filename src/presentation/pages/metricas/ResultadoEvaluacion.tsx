import { useTranslation } from 'react-i18next'
import { CircleCheck, ShieldAlert, TriangleAlert } from 'lucide-react'

import type { MetricasModelo } from '@/application/hooks/useModeloIA'
import { cn } from '@/lib/utils'
import { Anillo } from '../../components/ui/anillo'
import { useCoincideMedia } from '../../hooks/useCoincideMedia'
import { numeroPct, porcentaje } from './porcentaje'

export type EstadoClasificador = 'sin-verificar' | 'cumple' | 'no-cumple'

/**
 * Franja de estado (H10): primero se dice si la evaluación es verificable y
 * si alcanza el criterio, después viene la cifra. Un icono distinto por
 * estado (WCAG 1.4.1).
 */
export function EstadoEvaluacion({ estado, umbral }: { estado: EstadoClasificador; umbral: string }) {
  const { t } = useTranslation()
  const Icono = estado === 'cumple' ? CircleCheck : estado === 'no-cumple' ? TriangleAlert : ShieldAlert
  return (
    <div
      role="status"
      data-testid="veredicto-umbral"
      data-estado={estado}
      className={cn(
        'flex items-start gap-3 rounded-(--radius-card) border px-4 py-3',
        estado === 'cumple' ? 'border-border bg-surface text-foreground' : 'border-warning-600/30 bg-warning-100 text-warning-700',
      )}
    >
      <Icono aria-hidden className={cn('mt-0.5 size-4 shrink-0', estado === 'cumple' && 'text-success-700')} />
      <div className="min-w-0">
        <p className="text-body">
          <span className="font-semibold">
            {estado === 'sin-verificar'
              ? t('metricasIA.estadoNoVerificado')
              : estado === 'cumple'
                ? t('metricasIA.criterioSuperado')
                : t('metricasIA.criterioNoAlcanzado')}
          </span>{' '}
          {estado === 'sin-verificar' ? t('metricasIA.contextoNoVerificado') : t('metricasIA.contextoUmbral', { umbral })}
        </p>
        {estado === 'sin-verificar' && <p className="mt-0.5 text-meta">{t('metricasIA.avisoDatosNoReportables')}</p>}
      </div>
    </div>
  )
}

/** Celda principal: anillo con el F1 ponderado, exactitud, casos y criterio. */
export function ResultadoEvaluacion({
  metricas: m,
  estado,
  umbral,
  className,
}: {
  metricas: MetricasModelo
  estado: EstadoClasificador
  umbral: number
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const idioma = i18n.resolvedLanguage
  const grande = useCoincideMedia('(min-width: 80rem)')
  const verificada = estado !== 'sin-verificar'
  const tono = estado === 'cumple' ? 'exito' : estado === 'no-cumple' ? 'aviso' : 'sin-verificar'
  const filas = [
    [t('metricasIA.exactitudGeneral'), porcentaje(m.accuracy, idioma)],
    [t('metricasIA.casosEvaluados'), m.n_samples_test.toLocaleString(idioma?.startsWith('en') ? 'en-US' : 'es-PE')],
    [t('metricasIA.umbralCriterio'), t('metricasIA.umbralValor', { umbral: porcentaje(umbral, idioma, 0) })],
  ] as const

  return (
    <section aria-labelledby="clasificador-f1-titulo" className={cn('superficie flex flex-col p-4 xl:p-5', className)}>
      <h2 id="clasificador-f1-titulo" className="eyebrow">{t('metricasIA.f1Ponderado')}</h2>
      <div className="mt-3 flex items-center gap-5 xl:gap-6">
        <div className="shrink-0">
          <Anillo valor={m.f1_weighted} umbral={umbral} tono={tono} tamano={grande ? 144 : 120}>
            <span className="flex flex-col items-center">
              <span className="flex items-baseline">
                <span data-testid="f1-valor" className="nums text-metric text-foreground">
                  {numeroPct(m.f1_weighted, idioma)}
                </span>
                <span aria-hidden className="ml-0.5 text-body font-medium text-muted">%</span>
              </span>
              {!verificada && <span className="text-micro text-warning-700">{t('metricasIA.ilustrativo')}</span>}
              <span className="sr-only">
                {t('metricasIA.anilloSr', {
                  valor: porcentaje(m.f1_weighted, idioma),
                  estado: verificada ? '' : t('metricasIA.muestraIlustrativa'),
                })}
              </span>
            </span>
          </Anillo>
        </div>
        <dl className="min-w-0 flex-1 divide-y divide-border">
          {filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5">
              <dt className="text-meta text-muted">{etiqueta}</dt>
              <dd className="nums text-title text-foreground">{valor}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-auto pt-3 text-meta text-muted">{t('metricasIA.notaEvaluacion')}</p>
    </section>
  )
}
