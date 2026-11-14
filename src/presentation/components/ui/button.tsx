import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Botón compartido. 44 px en anchos móviles y con puntero táctil (DESIGN.md);
 * compacto desde 640 px con puntero fino.
 */
const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-field) text-body font-medium cursor-pointer transition-[color,background-color,border-color,transform] duration-(--duration-micro) ease-(--ease-hover) active:duration-(--duration-press) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] motion-reduce:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'coldcare-primary-action font-semibold',
        secondary:
          'border border-border-strong bg-surface text-foreground hover:border-border-field hover:bg-surface-hover',
        ghost: 'text-muted hover:bg-surface-hover hover:text-foreground',
        danger: 'bg-critical-solid font-semibold text-on-critical hover:bg-critical',
      },
      size: {
        sm: 'h-11 px-3 sm:h-9 sm:pointer-coarse:h-11',
        md: 'h-11 px-4 sm:h-10 sm:pointer-coarse:h-11',
        lg: 'h-12 px-5 sm:h-11 sm:pointer-coarse:h-12',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
