import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { HistorialConfiguracion } from '@/domain/entities/Dispositivo'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { EsqueletoTexto } from '../../../components/ui/esqueleto'
import { campoBase } from '../estadoEquipo'

function valorConUnidad(campo: string, valor: string | null, idioma: string) {
  if (valor == null) return '—'
  if (!/^\d+$/.test(valor)) return valor
  if (campo.endsWith('_segundos')) return `${valor} s`
  if (campo.endsWith('_dias')) {
    return new Intl.NumberFormat(idioma, { style: 'unit', unit: 'day', unitDisplay: 'long' }).format(Number(valor))
  }
  return valor
}

/**
 * HU-49: cada cambio con su etiqueta legible y el campo técnico (lo exige la
 * auditoría), valor anterior tachado → valor nuevo, la fecha, QUIÉN lo hizo
 * (esc. 1) y desde cuándo hasta cuándo estuvo vigente (esc. 2).
 */
export function LineaTiempoCambios({
  cambios,
  cargando,
  campos,
  vacio,
  className,
  resumir = false,
}: {
  cambios: readonly HistorialConfiguracion[]
  cargando: boolean
  /** Si se indica, solo esos campos. */
  campos?: readonly string[]
  vacio?: string
  resumir?: boolean
  className?: string
}) {
  const { t, i18n } = useTranslation()
  if (cargando) return <EsqueletoTexto lineas={4} />
  const visibles = campos ? cambios.filter((c) => campos.includes(campoBase(c))) : cambios
  if (visibles.length === 0) {
    return <p className="text-meta text-muted">{vacio ?? t('dispositivos.sinHistorial')}</p>
  }
  return (
    <ol className={cn(resumir ? 'divide-y divide-border' : 'space-y-3 border-l border-border pl-4', className)}>
      {visibles.map((c) => {
        const campo = campoBase(c)
        const actor = c.actor_nombre ?? c.actor_id
        const vigenteDesde = c.vigente_desde ?? c.created_at
        const vigencia = c.vigente_desde !== undefined && (
          <p className="nums text-meta text-muted">
            {c.vigente_hasta
              ? t('dispositivos.cambio.vigenteEntre', { desde: fechaHora(vigenteDesde), hasta: fechaHora(c.vigente_hasta) })
              : t('dispositivos.cambio.vigenteDesde', { desde: fechaHora(vigenteDesde) })}
          </p>
        )
        const Contenedor = resumir ? 'details' : 'div'
        const Encabezado = resumir ? 'summary' : 'div'
        return (
          <li key={c.id} className="min-w-0" data-campo={campo}>
            <Contenedor className="group/cambio">
              <Encabezado className={cn('grid grid-cols-[1fr_auto] items-baseline gap-x-3', resumir && 'min-h-11 cursor-pointer list-none rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden')}>
                <span className="min-w-0 text-body font-medium text-foreground">
                  {t(`dispositivos.campos.${campo}`, { defaultValue: campo })}
                  {!resumir && <span className="codigo ml-1 text-micro font-normal text-faint">{c.campo}</span>}
                </span>
                <span className="nums inline-flex items-center gap-2 text-meta text-muted">
                  {fechaHora(c.created_at)}
                  {resumir && <ChevronDown aria-hidden className="size-4 shrink-0 group-open/cambio:rotate-180" />}
                </span>
                <span className="col-span-full break-words text-meta">
                  <span className="text-muted line-through">{valorConUnidad(campo, c.valor_anterior, i18n.language)}</span>
                  {' → '}
                  <span className="font-medium text-foreground">{valorConUnidad(campo, c.valor_nuevo, i18n.language)}</span>
                </span>
              </Encabezado>
              <div className={cn('text-meta text-muted', resumir && 'mt-1 space-y-1 border-l border-border pl-3')}>
                <p>
                  {actor ? t('dispositivos.cambio.actor', { actor }) : t('dispositivos.cambio.sinActor')}
                  {c.origen && <> · {t('dispositivos.cambio.origen', { origen: c.origen })}</>}
                </p>
                {resumir && <p className="codigo break-words">{c.campo}</p>}
                {vigencia}
              </div>
            </Contenedor>
          </li>
        )
      })}
    </ol>
  )
}
