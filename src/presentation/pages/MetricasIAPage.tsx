import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrainCircuit, ChevronDown, CircleCheck, Info, ShieldAlert, TriangleAlert } from 'lucide-react'

import { useModeloIA, type MetricasPorClase } from '@/application/hooks/useModeloIA'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { CompactWorkspace } from '../components/CompactWorkspace'
import { EstadoCarga, EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { Panel } from '../components/ui/panel'
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

/** Sección plegada del método: título y una línea de contexto a la vista. */
function DetallePlegable({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion: string
  children: ReactNode
}) {
  return (
    <details className="group border-b border-border">
      <summary className="-mx-2 flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-2 py-3 text-left outline-none transition-colors duration-(--duration-micro) hover:bg-cream-200/45 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{titulo}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">{descripcion}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted transition-transform duration-(--duration-ui) group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pt-1 pb-5">{children}</div>
    </details>
  )
}

export function MetricasIAPage() {
  const { t, i18n } = useTranslation()
  const { datos, cargando, noEntrenado, error, consultar } = useModeloIA()

  const encabezado = (
    <PageHeader
      eyebrow={t('nav.seccionCumplimiento')}
      titulo={t('metricasIA.titulo')}
      descripcion={t('metricasIA.descripcion')}
    />
  )

  if (cargando) {
    return (
      <CompactWorkspace>
        {encabezado}
        <EstadoCarga variant="dashboard" />
      </CompactWorkspace>
    )
  }

  if (noEntrenado || error || !datos) {
    return (
      <CompactWorkspace>
        {encabezado}
        <EstadoError mensaje={noEntrenado ? t('metricasIA.noEntrenado') : t('metricasIA.errorCarga')}>
          {error && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar()}>
              {t('metricasIA.reintentar')}
            </Button>
          )}
        </EstadoError>
      </CompactWorkspace>
    )
  }

  const m = datos.metricas
  const idioma = i18n.resolvedLanguage ?? i18n.language
  const localeNumero = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'es-PE'
  const pct = (valor: number, decimales?: number) => porcentaje(valor, idioma, decimales)
  const entero = (valor: number) => valor.toLocaleString(localeNumero)
  const clases = ORDEN_CLASES.filter((clase) => esMetricaDeClase(m.classification_report[clase]))
  const evaluacionVerificada =
    datos.datos_simulados === false && Boolean(m.dataset_hash && m.model_hash && m.particion)
  const cumpleUmbral = evaluacionVerificada && m.f1_weighted >= UMBRAL_F1
  const etiquetaVariable = (variable: string) =>
    t(`metricasIA.variables.${variable}`, { defaultValue: variable.replaceAll('_', ' ') })
  const importancias = Object.entries(m.feature_importances).sort(([, a], [, b]) => b - a)

  return (
    <CompactWorkspace>
      {encabezado}

      {/* ── Resultado principal ─────────────────────────────── */}
      <Panel id="resumen-evaluacion" icono={BrainCircuit} titulo={t('metricasIA.resumenTitulo')} cuerpoClassName="p-0 sm:p-0">
        {/* Sin origen verificable, el valor es ilustrativo: se dice antes que
            la cifra, no debajo. */}
        {!evaluacionVerificada && (
          <div role="status" className="flex items-start gap-2.5 border-b border-honey-600/20 bg-honey-100 px-4 py-3 text-honey-700 sm:px-5">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p className="text-[13px] leading-5 font-medium">{t('metricasIA.avisoDatosNoReportables')}</p>
          </div>
        )}

        <div className="grid gap-5 p-4 sm:px-5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-8">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">{t('metricasIA.f1Ponderado')}</p>
            <p
              className="nums mt-1 text-4xl leading-tight font-semibold tracking-tight text-foreground"
              aria-label={t('metricasIA.muestraIlustrativa')}
            >
              {pct(m.f1_weighted)}
            </p>
            <div
              role="status"
              data-testid="veredicto-umbral"
              className={cn(
                'mt-3 flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px] leading-5',
                cumpleUmbral ? 'bg-success-100 text-success-700' : 'bg-honey-100 text-honey-700',
              )}
            >
              {/* WCAG 1.4.1: cumplir e incumplir usan iconos distintos. */}
              {cumpleUmbral ? (
                <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              ) : (
                <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              <span>
                <span className="font-semibold">
                  {!evaluacionVerificada
                    ? t('metricasIA.estadoNoVerificado')
                    : cumpleUmbral ? t('metricasIA.criterioSuperado') : t('metricasIA.criterioNoAlcanzado')}
                </span>{' '}
                <span className="text-foreground/80">
                  {!evaluacionVerificada
                    ? t('metricasIA.contextoNoVerificado')
                    : t('metricasIA.contextoUmbral', { umbral: pct(UMBRAL_F1, 0) })}
                </span>
              </span>
            </div>
          </div>

          <dl className="grid content-start divide-y divide-border border-t border-border pt-1 md:border-t-0 md:border-l md:pt-0 md:pl-8">
            <div className="flex items-baseline justify-between gap-5 py-3 md:pt-1">
              <dt className="text-[13px] font-medium text-foreground">{t('metricasIA.exactitudGeneral')}</dt>
              <dd className="nums shrink-0 text-xl font-semibold tracking-tight text-foreground">{pct(m.accuracy)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-5 py-3">
              <dt className="text-[13px] font-medium text-foreground">{t('metricasIA.casosEvaluados')}</dt>
              <dd className="nums shrink-0 text-xl font-semibold tracking-tight text-foreground">{entero(m.n_samples_test)}</dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-border px-4 pt-3 pb-2 sm:px-5">
          <p className="text-xs leading-5 text-muted">{t('metricasIA.notaEvaluacion')}</p>
          <Detalles className="mt-1">
            <dl className="grid gap-3 pb-1 text-xs leading-5 sm:grid-cols-2 sm:gap-6">
              <div>
                <dt className="font-medium text-foreground">{t('metricasIA.f1Ponderado')}</dt>
                <dd className="mt-0.5 text-muted">{t('metricasIA.definicionF1')}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">{t('metricasIA.exactitudGeneral')}</dt>
                <dd className="mt-0.5 text-muted">{t('metricasIA.definicionExactitud')}</dd>
              </div>
            </dl>
          </Detalles>
        </div>
      </Panel>

      {/* ── Método y variables: plegados ────────────────────── */}
      <section aria-labelledby="metodo-evaluacion-titulo" className="min-w-0">
        <h2 id="metodo-evaluacion-titulo" className="text-[15px] leading-6 font-semibold tracking-tight text-foreground">
          {t('metricasIA.detalleTitulo')}
        </h2>
        <div className="mt-2 border-t border-border">
          <DetallePlegable titulo={t('metricasIA.porClase')} descripcion={t('metricasIA.porClaseAyuda')}>
            <p className="mb-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{t('metricasIA.definicionesTabla')}</span>
            </p>
            <p className="mb-4 text-[13px] leading-6 text-muted">{t('metricasIA.reglaIndependiente')}</p>
            <Table mobileLayout="stack" className="min-w-0" titulo={t('metricasIA.porClase')}>
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
          </DetallePlegable>

          <DetallePlegable
            titulo={t('metricasIA.comoSeEvaluo')}
            descripcion={t('metricasIA.comoSeEvaluoAyuda', { folds: m.cross_validation.folds })}
          >
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted">{t('metricasIA.promedioF1')}</dt>
                <dd className="nums mt-1 text-base font-semibold text-foreground">{pct(m.cross_validation.mean)}</dd>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {t('metricasIA.variacionReportada', { variacion: pct(m.cross_validation.std) })}
                </p>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">{t('metricasIA.particiones')}</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{t('metricasIA.agrupadasPorEscenario')}</dd>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t('metricasIA.agrupacionAyuda')}</p>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted">{t('metricasIA.resultadosPorParticion')}</dt>
                <dd className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  {m.cross_validation.scores.map((score, index) => (
                    <span key={`${index}-${score}`} className="text-xs text-muted">
                      {t('metricasIA.particionNumero', { numero: index + 1 })}:{' '}
                      <strong className="nums font-semibold text-foreground">{pct(score)}</strong>
                    </span>
                  ))}
                </dd>
              </div>
              <div className="border-t border-border pt-4 sm:col-span-2">
                <dt className="text-xs font-medium text-muted">{t('metricasIA.registrosConjunto')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {t('metricasIA.particionMuestrasValor', {
                    entrenamiento: entero(m.n_samples_train),
                    prueba: entero(m.n_samples_test),
                  })}
                </dd>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {t('metricasIA.totalRegistros', { total: entero(m.n_samples) })}
                </p>
              </div>
            </dl>
          </DetallePlegable>

          <DetallePlegable titulo={t('metricasIA.variablesTitulo')} descripcion={t('metricasIA.variablesAyuda')}>
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
                      valor: pct(peso, 1),
                    })}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                      style={{ width: `${Math.max(0, Math.min(1, peso)) * 100}%` }}
                    />
                  </div>
                  <span className="nums text-right text-xs text-muted">{pct(peso, 1)}</span>
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
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t('metricasIA.notaUsoProfesional')}
      </p>
    </CompactWorkspace>
  )
}
