import { forwardRef } from 'react'

import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // text-base en móvil: iOS hace zoom automático sobre inputs con fuente < 16px
        'h-11 w-full min-w-0 rounded-(--radius-field) border border-border-field bg-surface px-3 text-base text-foreground placeholder:text-faint shadow-[inset_0_1px_2px_rgb(15_23_42_/_0.04)] sm:h-10 sm:text-sm',
        'transition-colors duration-150 hover:border-ink-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
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
      'min-h-24 w-full min-w-0 rounded-(--radius-field) border border-border-field bg-surface px-3 py-2 text-base text-foreground placeholder:text-faint sm:text-sm',
      'transition-colors duration-150 hover:border-ink-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
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
      'h-11 w-full min-w-0 appearance-none rounded-(--radius-field) border border-border-field bg-surface px-3 pr-8 text-base text-foreground sm:h-10 sm:text-sm',
      'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23475569%27 stroke-width=%272.5%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[position:right_0.65rem_center] bg-no-repeat',
      'transition-colors duration-150 hover:border-ink-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
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
      className={cn('mb-1.5 block text-sm font-medium text-ink-700', className)}
      {...props}
    />
  )
}
