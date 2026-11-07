import type { Rol } from '@/domain/value-objects/Rol'
import { cn } from '@/lib/utils'

/**
 * Cada perfil tiene su material: la cápsula negra para quien administra, el azul de la
 * marca para el químico farmacéutico, hielo para el técnico y el papel del cuaderno para
 * el auditor. Es el mismo en la lista y en la tabla de permisos: se aprende una vez.
 */
const MATERIAL: Record<Rol, string> = {
  administrador: 'bg-capsula text-white shadow-(--shadow-capsula)',
  farmaceutico: 'bg-primary text-on-primary',
  tecnico: 'bg-hielo text-success-700 ring-1 ring-inset ring-instrumento-tenue',
  auditor: 'bg-papel text-pluma ring-1 ring-inset ring-renglon',
}

const TAMANO = {
  sm: 'size-8 text-[12px]',
  md: 'size-11 text-[15px]',
  lg: 'size-14 text-[19px]',
}

/** Círculo con texto para una persona o un perfil. Decorativo: el nombre siempre va al lado. */
export function AvatarRol({
  rol,
  texto,
  inactivo = false,
  tamano = 'md',
  className,
}: {
  rol: Rol
  texto: string
  inactivo?: boolean
  tamano?: keyof typeof TAMANO
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 select-none place-items-center rounded-full font-semibold tracking-[-0.02em]',
        TAMANO[tamano],
        inactivo ? 'border border-dashed border-border-strong bg-transparent text-faint' : MATERIAL[rol],
        className,
      )}
    >
      {texto}
    </span>
  )
}
