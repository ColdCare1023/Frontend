import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Estado. Solo lo que pide atención es píldora: el aviso lleva tinte y lo
 * crítico es sólido. Lo normal y lo neutro van como texto con un punto, para
 * que una tabla llena de «Normal» o «Activo» no compita con lo que importa.
 * Todos llevan texto (y punto o icono), nunca solo color.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs leading-5 font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        neutral: 'bg-transparent px-0 text-muted ring-transparent',
        ok: 'bg-transparent px-0 text-subtle ring-transparent',
        warn: 'bg-warning-100 text-warning-700 ring-warning-600/30',
        /** Sin datos: estado operativo en acero, nunca ámbar ni rojo (HU-54). */
        nodata: 'bg-nodata-100 text-nodata-700 ring-nodata-600/30',
        critical: 'bg-critical-solid font-semibold text-on-critical ring-transparent',
        /** Crítico en tinte, para registros (p. ej. «Fallido» en Auditoría) que no piden acción inmediata. */
        criticalTint: 'bg-critical-tint text-critical ring-critical/30',
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

const PUNTO: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral: 'bg-faint',
  ok: 'bg-success-600',
  warn: 'bg-current',
  nodata: 'bg-current',
  critical: 'bg-current',
  criticalTint: 'bg-current',
  outline: 'bg-current',
}

export function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', PUNTO[variant ?? 'neutral'])} aria-hidden />}
      {children}
    </span>
  )
}
