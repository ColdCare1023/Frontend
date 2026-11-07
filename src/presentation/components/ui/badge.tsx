import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Insignia de estado: `variant` neutral, ok, warn, critical, info u outline, con `dot`
 * opcional. Lo crítico es rojo sólido; el significado va siempre también en el texto.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] leading-5 font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        neutral: 'bg-cream-200 text-ink-700 ring-border',
        ok: 'bg-success-100 text-success-700 ring-success-600/25',
        warn: 'bg-honey-100 text-honey-700 ring-honey-600/40',
        critical: 'bg-critical-solid font-semibold text-white ring-transparent',
        info: 'bg-primary-tint text-primary ring-primary/25',
        outline: 'bg-transparent text-muted ring-border-strong',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}
