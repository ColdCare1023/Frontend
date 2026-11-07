import { useState, type ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ListFilter, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { Button } from './button'
import { HojaInferior } from './hoja-inferior'
import { useCoincideMedia } from './useCoincideMedia'

export interface FiltroActivo {
  id: string
  /** Texto del filtro ya elegido, por ejemplo «FARM-01». */
  etiqueta: string
  onQuitar: () => void
}

/**
 * Filtros en una cápsula compacta que se abre en panel (hoja inferior en móvil): el
 * contenido va primero y lo elegido queda a la vista como chips que se quitan de uno en
 * uno. Los campos van como `children`, normalmente `Campo` con su control.
 */
export function BarraFiltros({
  titulo,
  activos = [],
  onLimpiar,
  acciones,
  className,
  children,
}: {
  /** Por defecto, «Filtros». */
  titulo?: string
  activos?: FiltroActivo[]
  onLimpiar?: () => void
  /** A la derecha de la barra: exportar, recargar… */
  acciones?: ReactNode
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [abierta, setAbierta] = useState(false)
  const escritorio = useCoincideMedia('(min-width: 640px)')
  const nombre = titulo ?? t('filtros.titulo')
  const nombreBoton = activos.length > 0 ? t('filtros.conActivos', { nombre, count: activos.length }) : nombre

  const disparador = (
    <button
      type="button"
      aria-label={nombreBoton}
      aria-expanded={abierta}
      onClick={escritorio ? undefined : () => setAbierta(true)}
      className="capsula-clara realce inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 pl-3 pr-4 text-sm font-medium text-foreground transition-transform duration-(--duration-micro) active:scale-[0.97] motion-reduce:active:scale-100 sm:h-10 sm:pointer-coarse:h-11"
    >
      <ListFilter className="size-4 text-muted" aria-hidden />
      {nombre}
      {activos.length > 0 && (
        <span aria-hidden className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-semibold text-on-primary">
          {activos.length}
        </span>
      )}
    </button>
  )

  const cierre = (
    <>
      {onLimpiar && activos.length > 0 && (
        <Button variant="ghost" size="sm" onClick={onLimpiar}>
          {t('comunes.limpiar')}
        </Button>
      )}
      <Button size="sm" onClick={() => setAbierta(false)}>
        {t('filtros.listo')}
      </Button>
    </>
  )

  return (
    <div role="group" aria-label={nombre} className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      {escritorio ? (
        <Popover.Root open={abierta} onOpenChange={setAbierta}>
          <Popover.Trigger asChild>{disparador}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={8}
              collisionPadding={12}
              aria-label={nombre}
              className="flotante z-40 w-[min(30rem,calc(100vw-24px))] origin-(--radix-popover-content-transform-origin) rounded-(--radius-card) border data-[state=open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out)"
            >
              <div className="grid gap-4 p-4 sm:grid-cols-2">{children}</div>
              <div className="flex justify-end gap-2 border-t border-border p-3">{cierre}</div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <>
          {disparador}
          <HojaInferior abierta={abierta} onCambiar={setAbierta} titulo={nombre} pie={cierre}>
            <div className="grid gap-4">{children}</div>
          </HojaInferior>
        </>
      )}

      {activos.map((filtro) => (
        <span key={filtro.id} className="capsula-clara inline-flex h-9 max-w-full items-center gap-0.5 pl-3 pr-1 text-[13px] font-medium text-foreground">
          <span className="truncate">{filtro.etiqueta}</span>
          <button
            type="button"
            onClick={filtro.onQuitar}
            aria-label={t('filtros.quitar', { filtro: filtro.etiqueta })}
            className="realce grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted after:absolute after:-inset-1.5"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}

      {acciones && <div className="ml-auto flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}
