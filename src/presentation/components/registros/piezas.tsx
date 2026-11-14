import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '../ui/button'

/** Par etiqueta/valor de los detalles de fila (icono opcional de 14 px). */
export function Dato({
  etiqueta,
  icono: Icono,
  className,
  children,
}: {
  etiqueta: ReactNode
  icono?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  className?: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-meta text-muted">
        {Icono && <Icono aria-hidden className="size-3.5 shrink-0" />}
        {etiqueta}
      </dt>
      <dd className={cn('mt-0.5 text-body text-foreground', className)}>{children}</dd>
    </div>
  )
}

/** Copia un valor técnico; anuncia «Copiado» sin depender del icono. */
export function BotonCopiar({ valor, campo }: { valor: string; campo: string }) {
  const { t } = useTranslation()
  const [copiado, setCopiado] = useState(false)
  const temporizador = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(temporizador.current), [])
  const copiar = async () => {
    try {
      await navigator.clipboard?.writeText(valor)
      setCopiado(true)
      window.clearTimeout(temporizador.current)
      temporizador.current = window.setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Sin permiso de portapapeles el valor sigue visible y seleccionable.
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-8 px-0 sm:h-8 shrink-0 text-muted max-sm:w-11 pointer-coarse:w-11 sm:pointer-coarse:h-11"
        aria-label={t('comunes.copiar', { campo })}
        onClick={() => void copiar()}
      >
        {copiado ? (
          <Check key="ok" aria-hidden className="cambio-texto size-3.5 text-success-700" />
        ) : (
          <Copy key="copiar" aria-hidden className="cambio-texto size-3.5" />
        )}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copiado ? t('comunes.copiado') : ''}
      </span>
    </>
  )
}

export interface Chip {
  clave: string
  texto: string
  quitar: () => void
}

/**
 * Filtros activos como fichas removibles, pegadas a la tabla (Filter Table).
 * Al quitar una, el foco pasa a la siguiente o, si no queda ninguna, al
 * elemento `alVaciar` (normalmente, el campo de búsqueda).
 */
export function ChipsFiltro({ chips, idFocoAlVaciar }: { chips: readonly Chip[]; idFocoAlVaciar?: string }) {
  const { t } = useTranslation()
  const lista = useRef<HTMLUListElement>(null)
  if (chips.length === 0) return null
  return (
    <ul ref={lista} aria-label={t('comunes.filtrosActivos')} className="flex flex-wrap gap-1.5 px-3 pt-2 pb-2.5 sm:px-4">
      {chips.map((chip, indice) => (
        <li
          key={chip.clave}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-border-strong bg-surface pl-2.5 pr-0.5 text-meta font-medium text-subtle"
        >
          {chip.texto}
          <button
            type="button"
            aria-label={t('comunes.quitarFiltro', { filtro: chip.texto })}
            onClick={() => {
              const botones = lista.current?.querySelectorAll('button')
              chip.quitar()
              requestAnimationFrame(() => {
                const siguiente = botones?.[indice + 1] ?? botones?.[indice - 1]
                if (siguiente && siguiente.isConnected) siguiente.focus()
                else if (idFocoAlVaciar) document.getElementById(idFocoAlVaciar)?.focus()
              })
            }}
            className="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:size-9"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Plantilla Bandeja (DIRECTION §13.3): foco arriba (8/12), rail de contexto
 * a la derecha (4/12, sticky) y la tabla debajo del foco. Entre 640 y 1279 px
 * el rail se intercala como tira de 2 columnas; bajo 640 px pasa al final.
 */
export function PlantillaBandeja({
  superior,
  rail,
  inferior,
  etiquetaRail,
}: {
  superior: ReactNode
  rail?: ReactNode
  inferior: ReactNode
  etiquetaRail: string
}) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:grid-rows-[auto_1fr] xl:gap-4">
      <div className="order-1 min-w-0 space-y-3 xl:col-span-8 xl:row-start-1 2xl:col-span-9">{superior}</div>
      {rail && (
        <aside
          aria-label={etiquetaRail}
          className="order-2 grid min-w-0 grid-cols-1 content-start gap-3 max-sm:order-3 sm:grid-cols-2 xl:sticky xl:top-[calc(var(--alto-cabecera)+24px)] xl:col-span-4 xl:col-start-9 xl:row-span-2 xl:row-start-1 xl:grid-cols-1 xl:gap-4 xl:self-start 2xl:col-span-3 2xl:col-start-10"
        >
          {rail}
        </aside>
      )}
      <div className="order-3 min-w-0 max-sm:order-2 xl:col-span-8 xl:row-start-2 2xl:col-span-9">{inferior}</div>
    </div>
  )
}

/** Tarjeta del rail de contexto. */
export function TarjetaRail({
  titulo,
  meta,
  className,
  children,
}: {
  titulo: string
  meta?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('superficie min-w-0 p-4', className)}>
      <h2 className="text-title text-foreground">{titulo}</h2>
      {meta && <p className="nums mt-0.5 text-meta text-faint">{meta}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}
