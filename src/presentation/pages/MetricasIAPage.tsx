import { useTranslation } from 'react-i18next'
import { Brain, Info } from 'lucide-react'

import { useModeloIA, type MetricasPorClase } from '@/application/hooks/useModeloIA'
import { fechaHora } from '@/lib/formato'
import { EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { Indicador, Indicadores } from '../components/ui/indicadores'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { TituloPagina } from '../components/ui/titulo-pagina'
import { aciertosDeCada100 } from './clasificador/aciertos'
import { CampoCifra, EsqueletoClasificador, MatrizConfusion, PesoVariables, Veredicto } from './clasificador/SeccionesClasificador'

// Umbral declarado en el RNF-04. Se presenta como criterio de evaluación del
// prototipo, no como garantía de seguridad ni de cumplimiento operativo.
const UMBRAL_F1 = 0.85

const ORDEN_CLASES = ['riesgo_preventivo', 'normal'] as const

/** Cuántas variables se nombran en la vista inicial: las demás quedan en los detalles. */
const VARIABLES_A_LA_VISTA = 3

function porcentaje(valor: number, locale: string, decimales = 2): string {
  const localeNumero = locale.startsWith('en') ? 'en-US' : 'es-PE'
  const numero = new Intl.NumberFormat(localeNumero, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor * 100)
  // Espacio duro: «85» y «%» no se separan al final de una línea.
  return `${numero}\u00a0%`
}

function esMetricaDeClase(valor: unknown): valor is MetricasPorClase {
  return typeof valor === 'object' && valor !== null && 'f1-score' in valor
}

/** Un apartado de los detalles: título y una línea de contexto para quien no ve la pantalla. */
function Apartado({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="text-[15px] leading-6 font-semibold tracking-[-0.01em] text-foreground">{titulo}</h3>
      {descripcion && <p className="sr-only">{descripcion}</p>}
      <div className="mt-2">{children}</div>
    </section>
  )
}

/**
 * El clasificador para quien atiende la botica: qué es, en una frase; cuántas veces acertó en la
 * muestra, con su advertencia del mismo tamaño; y qué datos mira. F1, matriz, validación y la
 * identidad del modelo siguen a un clic, en «Ver detalles técnicos».
 */
export function MetricasIAPage() {
  const { t, i18n } = useTranslation()
  const { datos, cargando, noEntrenado, error, consultar } = useModeloIA()

  const encabezado = (
    <TituloPagina
      antetitulo={t('nav.seccionCumplimiento')}
      titulo={t('metricasIA.titulo')}
      descripcion={t('metricasIA.descripcion')}
    />
  )

  if (cargando) {
    return (
      <div className="flex flex-1 flex-col">
        {encabezado}
        <EsqueletoClasificador />
      </div>
    )
  }

  if (noEntrenado || error || !datos) {
    return (
      <div className="flex flex-1 flex-col">
        {encabezado}
        {noEntrenado ? (
          // 503: un entorno sin modelo entrenado es un estado legítimo, no un fallo.
          <EstadoVacio icono={Brain} titulo={t('metricasIA.noEntrenado')} />
        ) : (
          <EstadoError mensaje={t('metricasIA.errorCarga')}>
            {error && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar()}>
                {t('metricasIA.reintentar')}
              </Button>
            )}
          </EstadoError>
        )}
      </div>
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
  const contextoUmbral = t('metricasIA.contextoUmbral', { umbral: pct(UMBRAL_F1, 0) })
  const etiquetaVariable = (variable: string) =>
    t(`metricasIA.variables.${variable}`, { defaultValue: variable.replaceAll('_', ' ') })
  const importancias = Object.entries(m.feature_importances).sort(([, a], [, b]) => b - a)

  return (
    <div className="flex flex-1 flex-col">
      {encabezado}
      <div className="flex flex-col gap-5 sm:gap-6">
        <CampoCifra
          aciertos={aciertosDeCada100(m.accuracy)}
          mirados={importancias.slice(0, VARIABLES_A_LA_VISTA).map(([variable]) => etiquetaVariable(variable))}
          verificada={evaluacionVerificada}
          cumple={cumpleUmbral}
          contextoUmbral={contextoUmbral}
        />
        <p className="flex max-w-[72ch] items-start gap-2 text-[13.5px] leading-5 text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
          {t('metricasIA.notaEvaluacion')}
        </p>

        {/* ── Lo técnico: a un clic, nunca antes que la advertencia ── */}
        <section aria-labelledby="metodo-evaluacion-titulo" className="min-w-0 border-y border-border">
          <h2 id="metodo-evaluacion-titulo" className="sr-only">{t('metricasIA.detalleTitulo')}</h2>
          <Detalles
            titulo={<span className="text-[15px] font-semibold text-foreground">{t('metricasIA.detalleTitulo')}</span>}
            className="[&>button]:min-h-13"
          >
            {/* `relative`: lo oculto para lectores se coloca aquí dentro y, plegado, no alarga la página. */}
            <div className="relative flex flex-col gap-9 pt-2 pb-8">
              <div className="flex flex-col gap-5">
                {!evaluacionVerificada && (
                  <Veredicto verificada={false} cumple={false} contextoUmbral={contextoUmbral} />
                )}
                <Indicadores className="gap-x-8">
                  <Indicador etiqueta={t('metricasIA.f1Ponderado')} valor={pct(m.f1_weighted)} />
                  <Indicador etiqueta={t('metricasIA.exactitudGeneral')} valor={pct(m.accuracy)} />
                  <Indicador etiqueta={t('metricasIA.casosEvaluados')} valor={entero(m.n_samples_test)} />
                </Indicadores>
              </div>

              <div className="grid items-start gap-x-12 gap-y-9 min-[1100px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <PesoVariables importancias={importancias} etiqueta={etiquetaVariable} porcentaje={(valor) => pct(valor, 1)} verificada={evaluacionVerificada} />
                <MatrizConfusion clases={m.classes} matriz={m.confusion_matrix} entero={entero} verificada={evaluacionVerificada} />
              </div>

              <div className="grid gap-x-12 gap-y-9 min-[1100px]:grid-cols-2">
                <div className="min-w-0 space-y-8">
                  <Apartado titulo={t('metricasIA.porClase')} descripcion={t('metricasIA.porClaseAyuda')}>
                    <p className="mb-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
                      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
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
                              <TableCell data-label="F1" className="nums whitespace-nowrap">{pct(fila['f1-score'])}</TableCell>
                              <TableCell data-label={t('metricasIA.precision')} className="nums whitespace-nowrap">{pct(fila.precision)}</TableCell>
                              <TableCell data-label={t('metricasIA.deteccion')} className="nums whitespace-nowrap">{pct(fila.recall)}</TableCell>
                              <TableCell data-label={t('metricasIA.casosEvaluados')} className="nums text-muted">{entero(fila.support)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </Apartado>

                  <Apartado titulo={t('metricasIA.queSignifica')}>
                    <dl className="grid gap-3 text-xs leading-5 sm:grid-cols-2 sm:gap-6">
                      <div>
                        <dt className="font-medium text-foreground">{t('metricasIA.f1Ponderado')}</dt>
                        <dd className="mt-0.5 text-muted">{t('metricasIA.definicionF1')}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">{t('metricasIA.exactitudGeneral')}</dt>
                        <dd className="mt-0.5 text-muted">{t('metricasIA.definicionExactitud')}</dd>
                      </div>
                    </dl>
                  </Apartado>
                </div>

                <div className="min-w-0 space-y-8">
                  <Apartado
                    titulo={t('metricasIA.comoSeEvaluo')}
                    descripcion={t('metricasIA.comoSeEvaluoAyuda', { folds: m.cross_validation.folds })}
                  >
                    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-medium text-muted">{t('metricasIA.promedioF1')}</dt>
                        <dd className="nums mt-1 text-base font-semibold text-foreground">{pct(m.cross_validation.mean)}</dd>
                        <dd className="mt-1 text-xs leading-relaxed text-muted">
                          {t('metricasIA.variacionReportada', { variacion: pct(m.cross_validation.std) })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted">{t('metricasIA.particiones')}</dt>
                        <dd className="mt-1 text-sm font-medium text-foreground">{t('metricasIA.agrupadasPorEscenario')}</dd>
                        <dd className="mt-1 text-xs leading-relaxed text-muted">{t('metricasIA.agrupacionAyuda')}</dd>
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
                        <dd className="mt-1 text-xs leading-relaxed text-muted">
                          {t('metricasIA.totalRegistros', { total: entero(m.n_samples) })}
                        </dd>
                      </div>
                    </dl>
                  </Apartado>

                  <Apartado titulo={t('metricasIA.identidadModelo')}>
                    <dl className="grid gap-x-8 text-xs sm:grid-cols-2">
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
                  </Apartado>
                </div>
              </div>
            </div>
          </Detalles>
        </section>

        <p className="flex max-w-[72ch] items-start gap-2 text-[13.5px] leading-5 text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
          {t('metricasIA.notaUsoProfesional')}
        </p>
      </div>
    </div>
  )
}
