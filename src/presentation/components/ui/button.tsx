import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-field) text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-0',
  {
    variants: {
      variant: {
        primary:
          'coldcare-primary-action shadow-sm shadow-primary/10',
        secondary:
          'border border-border-strong bg-surface text-primary hover:bg-primary-tint hover:border-primary/40',
        ghost: 'text-muted hover:bg-cream-200/60 hover:text-foreground hover:translate-y-0',
        danger: 'bg-clay-600 text-cream-50 hover:bg-clay-700 shadow-sm shadow-clay-700/20',
      },
      size: {
        sm: 'h-11 min-h-11 px-3 text-xs',
        md: 'h-11 min-h-11 px-4',
        lg: 'h-12 min-h-11 px-6 text-base sm:h-11',
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
