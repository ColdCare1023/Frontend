import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** Destinos disponibles dentro de Consultas y anclas del monitoreo que se ve detrás. */
export interface NavegacionGuia {
  disponibles: ReadonlySet<string>
  abrir: (ruta: string) => void
}

export function EnlaceGuia({ ruta, navegacion, className, children }: {
  ruta: string
  navegacion?: NavegacionGuia
  className: string
  children: ReactNode
}) {
  if (!navegacion) return <Link to={ruta} className={className}>{children}</Link>
  return <button type="button" className={className} onClick={() => navegacion.abrir(ruta)}>{children}</button>
}
