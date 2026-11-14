/**
 * Encabezado de página compacto (DIRECTION §7): una fila de mínimo 48 px con
 * el H1 (`text-page`), un dato inline opcional (`meta`, p. ej. «Actualizado
 * 09:38») y las acciones a la derecha. La descripción es una línea opcional
 * que se oculta bajo 640 px. La sección ya se lee en la ruta de la cabecera
 * («Operación › Alertas»), así que `eyebrow` no se repite; se acepta para no
 * romper llamadas existentes.
 */
export function PageHeader({
  eyebrow: _eyebrow,
  titulo,
  descripcion,
  meta,
  children,
}: {
  eyebrow?: string
  titulo: string
  descripcion?: string
  /** Dato breve junto al título (`text-meta`, faint). */
  meta?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 sm:mb-5">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex min-h-12 flex-wrap items-baseline gap-x-3 gap-y-1 py-1">
          <h1 className="font-display text-[20px] leading-7 font-semibold tracking-[-0.02em] text-foreground sm:text-page">{titulo}</h1>
          {meta && <p className="nums text-meta text-faint">{meta}</p>}
        </div>
        {descripcion && <p className="max-w-[72ch] truncate text-body text-muted max-sm:hidden">{descripcion}</p>}
      </div>
      {children && <div className="flex max-w-full flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
