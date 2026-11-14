import { forwardRef } from 'react'

import { cn } from '@/lib/utils'

// Campo hundido en el tema oscuro (un nivel por debajo de la superficie) y
// blanco en el claro; el foco suma borde de acento y halo de 3 px.
const campoBase =
  'w-full min-w-0 rounded-(--radius-field) border border-border-field bg-surface text-base text-foreground placeholder:text-faint sm:text-sm dark:bg-surface-sunken'
const campoEstados =
  'transition-[border-color,box-shadow,background-color] duration-(--duration-micro) ease-(--ease-ui) hover:border-faint focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 aria-[invalid=true]:border-critical aria-[invalid=true]:bg-critical-tint aria-[invalid=true]:focus:ring-critical/20 user-invalid:border-critical user-invalid:bg-critical-tint user-invalid:focus:ring-critical/20'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // text-base en móvil: iOS hace zoom automático sobre inputs con fuente < 16px
        campoBase,
        'h-11 px-3 sm:h-10 sm:pointer-coarse:h-11',
        campoEstados,
        'aria-[invalid=true]:text-danger-700 aria-[invalid=true]:placeholder:text-danger-600 user-invalid:text-danger-700',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      campoBase,
      'min-h-24 px-3 py-2',
      campoEstados,
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export const NativeSelect = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      campoBase,
      'h-11 appearance-none px-3 pr-8 sm:h-10 sm:pointer-coarse:h-11',
      // El chevron vive en una variable por tema (index.css): la clase con la
      // URL en línea llevaba espacios y Tailwind la partía en clases inválidas.
      'bg-(image:--icono-desplegar) bg-[position:right_0.75rem_center] bg-no-repeat',
      campoEstados,
      className,
    )}
    {...props}
  >
    {children}
  </select>
))
NativeSelect.displayName = 'NativeSelect'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-body font-medium text-subtle', className)}
      {...props}
    />
  )
}
