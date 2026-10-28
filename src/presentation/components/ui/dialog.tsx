import { useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

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
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/55 backdrop-blur-[2px] data-[state=open]:animate-fade data-[state=closed]:animate-fade-out" />
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
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
          'cristal max-h-[85dvh] overflow-y-auto rounded-(--radius-modal) border p-5 sm:p-6',
          'data-[state=open]:animate-(--animate-dialog-in) data-[state=closed]:animate-(--animate-dialog-out) focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-3 top-3 flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-(--duration-micro) hover:bg-cream-200 hover:text-foreground max-sm:size-11 pointer-coarse:size-11 sm:right-4 sm:top-4"
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
      className={cn('pr-10 font-display text-lg leading-7 font-semibold tracking-tight text-foreground', className)}
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
