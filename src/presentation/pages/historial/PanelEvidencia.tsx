import { useTranslation } from 'react-i18next'
import { FlaskConical, Thermometer } from 'lucide-react'

import type { EvidenciaInferencia } from '@/application/hooks/useEvidenciaInferencia'
import { estadoRiesgoDe, type LecturaTermica } from '@/domain/entities/LecturaTermica'
import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { BotonCopiar, Dato } from '../../components/registros/piezas'
import { RiskBadge } from '../../components/RiskBadge'
import { Button } from '../../components/ui/button'
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '../../components/ui/side-panel'

const COLOR_CLASE: Record<string, string> = {
  normal: 'bg-success-600',
  riesgo_preventivo: 'bg-warning-600',
  excursion_critica: 'bg-critical',
}

/**
 * «Cómo se obtuvo este riesgo» (HU-47): panel lateral de 480 px con todos
 * los campos de la evidencia. Abrirlo es la acción de la fila.
 */
export function PanelEvidencia({
  lectura,
  evidencia,
  cargando,
  error,
  onCerrar,
}: {
  lectura: LecturaTermica | null
  evidencia: EvidenciaInferencia | null
  cargando: boolean
  error: boolean
  onCerrar: () => void
}) {
  const { t } = useTranslation()
  return (
    <SidePanel open={lectura !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SidePanelContent className="sm:max-w-[480px]">
        <SidePanelHeader>
          <SidePanelTitle>{t('historial.evidenciaTitulo')}</SidePanelTitle>
          <SidePanelDescription className="codigo">
            {lectura ? `${lectura.device_id} · ${fechaHora(lectura.timestamp)}` : ''}
          </SidePanelDescription>
          {lectura?.id && (
            <p className="mt-2 flex items-center gap-1 text-meta text-muted">
              <span>{t('historial.idLectura')}:</span>
              <span className="codigo min-w-0 truncate text-subtle">{lectura.id}</span>
              <BotonCopiar valor={lectura.id} campo={t('historial.idLectura')} />
            </p>
          )}
        </SidePanelHeader>
        <SidePanelBody>
          {cargando ? (
            <div role="status" className="space-y-3">
              <span className="sr-only">{t('app.cargando')}</span>
              <div className="esqueleto h-16 rounded-(--radius-field)" />
              <div className="esqueleto h-24 rounded-(--radius-field)" />
              <div className="esqueleto h-20 rounded-(--radius-field)" />
            </div>
          ) : error ? (
            <p role="alert" className="rounded-(--radius-field) bg-critical-tint px-3 py-2 text-body text-critical">
              {t('historial.evidenciaNoDisponible')}
            </p>
          ) : (
            evidencia && (
              <div className="space-y-5">
                <section>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Dato etiqueta={t('historial.riesgoEfectivo')}>
                      {/* HU-34 esc. 4: sin clasificación IA o falla de sensor no se
                          rotulan Normal. Sin `estado_riesgo` en la evidencia (backend
                          anterior), el mismo estado que la fila del Historial. */}
                      <RiskBadge
                        nivel={
                          evidencia.estado_riesgo ??
                          estadoRiesgoDe(lectura) ??
                          (evidencia.effective_risk as NivelRiesgo | null) ??
                          null
                        }
                      />
                    </Dato>
                    <Dato etiqueta={t('historial.claseModelo')}>
                      {evidencia.model_class ? (
                        <RiskBadge nivel={evidencia.model_class as NivelRiesgo} />
                      ) : (
                        t('historial.sinInferencia')
                      )}
                    </Dato>
                  </dl>
                  <p className="mt-3 flex items-center gap-1.5 text-meta text-muted">
                    <Thermometer aria-hidden className="size-3.5 shrink-0" />
                    {t('historial.reglaDeterminista')}:{' '}
                    {evidencia.excursion_confirmada ? t('dashboard.excursionConfirmada') : t('historial.sinExcursion')}
                  </p>
                </section>
                {/* HU-47: «Ejemplo simulado» es solo de la demo. Con datos reales,
                    el modelo experimental se rotula como no aprobado. */}
                {evidencia.datos_simulados ? (
                  <p className="rounded-(--radius-field) bg-warning-100 px-3 py-2 text-meta text-warning-700">
                    {t('historial.evidenciaDemo')}
                  </p>
                ) : (
                  evidencia.ia_experimental && (
                    <p className="flex items-start gap-2 rounded-(--radius-field) bg-warning-100 px-3 py-2 text-meta text-warning-700">
                      <FlaskConical aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        <strong className="font-semibold">{t('historial.modeloExperimental')}</strong> {t('historial.modeloExperimentalAyuda')}
                      </span>
                    </p>
                  )
                )}
                {evidencia.probabilities && (
                  <section>
                    <h3 className="mb-2 text-body font-semibold text-foreground">
                      {t(evidencia.datos_simulados ? 'historial.probabilidadesEjemplo' : 'historial.probabilidadesModelo')}
                    </h3>
                    <div className="space-y-2.5">
                      {Object.entries(evidencia.probabilities).map(([clase, probabilidad]) => (
                        <div key={clase} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-meta">
                          <span className="text-subtle">{t(`riesgo.${clase}`)}</span>
                          <span className="nums font-semibold text-foreground">{(probabilidad * 100).toFixed(1)} %</span>
                          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                            <div
                              className={cn('h-full w-full origin-left rounded-full', COLOR_CLASE[clase] ?? 'bg-primary')}
                              style={{ transform: `scaleX(${Math.min(1, Math.max(0, probabilidad))})` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  <h3 className="mb-2 text-body font-semibold text-foreground">
                    {t(evidencia.datos_simulados ? 'historial.variablesEntrada' : 'historial.variablesEntradaModelo')}
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    {Object.entries(evidencia.feature_vector).map(([nombre, valor]) => (
                      <Dato key={nombre} etiqueta={t(`metricasIA.variables.${nombre}`, { defaultValue: nombre.replaceAll('_', ' ') })} className="nums text-meta font-medium">
                        {valor == null ? '—' : typeof valor === 'boolean' ? (valor ? t('comunes.si') : t('comunes.no')) : valor}
                      </Dato>
                    ))}
                  </dl>
                </section>
                <section>
                  <h3 className="mb-2 text-body font-semibold text-foreground">{t('historial.versionModelo')}</h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Dato etiqueta={t('historial.versionModelo')} className="nums">{evidencia.model_version ?? '—'}</Dato>
                    <Dato etiqueta={t('historial.estadoInferencia')}>
                      {evidencia.inference_status ? t(`historial.inferencia.${evidencia.inference_status}`) : '—'}
                    </Dato>
                    <Dato etiqueta={t('historial.fechaInferencia')} className="nums">
                      {evidencia.inference_at ? fechaHora(evidencia.inference_at) : '—'}
                    </Dato>
                    <Dato etiqueta={t('historial.horizonteModelo')} className="nums">
                      {evidencia.horizon_min != null ? `${evidencia.horizon_min} min` : '—'}
                    </Dato>
                    <Dato etiqueta={t('historial.esquemaCaracteristicas')} className="nums">
                      {evidencia.feature_schema_version ?? '—'}
                    </Dato>
                    <Dato etiqueta={t('historial.politicaOperativa')}>
                      {evidencia.operating_policy ? t(`historial.politica.${evidencia.operating_policy}`) : '—'}
                    </Dato>
                    {/* HU-47 esc. 2: cruce con el versionado operativo (HU-46). */}
                    <Dato etiqueta={t('historial.versionAprobadaAlClasificar')}>
                      <span data-testid="version-aprobada-al-clasificar" className={cn(evidencia.version_activa_y_aprobada === false && 'font-medium text-warning-700')}>
                        {evidencia.version_activa_y_aprobada == null
                          ? t('historial.versionAprobadaSinDato')
                          : evidencia.version_activa_y_aprobada
                            ? t('comunes.si')
                            : t('comunes.no')}
                      </span>
                      {evidencia.version_activa_y_aprobada === false && (
                        <span className="block text-meta text-muted">
                          {evidencia.version_activa_en_ese_momento
                            ? t('historial.versionActivaEraOtra', { version: evidencia.version_activa_en_ese_momento })
                            : t('historial.sinVersionActivaRegistrada')}
                        </span>
                      )}
                    </Dato>
                  </dl>
                </section>
              </div>
            )
          )}
        </SidePanelBody>
        <SidePanelFooter>
          <Button variant="ghost" onClick={onCerrar}>
            {t('comunes.cerrar')}
          </Button>
        </SidePanelFooter>
      </SidePanelContent>
    </SidePanel>
  )
}
