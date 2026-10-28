import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Botón compartido. Compacto con puntero fino; con puntero táctil cada tamaño
 * crece hasta el área mínima de 44 px (DESIGN.md).
 */
const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-field) text-sm font-medium cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-micro) ease-(--ease-ui) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] motion-reduce:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'coldcare-primary-action font-semibold',
        secondary:
          'border border-border-strong bg-surface text-foreground shadow-(--shadow-card) hover:border-border-field hover:bg-cream-200/60',
        ghost: 'text-muted hover:bg-cream-200/70 hover:text-foreground',
        danger: 'bg-critical-solid font-semibold text-on-critical shadow-(--shadow-card) hover:brightness-110',
      },
      size: {
        sm: 'h-9 px-3 text-[13px] pointer-coarse:h-11',
        md: 'h-10 px-4 pointer-coarse:h-11',
        lg: 'h-11 px-5 text-[15px] pointer-coarse:h-12',
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
