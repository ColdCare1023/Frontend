import { useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Diálogo modal centrado (abajo en móvil): `Dialog`, `DialogContent` con `DialogTitle` y `DialogDescription`; `destructivo` lo vuelve `alertdialog`. */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Marca el diálogo como confirmación de una acción destructiva (baja de
   * dispositivo, desactivación de usuario, aislamiento de cadena).
   *
   * Cambia dos cosas: el rol pasa a `alertdialog` —los lectores de pantalla
   * anuncian el cuerpo entero, no solo el título— y el foco inicial deja de
   * caer sobre el primer campo del formulario para posarse en el contenedor.
   * Antes, abrir «dar de baja» dejaba el foco sobre el selector de motivo y un
   * Enter reflejo enviaba el formulario sin haber leído la advertencia.
   */
  destructivo?: boolean
}

export function DialogContent({
  className,
  children,
  destructivo = false,
  ...props
}: DialogContentProps) {
  const { t } = useTranslation()
  const contenedor = useRef<HTMLDivElement>(null)

  return (
    <DialogPrimitive.Portal>
      {/* Radix espera a que terminen las animaciones de salida (data-state=closed). */}
      <DialogPrimitive.Overlay className="velo-dialogo z-50 data-[state=open]:animate-fade data-[state=closed]:animate-fade-out" />
      <DialogPrimitive.Content
        ref={contenedor}
        // Ojo: `role={undefined}` no es «no tocar el rol», es sobrescribir con
        // vacío el `role="dialog"` que pone Radix. Solo se pasa cuando toca.
        {...(destructivo ? { role: 'alertdialog' as const } : {})}
        onOpenAutoFocus={
          destructivo
            ? (evento) => {
                evento.preventDefault()
                contenedor.current?.focus()
              }
            : undefined
        }
        tabIndex={destructivo ? -1 : undefined}
        className={cn(
          // En móvil queda abajo, al alcance del pulgar; desde 640 px, centrado.
          'fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100vw-1rem)] max-w-md -translate-x-1/2',
          'sm:bottom-auto sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:-translate-y-1/2',
          'flotante max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-(--radius-modal) border p-5 sm:max-h-[85dvh] sm:p-6',
          'data-[state=open]:animate-(--animate-dialog-in) data-[state=closed]:animate-(--animate-dialog-out) focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="realce absolute right-2 top-2 flex size-11 cursor-pointer items-center justify-center rounded-full text-muted hover:text-foreground sm:right-3 sm:top-3 sm:size-9 sm:pointer-coarse:size-11"
          aria-label={t('comunes.cerrar')}
        >
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('pr-10 font-display text-xl leading-7 font-semibold tracking-[-0.02em] text-foreground', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('mt-1 text-sm leading-5 text-muted', className)}
      {...props}
    />
  )
}
