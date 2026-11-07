import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react'

import type {
  DetalleInconsistencia,
  VerificacionIntegridad,
  VerificacionSegmento,
} from '@/domain/entities/RegistroTrazabilidad'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Badge } from '../../components/ui/badge'
import { Detalles } from '../../components/ui/detalles'
import { etiquetaEvento } from './cadena'

/** HU-26 escenario 4: el resultado declara qué certifica y qué no. */
export function AlcanceVerificacion({ texto, className }: { texto?: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <p data-testid="alcance-verificacion" className={cn('max-w-[72ch] text-[13px] leading-5 text-muted', className)}>
      {texto ?? t('trazabilidad.alcanceVerificacion')}
    </p>
  )
}

function Dato({ etiqueta, className, children }: { etiqueta: string; className?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] leading-5 text-muted">{etiqueta}</dt>
      <dd className={cn('mt-0.5 text-[15px] leading-6 font-semibold tracking-[-0.01em] text-foreground', className)}>{children}</dd>
    </div>
  )
}

/**
 * RF-15: «la cadena está rota en la posición 42» no permite actuar; el auditor necesita saber qué
 * registro es, de cuándo y en qué se diferencia el sello recalculado del almacenado.
 */
export function DetalleRuptura({ verificacion, detalle }: { verificacion: VerificacionIntegridad; detalle: DetalleInconsistencia }) {
  const { t } = useTranslation()
  const posteriores = verificacion.registros_posteriores_afectados
  return (
    <section data-testid="detalle-inconsistencia" className="superficie mt-4 p-4 sm:p-6">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
        <Dato etiqueta={t('trazabilidad.evento')}>{etiquetaEvento(detalle.tipo_evento, t)}</Dato>
        <Dato etiqueta={t('trazabilidad.fecha')} className="nums">{fechaHora(detalle.timestamp)}</Dato>
        {detalle.tipo_discrepancia && (
          <Dato etiqueta={t('trazabilidad.tipoDiscrepancia')}>{t(`trazabilidad.discrepancia_${detalle.tipo_discrepancia}`)}</Dato>
        )}
        {posteriores > 0 && (
          <Dato etiqueta={t('trazabilidad.posterioresAfectados')} className="nums text-[34px] leading-10 tracking-[-0.03em] text-critical">
            {posteriores}
          </Dato>
        )}
        {/* HU-26 escenario 2: una alteración puntual no invalida lo
            posterior; se informa cuánto sigue enlazado. */}
        {posteriores > 0 && verificacion.registros_posteriores_consistentes != null && (
          <Dato etiqueta={t('trazabilidad.posterioresConsistentes')} className="nums">
            {t('trazabilidad.posterioresConsistentesValor', {
              c: verificacion.registros_posteriores_consistentes,
              n: posteriores,
            })}
          </Dato>
        )}
        {(verificacion.total_rupturas ?? 0) > 1 && (
          <Dato etiqueta={t('trazabilidad.totalRupturas')} className="nums text-critical">{verificacion.total_rupturas}</Dato>
        )}
      </dl>
      <Detalles className="mt-3">
        <dl className="grid gap-3 pb-1">
          <Dato etiqueta={t('trazabilidad.registroAfectado')} className="hash-tecnico nums break-all text-[13.5px] leading-5 tracking-normal">{detalle.id}</Dato>
          <Dato etiqueta={t('trazabilidad.hashEsperado')} className="hash-tecnico nums break-all text-[13.5px] leading-5 font-normal tracking-normal text-success-700">
            {detalle.hash_esperado}
          </Dato>
          <Dato etiqueta={t('trazabilidad.hashAlmacenado')} className="hash-tecnico nums break-all text-[13.5px] leading-5 font-normal tracking-normal text-critical">
            {detalle.hash_almacenado}
          </Dato>
        </dl>
        <AlcanceVerificacion texto={verificacion.alcance} className="mt-3" />
      </Detalles>
    </section>
  )
}

/** HU-37: resultado de la verificación por dispositivo y periodo. */
export function ResultadoSegmento({ resultado }: { resultado: VerificacionSegmento }) {
  const { t } = useTranslation()
  const idResumen = useId()
  const Icono = resultado.integra ? ShieldCheck : ShieldAlert
  return (
    <section role="status" className="superficie mt-3 overflow-hidden">
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5', resultado.integra ? 'bg-campo-rango text-campo-rango-tinta' : 'bg-campo-critico text-campo-critico-tinta')}>
        <Icono className="size-5 shrink-0" aria-hidden />
        <p className="text-[17px] leading-6 font-semibold tracking-[-0.015em]">
          {resultado.integra ? t('trazabilidad.segmentoIntegro') : t('trazabilidad.segmentoRoto')}
        </p>
        <p id={idResumen} className="nums text-[13.5px] leading-5">
          {t('trazabilidad.segmentoResumen', { n: resultado.total_bloques_verificados, device: resultado.device_id })}
        </p>
      </div>
      {resultado.registros_del_dispositivo.length > 0 && (
        // Lista con desplazamiento propio: alcanzable con el teclado.
        <ul
          tabIndex={0}
          aria-labelledby={idResumen}
          className="max-h-56 divide-y divide-border overflow-y-auto px-4 text-[13.5px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
        >
          {resultado.registros_del_dispositivo.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span className="nums shrink-0 text-muted sm:w-48">{fechaHora(r.timestamp)}</span>
              <span className="min-w-0 flex-1 font-medium text-foreground">{etiquetaEvento(r.tipo_evento, t)}</span>
              <Badge variant={r.integro ? 'ok' : 'critical'}>{r.integro ? t('trazabilidad.integro') : t('trazabilidad.corrupto')}</Badge>
            </li>
          ))}
        </ul>
      )}
      <Detalles className="px-4 sm:px-5">
        <AlcanceVerificacion texto={resultado.alcance} className="pb-3" />
      </Detalles>
    </section>
  )
}

export function SelloTecnico({ etiqueta, hash }: { etiqueta: string; hash: string }) {
  return (
    <details className="group min-w-0 text-left">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-1 rounded-md px-1.5 py-1 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[11.5px] leading-4 font-medium text-muted">{etiqueta}</span>
          <code className="hash-tecnico nums block max-w-full truncate text-[12px] leading-4 text-foreground">{hash.slice(0, 12)}…{hash.slice(-8)}</code>
        </span>
        <ChevronDown aria-hidden className="size-3 shrink-0 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <code className="hash-tecnico nums mt-1 block break-all rounded-md border border-border bg-surface-sunken p-2 text-[12px] leading-4 text-muted">{hash}</code>
    </details>
  )
}
