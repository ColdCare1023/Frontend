import { cn } from '@/lib/utils'

/**
 * Bloque de carga (SmoothUI Content Skeleton). Aparece tras 150 ms para no
 * destellar si la carga es rápida; el brillo recorre con `transform`. Es
 * decorativo: quien lo usa anuncia la carga (`role="status"` + texto).
 */
export function Esqueleto({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('esqueleto rounded-(--radius-small)', className)} {...props} />
}

/** Líneas de texto de anchos decrecientes. */
export function EsqueletoTexto({ lineas = 3, className }: { lineas?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('space-y-2', className)}>
      {Array.from({ length: lineas }, (_, i) => (
        <Esqueleto key={i} className="h-3" style={{ width: `${Math.max(40, 100 - i * 18)}%` }} />
      ))}
    </div>
  )
}

/** Tabla con la geometría real: cabecera de 36 px y filas de 44 px. */
export function EsqueletoTabla({ filas = 5, columnas = 4, className }: { filas?: number; columnas?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('superficie overflow-hidden', className)}>
      <div className="flex h-9 items-center gap-4 border-b border-border bg-surface-sunken px-4">
        {Array.from({ length: columnas }, (_, i) => (
          <Esqueleto key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: filas }, (_, fila) => (
        <div key={fila} className="flex h-11 items-center gap-4 border-b border-border px-4 last:border-b-0">
          {Array.from({ length: columnas }, (_, i) => (
            <Esqueleto key={i} className="h-3 flex-1" style={{ maxWidth: i === 0 ? '9rem' : undefined }} />
          ))}
        </div>
      ))}
    </div>
  )
}
