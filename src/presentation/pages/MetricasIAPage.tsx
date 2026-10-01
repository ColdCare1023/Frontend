import { CompactWorkspace } from '../components/CompactWorkspace'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BrainCircuit,
  ChevronDown,
  CircleCheck,
  Info,
  ShieldAlert,
} from 'lucide-react'

import { useModeloIA, type MetricasPorClase } from '@/application/hooks/useModeloIA'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Button } from '../components/ui/button'
import { EstadoCarga, EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

// Umbral declarado en el RNF-04. Se presenta como criterio de evaluación del
// prototipo, no como garantía de seguridad ni de cumplimiento operativo.
const UMBRAL_F1 = 0.85

const ORDEN_CLASES = ['riesgo_preventivo', 'normal'] as const

function porcentaje(valor: number, locale: string, decimales = 2): string {
  const localeNumero = locale.startsWith('en') ? 'en-US' : 'es-PE'
  const numero = new Intl.NumberFormat(localeNumero, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor * 100)
  return `${numero} %`
}

function esMetricaDeClase(valor: unknown): valor is MetricasPorClase {
  return typeof valor === 'object' && valor !== null && 'f1-score' in valor
}

function DetallePlegable({
  titulo,
  descripcion,
  children,
  abierto = false,
}: {
  abierto?: boolean
  titulo: string
  descripcion: string
  children: ReactNode
}) {
  return (
    <details open={abierto} className="group border-b border-border bg-transparent">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-0 py-3 text-left outline-none transition-colors hover:bg-cream-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{titulo}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">{descripcion}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  )
}

export function MetricasIAPage() {
  const { t, i18n } = useTranslation()
  const { datos, cargando, noEntrenado, error, consultar } = useModeloIA()

  if (cargando) {
    return (
      <div className="max-w-4xl">
        <PageHeader
          eyebrow={t('nav.seccionCumplimiento')}
          titulo={t('metricasIA.titulo')}
          descripcion={t('metricasIA.descripcion')}
        />
        <EstadoCarga variant="dashboard" />
      </div>
    )
  }

  if (noEntrenado || error || !datos) {
    return (
      <div className="max-w-4xl">
        <PageHeader
          eyebrow={t('nav.seccionCumplimiento')}
          titulo={t('metricasIA.titulo')}
          descripcion={t('metricasIA.descripcion')}
        />
        <EstadoError mensaje={noEntrenado ? t('metricasIA.noEntrenado') : t('metricasIA.errorCarga')} />
        {error && (
          <Button variant="secondary" className="mt-3" onClick={() => void consultar()}>
            {t('metricasIA.reintentar')}
          </Button>
        )}
      </div>
    )
  }

  const m = datos.metricas
  const clases = ORDEN_CLASES.filter((clase) => esMetricaDeClase(m.classification_report[clase]))
  const evaluacionVerificada =
    datos.datos_simulados === false && Boolean(m.dataset_hash && m.model_hash && m.particion)
  const cumpleUmbral = evaluacionVerificada && m.f1_weighted >= UMBRAL_F1
  const porcentajeF1 = porcentaje(m.f1_weighted, i18n.resolvedLanguage ?? i18n.language)
  const porcentajeExactitud = porcentaje(m.accuracy, i18n.resolvedLanguage ?? i18n.language)
  const etiquetaVariable = (variable: string) =>
    t(`metricasIA.variables.${variable}`, { defaultValue: variable.replaceAll('_', ' ') })
  const importancias = Object.entries(m.feature_importances).sort(([, a], [, b]) => b - a)

  return (
    <CompactWorkspace>
      <PageHeader
        eyebrow={t('nav.seccionCumplimiento')}
        titulo={t('metricasIA.titulo')}
        descripcion={t('metricasIA.descripcion')}
      />

      <div className="space-y-5">
      <section aria-labelledby="resumen-evaluacion-titulo" className="min-w-0">
        <h2 id="resumen-evaluacion-titulo" className="mb-2 text-base leading-6 font-semibold text-foreground">
          {t('metricasIA.resumenTitulo')}
        </h2>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {!evaluacionVerificada && (
            <div role="status" className="flex items-start gap-3 border-b border-border px-4 py-3 text-[#7B2342]">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p className="text-sm leading-relaxed">{t('metricasIA.avisoDatosNoReportables')}</p>
            </div>
          )}
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted">
                <span>{t('metricasIA.f1Ponderado')}</span>
                <Info aria-hidden className="size-4 text-primary" />
              </div>
              <p className="nums mt-1 text-3xl font-semibold tracking-tight text-foreground" aria-label={t('metricasIA.muestraIlustrativa')}>
                {porcentajeF1}
              </p>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
                {t('metricasIA.definicionF1')}
              </p>
              <div
                role="status"
                data-testid="veredicto-umbral"
                className={cn(
                  'mt-4 flex items-start gap-2.5 border-l-2 pl-3 text-sm leading-relaxed',
                  evaluacionVerificada
                    ? cumpleUmbral ? 'border-primary text-ink-700' : 'border-accent text-ink-700'
                    : 'border-accent text-ink-700',
                )}
              >
                {evaluacionVerificada && cumpleUmbral ? (
                  <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                )}
                <span>
                  <span className="font-semibold">
                    {!evaluacionVerificada
                      ? t('metricasIA.estadoNoVerificado')
                      : cumpleUmbral ? t('metricasIA.criterioSuperado') : t('metricasIA.criterioNoAlcanzado')}
                  </span>{' '}
                  {!evaluacionVerificada
                    ? t('metricasIA.contextoNoVerificado')
                    : t('metricasIA.contextoUmbral', { umbral: porcentaje(UMBRAL_F1, i18n.resolvedLanguage ?? i18n.language, 0) })}
                </span>
              </div>
            </div>

            <dl className="grid content-start divide-y divide-border border-t border-border pt-4">
              <div className="flex items-start justify-between gap-5 py-3 first:pt-0 lg:first:pt-1">
                <dt className="text-sm font-medium text-foreground">
                  {t('metricasIA.exactitudGeneral')}
                  <span className="mt-0.5 block text-xs font-normal leading-relaxed text-muted">{t('metricasIA.definicionExactitud')}</span>
                </dt>
                <dd className="nums shrink-0 text-lg font-semibold text-foreground">{porcentajeExactitud}</dd>
              </div>
              <div className="flex items-center justify-between gap-5 py-3 last:pb-0">
                <dt className="text-sm text-muted">{t('metricasIA.casosEvaluados')}</dt>
                <dd className="nums text-sm font-semibold text-foreground">
                  {m.n_samples_test.toLocaleString(i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'es-PE')}
                </dd>
              </div>
            </dl>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs leading-relaxed text-muted">
            {t('metricasIA.notaEvaluacion')}
          </p>
        </div>
      </section>

      <section aria-label={t('metricasIA.detalleTitulo')} className="min-w-0 space-y-3">
        <h2 className="mb-2 text-base leading-6 font-semibold text-foreground">{t('metricasIA.detalleTitulo')}</h2>

        <DetallePlegable
          abierto
          titulo={t('metricasIA.porClase')}
          descripcion={t('metricasIA.porClaseAyuda')}
        >
          <p className="mb-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{t('metricasIA.definicionesTabla')}</span>
          </p>
          <p className="mb-4 text-sm leading-6 text-muted">{t('metricasIA.reglaIndependiente')}</p>
          <Table titulo={t('metricasIA.porClase')}>
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
                    <TableCell className="font-medium">{t(`riesgo.${clase}`)}</TableCell>
                    <TableCell className="nums">{porcentaje(fila['f1-score'], i18n.resolvedLanguage ?? i18n.language)}</TableCell>
                    <TableCell className="nums">{porcentaje(fila.precision, i18n.resolvedLanguage ?? i18n.language)}</TableCell>
                    <TableCell className="nums">{porcentaje(fila.recall, i18n.resolvedLanguage ?? i18n.language)}</TableCell>
                    <TableCell className="nums text-muted">{fila.support.toLocaleString(i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'es-PE')}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </DetallePlegable>

        <DetallePlegable
          titulo={t('metricasIA.comoSeEvaluo')}
          descripcion={t('metricasIA.comoSeEvaluoAyuda', { folds: m.cross_validation.folds })}
        >
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted">{t('metricasIA.promedioF1')}</dt>
              <dd className="nums mt-1 text-base font-semibold text-foreground">
                {porcentaje(m.cross_validation.mean, i18n.resolvedLanguage ?? i18n.language)}
              </dd>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t('metricasIA.variacionReportada', {
                  variacion: porcentaje(m.cross_validation.std, i18n.resolvedLanguage ?? i18n.language),
                })}
              </p>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{t('metricasIA.particiones')}</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {t('metricasIA.agrupadasPorEscenario')}
              </dd>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t('metricasIA.agrupacionAyuda')}</p>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted">{t('metricasIA.resultadosPorParticion')}</dt>
              <dd className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {m.cross_validation.scores.map((score, index) => (
                  <span key={`${index}-${score}`} className="text-xs text-muted">
                    {t('metricasIA.particionNumero', { numero: index + 1 })}:{' '}
                    <strong className="nums font-semibold text-foreground">
                      {porcentaje(score, i18n.resolvedLanguage ?? i18n.language)}
                    </strong>
                  </span>
                ))}
              </dd>
            </div>
            <div className="sm:col-span-2 border-t border-border pt-4">
              <dt className="text-xs font-medium text-muted">{t('metricasIA.registrosConjunto')}</dt>
              <dd className="mt-1 text-sm text-foreground">
                {t('metricasIA.particionMuestrasValor', {
                  entrenamiento: m.n_samples_train.toLocaleString(i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'es-PE'),
                  prueba: m.n_samples_test.toLocaleString(i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'es-PE'),
                })}
              </dd>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t('metricasIA.totalRegistros', {
                  total: m.n_samples.toLocaleString(i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'es-PE'),
                })}
              </p>
            </div>
          </dl>
        </DetallePlegable>

        <DetallePlegable
          titulo={t('metricasIA.variablesTitulo')}
          descripcion={t('metricasIA.variablesAyuda')}
        >
          <div className="min-w-0 space-y-3">
            {importancias.map(([variable, peso]) => (
              <div key={variable} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(7rem,11rem)_1fr_auto]">
                <span className="col-span-2 break-words text-sm text-foreground sm:col-span-1">
                  {etiquetaVariable(variable)}
                </span>
                <div
                  className="h-2 overflow-hidden rounded-full bg-cream-200"
                  role="img"
                  aria-label={t('metricasIA.barraImportancia', {
                    variable: etiquetaVariable(variable),
                    valor: porcentaje(peso, i18n.resolvedLanguage ?? i18n.language, 1),
                  })}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${Math.max(0, Math.min(1, peso)) * 100}%` }}
                  />
                </div>
                <span className="nums text-right text-xs text-muted">
                  {porcentaje(peso, i18n.resolvedLanguage ?? i18n.language, 1)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted">
            {t('metricasIA.notaImportancias')}
          </p>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
            {(
              [
                [t('metricasIA.nombreModelo'), m.model_name],
                [t('metricasIA.version'), m.model_version],
                [t('metricasIA.entrenadoEl'), fechaHora(m.trained_at)],
                ['scikit-learn', m.sklearn_version],
                [t('metricasIA.semilla'), String(m.random_state)],
                [t('metricasIA.huellaConjunto'), m.dataset_hash ?? t('metricasIA.noDisponible')],
                [t('metricasIA.huellaModelo'), m.model_hash ?? t('metricasIA.noDisponible')],
              ] as const
            ).map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between gap-3 border-b border-border py-2">
                <dt className="text-muted">{etiqueta}</dt>
                <dd className="nums max-w-[60%] break-all text-right font-medium text-foreground">{valor}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-muted">{t('metricasIA.notaReproducibilidad')}</p>
        </DetallePlegable>
      </section>

      </div>
      <p className="flex items-start gap-2 border-t border-border pt-3 text-xs leading-relaxed text-muted">
        <BrainCircuit aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t('metricasIA.notaUsoProfesional')}
      </p>
    </CompactWorkspace>
  )
}
