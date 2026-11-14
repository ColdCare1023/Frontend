import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Superficie estática: fondo y hairline, sin sombra (DIRECTION §8).
        'rounded-(--radius-card) border border-border bg-surface',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-4 pb-3', className)} {...props} />
}

type CardTitleLevel = 1 | 2 | 3 | 4 | 5 | 6

const cardTitleTags: Record<CardTitleLevel, `h${CardTitleLevel}`> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading level in the page outline; section titles default to h2. */
  level?: CardTitleLevel
}

export function CardTitle({ level = 2, className, ...props }: CardTitleProps) {
  const Tag = cardTitleTags[level]
  return (
    <Tag
      className={cn('font-display text-foreground', level === 2 ? 'text-title' : 'text-body font-semibold', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-body text-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}
