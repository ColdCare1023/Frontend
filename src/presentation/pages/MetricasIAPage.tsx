import { useTranslation } from 'react-i18next'
import { BrainCircuit, ShieldAlert } from 'lucide-react'

import { useModeloIA, type MetricasPorClase } from '@/application/hooks/useModeloIA'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { EstadoCarga, EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

// Umbral declarado en el RNF-04 de la tesis: por debajo, el clasificador no se
// considera apto para respaldar decisiones de cumplimiento.
const UMBRAL_F1 = 0.85

const ORDEN_CLASES = ['excursion_critica', 'riesgo_preventivo', 'normal'] as const

function porcentaje(valor: number, decimales = 2): string {
  return `${(valor * 100).toFixed(decimales)} %`
}

function esMetricaDeClase(valor: unknown): valor is MetricasPorClase {
  return typeof valor === 'object' && valor !== null && 'f1-score' in valor
}

export function MetricasIAPage() {
  const { t } = useTranslation()
  const { datos, cargando, noEntrenado, error } = useModeloIA()

  if (cargando) {
    return (
      <div className="max-w-4xl">
        <PageHeader
          eyebrow={t('nav.seccionCumplimiento')}
          titulo={t('metricasIA.titulo')}
          descripcion={t('metricasIA.descripcion')}
        />
        <EstadoCarga />
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
      </div>
    )
  }

  const m = datos.metricas
  const clases = ORDEN_CLASES.filter((clase) => esMetricaDeClase(m.classification_report[clase]))
  const cumpleUmbral = m.f1_weighted >= UMBRAL_F1
  const formatoFecha = fechaHora(m.trained_at)

  const kpis = [
    {
      etiqueta: t('metricasIA.f1Ponderado'),
      valor: m.f1_weighted.toFixed(4),
      destacado: true,
    },
    { etiqueta: t('metricasIA.accuracy'), valor: porcentaje(m.accuracy) },
    {
      etiqueta: t('metricasIA.validacionCruzada', { folds: m.cross_validation.folds }),
      valor: `${m.cross_validation.mean.toFixed(4)} ± ${m.cross_validation.std.toFixed(4)}`,
    },
    { etiqueta: t('metricasIA.muestras'), valor: m.n_samples.toLocaleString() },
  ]

  const importancias = Object.entries(m.feature_importances).sort(([, a], [, b]) => b - a)
  const maxImportancia = importancias[0]?.[1] ?? 1

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow={t('nav.seccionCumplimiento')}
        titulo={t('metricasIA.titulo')}
        descripcion={t('metricasIA.descripcion')}
      />

      {/* ── Indicadores principales ─────────────────────────── */}
      <div className="mb-5 grid animate-rise grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <Card key={kpi.etiqueta}>
            <CardContent className="p-4">
              <p className="text-xs leading-snug text-muted">{kpi.etiqueta}</p>
              <p
                className={cn(
                  'nums mt-1.5 font-semibold tracking-tight',
                  index === 2
                    ? 'whitespace-nowrap text-base sm:text-2xl'
                    : 'text-2xl',
                  kpi.destacado && (cumpleUmbral ? 'text-success-700' : 'text-clay-700'),
                )}
              >
                {kpi.valor}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Veredicto frente al umbral del RNF-04 ───────────── */}
      {/* El incumplimiento se distinguía del cumplimiento solo por el tinte
          del mismo icono (WCAG 1.4.1): ahora cambia la forma, el borde de la
          tarjeta y el texto. `role="status"` porque es la conclusión de la
          página, no un adorno: quien navega con lector debe recibirla sin
          tener que reconstruirla a partir de cuatro cifras sueltas. */}
      <Card
        className={cn(
          'mb-5 animate-rise',
          cumpleUmbral ? 'border-pine-200 bg-pine-100/40' : 'border-clay-100 bg-clay-100/50',
        )}
      >
        <CardContent role="status" data-testid="veredicto-umbral" className="flex items-start gap-3 p-5">
          {cumpleUmbral ? (
            <BrainCircuit className="mt-0.5 size-5 shrink-0 text-success-700" aria-hidden />
          ) : (
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-clay-700" aria-hidden />
          )}
          <div>
            <p
              className={cn(
                'text-sm font-semibold',
                cumpleUmbral ? 'text-success-700' : 'text-clay-700',
              )}
            >
              {cumpleUmbral ? t('metricasIA.cumpleUmbral') : t('metricasIA.noCumpleUmbral')}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {t('metricasIA.explicacionUmbral', {
                f1: m.f1_weighted.toFixed(4),
                umbral: UMBRAL_F1.toFixed(2),
              })}
            </p>
            {!cumpleUmbral && (
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-clay-700">
                {t('metricasIA.consecuenciaIncumplimiento')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Desempeño por clase ─────────────────────────────── */}
      <Card className="mb-5 animate-rise">
        <CardHeader>
          <CardTitle>{t('metricasIA.porClase')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table titulo={t('metricasIA.porClase')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('metricasIA.clase')}</TableHead>
                <TableHead>F1</TableHead>
                <TableHead>{t('metricasIA.precision')}</TableHead>
                <TableHead>{t('metricasIA.recall')}</TableHead>
                <TableHead>{t('metricasIA.soporte')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clases.map((clase) => {
                const fila = m.classification_report[clase] as MetricasPorClase
                return (
                  <TableRow key={clase}>
                    <TableCell className="font-medium">{t(`riesgo.${clase}`)}</TableCell>
                    <TableCell className="nums">{fila['f1-score'].toFixed(4)}</TableCell>
                    <TableCell className="nums">{fila.precision.toFixed(4)}</TableCell>
                    <TableCell className="nums">{fila.recall.toFixed(4)}</TableCell>
                    <TableCell className="nums text-muted">{fila.support}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            {t('metricasIA.notaRecall')}
          </p>
        </CardContent>
      </Card>

      {/* ── Peso de cada variable ───────────────────────────── */}
      <Card className="mb-5 animate-rise">
        <CardHeader>
          <CardTitle>{t('metricasIA.importancias')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {importancias.map(([variable, peso]) => (
            <div key={variable} className="flex items-center gap-2 sm:gap-3">
              <span className="w-28 shrink-0 truncate text-[13px] sm:w-52" title={variable}>
                {variable}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-200">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(peso / maxImportancia) * 100}%` }}
                />
              </div>
              <span className="nums w-12 shrink-0 text-right text-xs text-muted sm:w-14">
                {(peso * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Procedencia del artefacto ───────────────────────── */}
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>{t('metricasIA.procedencia')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            {(
              [
                [t('metricasIA.version'), m.model_version],
                [t('metricasIA.entrenadoEl'), formatoFecha],
                ['scikit-learn', m.sklearn_version],
                [t('metricasIA.semilla'), String(m.random_state)],
                [t('metricasIA.particionMuestras'), `${m.n_samples_train} / ${m.n_samples_test}`],
                [t('metricasIA.hashDataset'), m.dataset_hash?.slice(0, 16) ?? '—'],
                [t('metricasIA.hashModelo'), m.model_hash?.slice(0, 16) ?? '—'],
              ] as const
            ).map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between gap-3 border-b border-border py-1.5">
                <dt className="text-muted">{etiqueta}</dt>
                <dd className="nums text-right font-medium">{valor}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            {t('metricasIA.notaReproducibilidad')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
