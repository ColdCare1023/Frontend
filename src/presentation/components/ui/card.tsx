import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // `spotlight`: luz que sigue al puntero y borde iluminado al pasar.
        'spotlight rounded-(--radius-card) border border-border bg-surface shadow-(--shadow-card)',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-4 pb-3 sm:px-5 sm:pt-5', className)} {...props} />
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
      className={cn('font-display font-semibold tracking-tight text-foreground', level === 2 ? 'text-[17px] leading-6' : 'text-[15px] leading-6', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-5 text-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0 sm:px-5 sm:pb-5', className)} {...props} />
}
