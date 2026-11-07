import { cn } from '@/lib/utils'
import { Card } from './card'

/**
 * Sección de pantalla con cabecera fija: icono, título, descripción y
 * acciones a la derecha; el contenido ocupa todo el ancho debajo. Sustituye a
 * los bloques sueltos para que cada pantalla se lea por secciones claras.
 */
export function Panel({
  titulo,
  descripcion,
  icono: Icono,
  acciones,
  nivel = 2,
  id,
  className,
  cuerpoClassName,
  children,
}: {
  titulo: React.ReactNode
  descripcion?: React.ReactNode
  icono?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  acciones?: React.ReactNode
  nivel?: 2 | 3
  id?: string
  className?: string
  cuerpoClassName?: string
  children?: React.ReactNode
}) {
  const Titulo = nivel === 2 ? 'h2' : 'h3'
  const idTitulo = id ? `${id}-titulo` : undefined
  return (
    <Card className={cn('min-w-0', className)}>
      <section aria-labelledby={idTitulo} id={id}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icono && (
              <Icono aria-hidden className="size-4 shrink-0 text-faint" />
            )}
            <div className="min-w-0">
              <Titulo id={idTitulo} className="text-base leading-6 font-semibold tracking-[-0.015em] text-foreground">
                {titulo}
              </Titulo>
              {descripcion && <p className="sr-only">{descripcion}</p>}
            </div>
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </div>
        <div className={cn('p-4 pt-3 sm:p-5 sm:pt-4', cuerpoClassName)}>{children}</div>
      </section>
    </Card>
  )
}
