import { forwardRef } from 'react'

import { cn } from '@/lib/utils'

// Campo hundido en el tema oscuro (un nivel por debajo de la superficie) y
// blanco en el claro; el foco suma borde de acento y halo de 3 px.
const campoBase =
  'w-full min-w-0 rounded-(--radius-field) border border-border-field bg-surface text-base text-foreground placeholder:text-faint sm:text-sm dark:bg-surface-sunken'
const campoEstados =
  'transition-[border-color,box-shadow,background-color] duration-(--duration-micro) ease-(--ease-ui) hover:border-ink-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 aria-[invalid=true]:border-critical aria-[invalid=true]:bg-critical-tint aria-[invalid=true]:focus:ring-critical/20 user-invalid:border-critical user-invalid:bg-critical-tint user-invalid:focus:ring-critical/20'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // text-base en móvil: iOS hace zoom automático sobre inputs con fuente < 16px
        campoBase,
        'h-11 px-3 sm:h-10 sm:pointer-coarse:h-11',
        campoEstados,
        'aria-[invalid=true]:text-clay-700 aria-[invalid=true]:placeholder:text-clay-600 user-invalid:text-clay-700',
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
      'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2364748B%27 stroke-width=%272.5%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[position:right_0.65rem_center] bg-no-repeat',
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
      className={cn('mb-1.5 block text-[13px] leading-5 font-medium text-ink-700', className)}
      {...props}
    />
  )
}
