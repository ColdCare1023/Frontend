import { useTranslation } from 'react-i18next'
import { CircleCheck, History } from 'lucide-react'

import type { AlertaTermica } from '@/domain/entities/AlertaTermica'
import { fechaHora, fechaHoraCompacta, haceCuanto } from '@/lib/formato'
import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'

/**
 * «Atendidas recientemente»: con pocas pendientes, el hueco bajo la lista se
 * llena con datos reales (las últimas atendidas), no con tarjetas de relleno.
 */
export function AtendidasRecientes({
  alertas,
  cantidad,
  ahora,
  onVerAtendidas,
  onCronologia,
  conAccion = true,
}: {
  alertas: readonly AlertaTermica[]
  cantidad: number
  ahora: number
  onVerAtendidas: () => void
  onCronologia: (alerta: AlertaTermica, disparador: HTMLElement) => void
  /** Sin filas, el vacío ya ofrece «Ver atendidas»: no se repite. */
  conAccion?: boolean
}) {
  const { t } = useTranslation()
  const lista = [...alertas]
    .sort((a, b) => (b.atendida_en ?? '').localeCompare(a.atendida_en ?? ''))
    .slice(0, cantidad)
  if (cantidad === 0 || lista.length === 0) return null
  return (
    <section aria-labelledby="atendidas-titulo" className="superficie overflow-hidden">
      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-border py-1.5 pr-2 pl-4">
        <h2 id="atendidas-titulo" className="text-title text-foreground">
          {t('alertas.rail.atendidasRecientes')}
        </h2>
        {conAccion && (
          <Button variant="ghost" size="sm" onClick={onVerAtendidas}>
            {t('alertas.vacio.verAtendidas')}
          </Button>
        )}
      </header>
      <ul className="divide-y divide-border">
        {lista.map((alerta) => {
          const fecha = fechaHoraCompacta(alerta.created_at)
          return (
            <li key={alerta.id} className="flex items-center justify-between gap-3 py-1.5 pr-2 pl-4">
              <p className="flex min-w-0 items-center gap-2 text-body">
                <CircleCheck aria-hidden className="size-4 shrink-0 text-success-600" />
                <span className="codigo truncate text-foreground">{alerta.device_id}</span>
                <time className="nums text-meta text-faint" dateTime={alerta.created_at ?? undefined} title={fechaHora(alerta.created_at)}>
                  {fecha}
                </time>
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <span className="nums text-meta text-faint max-sm:hidden">
                  {t('alertas.rail.atendidaHace', { hace: haceCuanto(alerta.atendida_en, ahora) })}
                </span>
                <Tooltip lado="top" contenido={t('alertas.verDetalle')}>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-haspopup="dialog"
                    aria-label={t('alertas.cronologiaA', { equipo: alerta.device_id, fecha })}
                    className="w-11 px-0 sm:w-9"
                    onClick={(e) => onCronologia(alerta, e.currentTarget)}
                  >
                    <History aria-hidden />
                  </Button>
                </Tooltip>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
