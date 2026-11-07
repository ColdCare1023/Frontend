import { useTranslation } from 'react-i18next'

import type { EvidenciaInferencia } from '@/application/hooks/useEvidenciaInferencia'
import { fechaHora } from '@/lib/formato'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'

function Fila({ etiqueta, children, nums = false }: { etiqueta: string; children: React.ReactNode; nums?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
      <dt className="text-[13px] leading-5 text-muted">{etiqueta}</dt>
      <dd className={nums ? 'nums text-sm leading-5 font-semibold text-foreground' : 'text-sm leading-5 font-semibold text-foreground'}>{children}</dd>
    </div>
  )
}

/** Cómo se obtuvo el riesgo de una lectura: modelo, regla determinista y datos de entrada. */
export function EvidenciaLectura({
  lecturaId,
  evidencia,
  cargando,
  error,
  onCerrar,
}: {
  lecturaId: string | null
  evidencia: EvidenciaInferencia | null
  cargando: boolean
  error: boolean
  onCerrar: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={lecturaId !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogTitle>{t('historial.evidenciaTitulo')}</DialogTitle>
        <DialogDescription className="break-all">{t('historial.idLectura')}: {lecturaId}</DialogDescription>
        {cargando ? (
          <p role="status" className="mt-4 text-sm text-muted">{t('app.cargando')}</p>
        ) : error ? (
          <p role="alert" className="mt-4 rounded-(--radius-field) bg-critical-tint px-3 py-2 text-sm text-critical">{t('historial.evidenciaNoDisponible')}</p>
        ) : evidencia && (
          <div className="mt-4 space-y-5">
            {evidencia.datos_simulados && (
              <p className="rounded-(--radius-field) bg-honey-100 px-3 py-2 text-[13px] leading-5 font-medium text-honey-700">{t('historial.evidenciaDemo')}</p>
            )}
            <dl className="divide-y divide-border border-y border-border">
              <Fila etiqueta={t('historial.claseModelo')}>{evidencia.model_class ? t(`riesgo.${evidencia.model_class}`) : t('historial.sinInferencia')}</Fila>
              <Fila etiqueta={t('historial.riesgoEfectivo')}>{evidencia.effective_risk ? t(`riesgo.${evidencia.effective_risk}`) : '—'}</Fila>
              <Fila etiqueta={t('historial.versionModelo')} nums>{evidencia.model_version ?? '—'}</Fila>
              <Fila etiqueta={t('historial.estadoInferencia')}>{evidencia.inference_status ? t(`historial.inferencia.${evidencia.inference_status}`) : '—'}</Fila>
              <Fila etiqueta={t('historial.fechaInferencia')} nums>{evidencia.inference_at ? fechaHora(evidencia.inference_at) : '—'}</Fila>
            </dl>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t('historial.variablesEntrada')}</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] leading-5 sm:grid-cols-3">
                {Object.entries(evidencia.feature_vector).map(([nombre, valor]) => (
                  <div key={nombre}>
                    <dt className="text-muted">{t(`metricasIA.variables.${nombre}`, { defaultValue: nombre.replaceAll('_', ' ') })}</dt>
                    <dd className="nums font-medium text-foreground">{valor == null ? '—' : typeof valor === 'boolean' ? (valor ? t('comunes.si') : t('comunes.no')) : valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {evidencia.probabilities && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{t('historial.probabilidadesEjemplo')}</h3>
                <div className="space-y-2">
                  {Object.entries(evidencia.probabilities).map(([clase, probabilidad]) => (
                    <div key={clase} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px] leading-5">
                      <span className="text-foreground">{t(`riesgo.${clase}`)}</span>
                      <span className="nums font-semibold text-foreground">{(probabilidad * 100).toFixed(1)}%</span>
                      <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, probabilidad * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="border-t border-border pt-3 text-[13px] leading-5 text-muted">
              {t('historial.reglaDeterminista')}: {evidencia.excursion_confirmada ? t('dashboard.excursionConfirmada') : t('historial.sinExcursion')}
            </p>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onCerrar}>{t('comunes.cerrar')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
