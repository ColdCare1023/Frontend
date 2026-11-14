import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'

import { useModeloIA } from '@/application/hooks/useModeloIA'
import { fechaCorta } from '@/lib/formato'
import { EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Esqueleto } from '../components/ui/esqueleto'
import { ComoSeEvaluo, FichaModelo, ImportanciaVariables, ResultadosPorClase } from './metricas/MetodoClasificador'
import { porcentaje } from './metricas/porcentaje'
import { EstadoEvaluacion, ResultadoEvaluacion, type EstadoClasificador } from './metricas/ResultadoEvaluacion'

// Umbral declarado en el RNF-04. Se presenta como criterio de evaluación del
// prototipo, no como garantía de seguridad ni de cumplimiento operativo.
const UMBRAL_F1 = 0.85

function EsqueletoClasificador() {
  const { t } = useTranslation()
  return (
    <div role="status" className="esqueleto-diferido space-y-3 xl:space-y-4">
      <span className="sr-only">{t('app.cargando')}</span>
      <Esqueleto aria-hidden className="h-12 w-full rounded-(--radius-card)" />
      <div aria-hidden className="grid gap-3 lg:grid-cols-12 xl:gap-4">
        <div className="superficie flex items-center gap-5 p-4 lg:col-span-5">
          <Esqueleto className="size-[120px] shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-4 w-full" />)}</div>
        </div>
        <div className="superficie space-y-3 p-4 lg:col-span-7">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-8 w-full" />)}</div>
        <Esqueleto className="h-64 lg:col-span-5" />
        <Esqueleto className="h-64 lg:col-span-7" />
      </div>
    </div>
  )
}

/**
 * Clasificador (RNF-04), Plantilla Documento en bento: primero el estado de
 * la evaluación (H10), después el F1 en un anillo y, a la vista y sin
 * plegar, la tabla por clase, la validación cruzada, las variables y la
 * ficha del modelo.
 */
export function MetricasIAPage() {
  const { t, i18n } = useTranslation()
  const { datos, cargando, noEntrenado, error, consultar } = useModeloIA()
  const m = datos?.metricas

  const encabezado = (
    <PageHeader
      titulo={t('metricasIA.titulo')}
      descripcion={t('metricasIA.descripcion')}
      meta={
        m && (
          <>
            {t('metricasIA.meta', { modelo: m.model_name, version: m.model_version, fecha: fechaCorta(m.trained_at) })}
          </>
        )
      }
    />
  )

  if (cargando) {
    return (
      <div>
        {encabezado}
        <EsqueletoClasificador />
      </div>
    )
  }

  if (noEntrenado || error || !datos || !m) {
    return (
      <div>
        {encabezado}
        {noEntrenado ? (
          <EstadoVacio ilustracion="sin-datos" titulo={t('metricasIA.noEntrenado')} />
        ) : (
          <EstadoError mensaje={t('metricasIA.errorCarga')}>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar()}>
              {t('metricasIA.reintentar')}
            </Button>
          </EstadoError>
        )}
      </div>
    )
  }

  const evaluacionVerificada = datos.datos_simulados === false && Boolean(m.dataset_hash && m.model_hash && m.particion)
  const estado: EstadoClasificador = !evaluacionVerificada ? 'sin-verificar' : m.f1_weighted >= UMBRAL_F1 ? 'cumple' : 'no-cumple'

  return (
    <div>
      {encabezado}
      <div className="space-y-3 xl:space-y-4">
        <EstadoEvaluacion estado={estado} umbral={porcentaje(UMBRAL_F1, i18n.resolvedLanguage, 0)} />
        {/* Desde 1024 px, dos columnas que se apilan por separado (5 + 7): en
            una rejilla de filas, cada tarjeta se estiraba al alto de su vecina
            y el F1 y las variables quedaban con 100–130 px en blanco. La última
            tarjeta de cada columna toma el sobrante para que ambas terminen
            alineadas. Bajo 1024 px las columnas se disuelven (`contents`) y
            `order` mantiene el orden de lectura: F1, resultados, método y variables. */}
        <div className="grid gap-3 lg:grid-cols-12 xl:gap-4">
          <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-3 xl:gap-4">
            <ResultadoEvaluacion className="order-1" metricas={m} estado={estado} umbral={UMBRAL_F1} />
            <ComoSeEvaluo className="order-3 lg:flex-1" metricas={m} umbral={UMBRAL_F1} />
          </div>
          <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-3 xl:gap-4">
            <ResultadosPorClase className="order-2" metricas={m} />
            <ImportanciaVariables className="order-4 lg:flex-1" metricas={m} />
          </div>
          <FichaModelo className="order-5 lg:col-span-12" metricas={m} />
        </div>
        <p className="flex items-start gap-2 text-meta text-muted">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {t('metricasIA.notaUsoProfesional')}
        </p>
      </div>
    </div>
  )
}
