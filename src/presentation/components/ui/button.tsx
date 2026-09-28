import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:size-4 [&_svg]:shrink-0 hover:-translate-y-px active:translate-y-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-cream-50 hover:bg-primary-hover shadow-sm hover:shadow-md shadow-pine-900/20',
        secondary:
          'border border-primary bg-surface text-primary hover:bg-primary-tint hover:border-primary-hover',
        ghost: 'text-muted hover:bg-cream-200/60 hover:text-foreground hover:translate-y-0',
        danger: 'bg-clay-600 text-cream-50 hover:bg-clay-700 shadow-sm shadow-clay-700/20',
      },
      size: {
        sm: 'h-11 px-3 text-xs sm:h-9',
        md: 'h-11 px-4 sm:h-10',
        lg: 'h-12 px-6 text-base sm:h-11',
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
