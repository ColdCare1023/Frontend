import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Píldora de estado. Normal y aviso usan tinte con borde interior; lo crítico
 * es sólido para que resalte sin depender del color: los tres llevan además
 * texto e icono en cada uso (RiskBadge, BadgeConectividad).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs leading-5 font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        neutral: 'bg-cream-200 text-ink-700 ring-border',
        ok: 'bg-success-100 text-success-700 ring-success-600/25',
        warn: 'bg-honey-100 text-honey-700 ring-honey-600/30',
        critical: 'bg-critical-solid font-semibold text-on-critical ring-transparent',
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
