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
  icono?: React.ComponentType<{ className?: string }>
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
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            {Icono && (
              <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary ring-1 ring-inset ring-primary/15">
                <Icono className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              <Titulo id={idTitulo} className="text-[15px] leading-6 font-semibold tracking-tight text-foreground">
                {titulo}
              </Titulo>
              {descripcion && <p className="mt-0.5 text-[13px] leading-5 text-muted">{descripcion}</p>}
            </div>
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </div>
        <div className={cn('p-4 sm:p-5', cuerpoClassName)}>{children}</div>
      </section>
    </Card>
  )
}
