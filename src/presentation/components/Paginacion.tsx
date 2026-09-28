import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { TAMANO_PAGINA, totalPaginas } from '@/lib/paginacion'
import { Button } from './ui/button'

/**
 * Paginación en cliente para las tablas del sistema.
 *
 * Las listas del sistema (historial térmico, trazabilidad, auditoría) crecen
 * sin techo: un refrigerador genera 2 880 lecturas al día. Volcarlas todas en
 * una sola tabla obligaba a desplazarse durante minutos para llegar al final y
 * hacía imposible situarse — justo lo contrario de lo que necesita alguien que
 * revisa evidencia.
 *
 * Se pagina en cliente y no en servidor porque los hooks ya piden un tope
 * acotado al backend (`limite`); partir ese resultado en páginas no añade
 * peticiones y mantiene los filtros instantáneos.
 */

interface PaginacionProps {
  /** Total de elementos de la lista completa, no de la página actual. */
  total: number
  pagina: number
  onCambiar: (pagina: number) => void
  tamano?: number
}

export function Paginacion({ total, pagina, onCambiar, tamano = TAMANO_PAGINA }: PaginacionProps) {
  const { t } = useTranslation()
  const paginas = totalPaginas(total, tamano)

  // Al aplicar un filtro la lista se acorta, y quien estuviera en la página 7
  // se quedaría mirando una tabla vacía sin entender por qué. Se corrige aquí
  // —y no en cada página— para que ninguna pueda olvidarlo.
  useEffect(() => {
    if (pagina > paginas) onCambiar(paginas)
  }, [pagina, paginas, onCambiar])

  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1
  const hasta = Math.min(pagina * tamano, total)

  /** Ventana de números alrededor de la página actual, con elipsis.
   *  Sin esto, 200 páginas producirían 200 botones. */
  const numeros = useMemo(() => {
    const salida: Array<number | 'gap'> = []
    const cerca = (n: number) => Math.abs(n - pagina) <= 1
    for (let n = 1; n <= paginas; n++) {
      if (n === 1 || n === paginas || cerca(n)) salida.push(n)
      else if (salida[salida.length - 1] !== 'gap') salida.push('gap')
    }
    return salida
  }, [pagina, paginas])

  // Una sola página no necesita controles, pero el recuento sigue orientando.
  if (paginas <= 1) {
    return total > 0 ? (
      <p className="mt-3 text-xs text-muted">{t('comunes.totalRegistros', { total })}</p>
    ) : null
  }

  return (
    <nav
      className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-border pt-3 sm:flex-row"
      aria-label={t('comunes.paginacion')}
    >
      <p className="text-xs text-muted">
        {t('comunes.rangoMostrado', { desde, hasta, total })}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCambiar(pagina - 1)}
          disabled={pagina === 1}
          aria-label={t('comunes.anterior')}
        >
          <ChevronLeft className="size-4" />
        </Button>

        {numeros.map((n, i) =>
          n === 'gap' ? (
            <span key={`gap-${i}`} className="px-1.5 text-xs text-faint" aria-hidden>
              …
            </span>
          ) : (
            <Button
              key={n}
              variant={n === pagina ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onCambiar(n)}
              aria-current={n === pagina ? 'page' : undefined}
              className="nums min-w-8"
            >
              {n}
            </Button>
          ),
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCambiar(pagina + 1)}
          disabled={pagina === paginas}
          aria-label={t('comunes.siguiente')}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  )
}
