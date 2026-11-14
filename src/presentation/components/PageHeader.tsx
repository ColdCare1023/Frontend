/**
 * Título de pantalla. La sección ya se lee en la ruta de la cabecera
 * («Operación › Alertas»), así que `eyebrow` no se repite aquí; se acepta
 * para no romper llamadas existentes.
 */
export function PageHeader({
  eyebrow: _eyebrow,
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-8">
      <div className="min-w-0 flex-1 basis-72">
        <h1 className="font-display text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-[34px]">{titulo}</h1>
        {descripcion && <p className="mt-2 max-w-[68ch] text-[15px] leading-6 text-muted">{descripcion}</p>}
      </div>
      {children && <div className="flex max-w-full flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
