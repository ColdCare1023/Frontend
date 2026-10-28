import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/**
 * Información secundaria plegada: la pantalla muestra lo esencial y el resto
 * queda a un clic, sin borrarse. Se despliega animando la altura (grid 0fr →
 * 1fr) y, cerrada, sale del orden de tabulación (`inert`).
 */
export function Detalles({
  titulo,
  abiertoInicial = false,
  className,
  children,
}: {
  /** Texto del interruptor; por defecto «Ver detalles» / «Ocultar detalles». */
  titulo?: React.ReactNode
  abiertoInicial?: boolean
  className?: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [abierto, setAbierto] = useState(abiertoInicial)
  const id = useId()

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((previo) => !previo)}
        className="group flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left text-[13px] font-medium text-muted transition-colors duration-(--duration-micro) hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span>{titulo ?? (abierto ? t('comunes.ocultarDetalles') : t('comunes.verDetalles'))}</span>
        <ChevronDown
          aria-hidden
          className={cn('size-4 shrink-0 transition-transform duration-(--duration-ui) ease-(--ease-out-soft)', abierto && 'rotate-180')}
        />
      </button>
      <div
        id={id}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-(--duration-panel) ease-(--ease-out-soft)',
          abierto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!abierto}>
          <div className="pt-2">{children}</div>
        </div>
      </div>
    </div>
  )
}
