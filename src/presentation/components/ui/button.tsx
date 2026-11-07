import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Botón compartido: `variant` primary, secondary, ghost o danger; `size` sm, md, lg o
 * icono; `cargando` lo bloquea con un indicador. 44 px en móvil y con puntero táctil.
 */
const buttonVariants = cva(
  'realce inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-field) text-sm font-medium cursor-pointer transition-transform duration-(--duration-micro) ease-(--ease-ui) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] motion-reduce:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'coldcare-primary-action font-semibold',
        secondary: 'border border-border-strong bg-surface text-foreground shadow-(--shadow-card)',
        ghost: 'text-muted hover:text-foreground',
        danger: 'bg-critical-solid font-semibold text-on-critical shadow-(--shadow-card)',
      },
      size: {
        sm: 'h-11 px-3 text-[13px] sm:h-9 sm:pointer-coarse:h-11',
        md: 'h-11 px-4 sm:h-10 sm:pointer-coarse:h-11',
        lg: 'h-12 px-5 text-[15px] sm:h-11 sm:pointer-coarse:h-12',
        icono: 'size-11 sm:size-10 sm:pointer-coarse:size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Trabajo en curso: bloquea el botón y lo anuncia con `aria-busy`. */
  cargando?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', cargando = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {cargando && <Loader className="animate-spin" aria-hidden />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
