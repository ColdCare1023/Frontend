import { cn } from '@/lib/utils'

/**
 * Cambio de texto (transitions.dev Text swap): «Guardar» → «Guardando…» →
 * «Registrada», o «Verificando…» → veredicto. El texto nuevo entra con un
 * fundido de 160 ms; el anterior se va al instante. `anunciar` lo hace una
 * región `aria-live="polite"`. Fija un `min-width` en el contenedor si el
 * cambio no debe mover el layout (p. ej. dentro de un botón).
 */
export function CambioTexto({
  texto,
  icono,
  anunciar = false,
  className,
}: {
  texto: string
  icono?: React.ReactNode
  anunciar?: boolean
  className?: string
}) {
  return (
    <span aria-live={anunciar ? 'polite' : undefined} className={cn('inline-grid', className)}>
      <span key={texto} className="inline-flex items-center gap-2 animate-(--animate-swap)">
        {icono}
        {texto}
      </span>
    </span>
  )
}
