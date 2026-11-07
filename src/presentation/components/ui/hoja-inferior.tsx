import { useRef, type PointerEvent as EventoPuntero, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

const UMBRAL_CIERRE = 88

/**
 * Hoja que sube desde abajo, al alcance del pulgar: diálogo modal con foco atrapado,
 * cierre con Escape, con el velo o arrastrando el asa. `tono="noche"` la hace del negro
 * de las cápsulas.
 */
export function HojaInferior({
  abierta,
  onCambiar,
  titulo,
  ocultarTitulo = false,
  descripcion,
  pie,
  tono = 'superficie',
  className,
  cuerpoClassName,
  children,
}: {
  abierta: boolean
  onCambiar: (abierta: boolean) => void
  /** Nombre del diálogo: se anuncia siempre, aunque esté oculto. */
  titulo: ReactNode
  ocultarTitulo?: boolean
  descripcion?: ReactNode
  /** Acciones fijas al pie, siempre visibles aunque el cuerpo se desplace. */
  pie?: ReactNode
  tono?: 'superficie' | 'noche'
  className?: string
  cuerpoClassName?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const hoja = useRef<HTMLDivElement>(null)
  const inicio = useRef<number | null>(null)

  const arrastrar = (evento: EventoPuntero) => {
    if (inicio.current === null) return
    const distancia = Math.max(0, evento.clientY - inicio.current)
    hoja.current?.style.setProperty('--arrastre', `${distancia}px`)
  }
  const soltar = (evento: EventoPuntero) => {
    if (inicio.current === null) return
    const distancia = evento.clientY - inicio.current
    inicio.current = null
    if (distancia > UMBRAL_CIERRE) onCambiar(false)
    else hoja.current?.style.removeProperty('--arrastre')
  }

  return (
    <DialogPrimitive.Root open={abierta} onOpenChange={onCambiar}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="hoja-velo data-[state=open]:animate-fade data-[state=closed]:animate-fade-out" />
        <DialogPrimitive.Content
          ref={hoja}
          {...(descripcion ? {} : { 'aria-describedby': undefined })}
          // El foco va a la hoja y no al primer campo: en móvil abriría el teclado sin que nadie lo pida.
          tabIndex={-1}
          onOpenAutoFocus={(evento) => {
            evento.preventDefault()
            hoja.current?.focus()
          }}
          className={cn('hoja-inferior text-foreground', tono === 'noche' && 'tema-capsula', className)}
        >
          <div
            aria-hidden
            className="hoja-inferior__asa"
            onPointerDown={(evento) => {
              inicio.current = evento.clientY
              evento.currentTarget.setPointerCapture?.(evento.pointerId)
            }}
            onPointerMove={arrastrar}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          />
          <div className={cn('flex items-start gap-3 px-4 pb-3', ocultarTitulo && 'sr-only')}>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-lg leading-7 font-semibold tracking-tight">{titulo}</DialogPrimitive.Title>
              {descripcion && (
                <DialogPrimitive.Description className="mt-0.5 text-sm leading-5 text-muted">{descripcion}</DialogPrimitive.Description>
              )}
            </div>
          </div>
          <div className={cn('hoja-inferior__cuerpo', cuerpoClassName)}>{children}</div>
          {pie && <div className="hoja-inferior__pie">{pie}</div>}
          <DialogPrimitive.Close
            aria-label={t('comunes.cerrar')}
            className="realce absolute right-2 top-2 flex size-11 cursor-pointer items-center justify-center rounded-full text-muted"
          >
            <X className="size-4.5" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
