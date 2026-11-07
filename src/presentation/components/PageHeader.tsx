import { TituloPagina } from './ui/titulo-pagina'

/** Nombre heredado de `TituloPagina`: las pantallas pueden usar cualquiera de los dos. */
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
    <TituloPagina antetitulo={eyebrow} titulo={titulo} descripcion={descripcion}>
      {children}
    </TituloPagina>
  )
}
