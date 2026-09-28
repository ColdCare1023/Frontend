export function PageHeader({
  eyebrow,
  titulo,
  descripcion,
  children,
}: {
  eyebrow?: string
  titulo: string
  descripcion?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="font-display text-[28px] leading-[34px] font-bold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 text-base leading-6 text-muted">{descripcion}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
