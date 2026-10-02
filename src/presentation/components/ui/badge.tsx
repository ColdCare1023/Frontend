import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-cream-200 text-ink-700',
        ok: 'bg-success-100 text-success-700',
        warn: 'border border-accent/35 bg-accent-tint text-clay-700',
        critical: 'border border-accent/35 bg-accent-tint text-clay-700',
        outline: 'border border-border-strong text-muted',
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
