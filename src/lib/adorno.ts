import { lazy, type ComponentType } from 'react'

/** Carga diferida de un adorno: si su archivo no llega (red, despliegue nuevo), la pantalla sigue sin él. */
export function adorno<P>(cargar: () => Promise<ComponentType<P>>) {
  return lazy(async () => {
    try {
      return { default: await cargar() }
    } catch {
      return { default: (() => null) as ComponentType<P> }
    }
  })
}
