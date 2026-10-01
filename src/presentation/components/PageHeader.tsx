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
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 pb-1 sm:items-center">
      <div className="min-w-0 flex-1 basis-64">
        {eyebrow && <span className="sr-only">{eyebrow}</span>}
        <h1 className="font-display text-[25px] leading-8 font-semibold sm:text-[28px] sm:leading-9 tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-[76ch] text-sm leading-5 text-muted">{descripcion}</p>}
      </div>
      {children && <div className="flex max-w-full flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
