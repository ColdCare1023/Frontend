import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'

import { useClasificacionPreventiva } from '@/application/hooks/useClasificacionPreventiva'
import { useModeloIA } from '@/application/hooks/useModeloIA'
import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso } from '@/domain/value-objects/Rol'
import { fechaCorta } from '@/lib/formato'
import { EstadoError } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Esqueleto } from '../components/ui/esqueleto'
import { EstadoModelo } from './metricas/EstadoModelo'
import { EstadoClasificacionPreventiva } from './metricas/EstadoPreventivo'
import { ComoSeEvaluo, FichaModelo, ImportanciaVariables, ResultadosPorClase } from './metricas/MetodoClasificador'
import { porcentaje } from './metricas/porcentaje'
import { EstadoEvaluacion, ResultadoEvaluacion, type EstadoClasificador } from './metricas/ResultadoEvaluacion'
import { VersionesModelo } from './metricas/VersionesModelo'

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

export function MetricasIAPage({ integrada = false }: { integrada?: boolean } = {}) {
  const { t, i18n } = useTranslation()
  const { datos, estado, motivo, consultar, recargar } = useModeloIA()
  const m = datos?.metricas
  const preventiva = useClasificacionPreventiva()
  // HU-46: el versionado lo lee el auditor y lo gestiona el administrador
  // (GET: ADMINISTRADOR, AUDITOR; POST registrar/activar/desactivar:
  // ADMINISTRADOR). El QF no lo ve: 403.
  const rol = useAuthStore((s) => s.usuario?.rol)
  const verVersiones = rol !== undefined && tienePermiso(rol, ['auditor'])
  const gobernado = preventiva.clasificacion
  const versiones = verVersiones ? (
    <VersionesModelo
      puedeGestionar={rol !== undefined && tienePermiso(rol, [])}
      artefacto={gobernado ? { modelo: gobernado.artefactoGobernado, version: gobernado.artefactoGobernado === 'preventivo' ? gobernado.version : null } : null}
      onCambio={() => {
        // Activar o desactivar una versión cambia el estado preventivo y el del
        // modelo legado (su huella se fija a la versión activa): se releen ambos.
        void preventiva.recargar()
        void recargar()
      }}
    />
  ) : null
  const estadoPreventivo = preventiva.clasificacion ? (
    <EstadoClasificacionPreventiva clasificacion={preventiva.clasificacion} />
  ) : (
    <p role="status" className="py-4 text-body text-subtle">
      {t(preventiva.cargando ? 'app.cargando' : 'lectura.estadoPreventivoDesconocido')}
    </p>
  )

  const encabezado = !integrada && <PageHeader titulo={t('metricasIA.titulo')} descripcion={t('metricasIA.descripcion')} />

  if (estado === 'cargando') {
    return (
      <div>
        {encabezado}
        <EsqueletoClasificador />
      </div>
    )
  }

  let cuerpo: React.ReactNode
  if (estado !== 'disponible' || !datos || !m) {
    cuerpo = (
      <>
        {/* HU-16: 503 «rechazado por verificación» no es «no entrenado» ni un error de red. */}
        {estado === 'rechazado' || estado === 'no_entrenado' ? (
          <EstadoModelo estado={estado} motivo={motivo} />
        ) : (
          <EstadoError mensaje={t('metricasIA.errorCarga')}>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar()}>
              {t('metricasIA.reintentar')}
            </Button>
          </EstadoError>
        )}
        {estadoPreventivo}
      </>
    )
  } else {
    const evaluacionVerificada = datos.datos_simulados === false && Boolean(m.dataset_hash && m.model_hash && m.particion)
    const estadoEvaluacion: EstadoClasificador = !evaluacionVerificada ? 'sin-verificar' : m.f1_weighted >= UMBRAL_F1 ? 'cumple' : 'no-cumple'
    cuerpo = (
      <>
        {estadoPreventivo}
        <SeccionDetalle titulo={t('lectura.evaluacion')}>
          <p className="text-meta text-muted">
            {t('metricasIA.meta', { modelo: m.model_name, version: m.model_version, fecha: fechaCorta(m.trained_at) })}
          </p>
          <EstadoModelo estado="disponible" version={datos.metadata?.model_version ?? m.model_version} />
          <EstadoEvaluacion estado={estadoEvaluacion} umbral={porcentaje(UMBRAL_F1, i18n.resolvedLanguage, 0)} />
          <div className="grid gap-3 lg:grid-cols-12 xl:gap-4">
            <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-3 xl:gap-4">
              <ResultadoEvaluacion className="order-1" metricas={m} estado={estadoEvaluacion} umbral={UMBRAL_F1} />
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
        </SeccionDetalle>
      </>
    )
  }

  return (
    <div>
      {encabezado}
      <div className="superficie mx-auto max-w-5xl overflow-clip px-3 sm:px-5">
        {cuerpo}
        {/* Misma posición con y sin modelo cargado: activar o desactivar una
            versión puede cambiar el estado del modelo y la sección no se vuelve
            a montar (conserva el aviso anunciado y el foco). Sin modelo cargado
            (503) el administrador necesita justo esto: registrar y activar. */}
        {versiones && <SeccionDetalle titulo={t('metricasIA.versiones.titulo')}>{versiones}</SeccionDetalle>}
      </div>
    </div>
  )
}
