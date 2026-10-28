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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-6">
      <div className="min-w-0 flex-1 basis-72">
        {eyebrow && <span className="sr-only">{eyebrow}</span>}
        <h1 className="font-display text-[22px] leading-8 font-semibold tracking-tight text-foreground sm:text-2xl">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-[72ch] text-sm leading-5 text-muted">{descripcion}</p>}
      </div>
      {children && <div className="flex max-w-full flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
