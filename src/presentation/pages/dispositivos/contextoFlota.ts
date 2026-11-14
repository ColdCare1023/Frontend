import { createContext, useContext } from 'react'

import type { useDispositivos } from '@/application/hooks/useDispositivos'

/**
 * La flota se carga una vez en `DispositivosLayout` y la comparten la lista y
 * el detalle: ir y volver entre ambos no vuelve a pedir `/api/dispositivos`
 * (no existe `GET /api/dispositivos/{id}`).
 */
export type Flota = ReturnType<typeof useDispositivos>

export const ContextoFlota = createContext<Flota | null>(null)

export function useFlota(): Flota {
  const flota = useContext(ContextoFlota)
  if (!flota) throw new Error('useFlota se usa dentro de DispositivosLayout')
  return flota
}
