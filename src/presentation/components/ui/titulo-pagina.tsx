import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Título de pantalla grande y apretado (36 a 64 px), con sus acciones al lado. La
 * antetítulo y la descripción quedan para el lector de pantalla: la pantalla se explica sola.
 */
export function TituloPagina({
  titulo,
  antetitulo,
  descripcion,
  className,
  children,
}: {
  titulo: ReactNode
  antetitulo?: string
  descripcion?: string
  className?: string
  /** Acciones a la derecha. */
  children?: ReactNode
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-8', className)}>
      <div className="min-w-0 flex-1 basis-60">
        {antetitulo && <span className="sr-only">{antetitulo}</span>}
        <h1 className="titulo-pagina">{titulo}</h1>
        {descripcion && <p className="sr-only">{descripcion}</p>}
      </div>
      {children && <div className="flex max-w-full flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
