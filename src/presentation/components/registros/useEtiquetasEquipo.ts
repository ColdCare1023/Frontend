import { useMemo } from 'react'

import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'

/** El directorio que ya cargó el shell permite reconocer el equipo sin otra consulta. */
export function useEtiquetasEquipo() {
  const equipos = useEstadoVivoStore((s) => s.equipos)
  return useMemo(() => {
    const repeticiones = new Map<string, number>()
    for (const { nombre } of equipos) {
      if (nombre) repeticiones.set(nombre, (repeticiones.get(nombre) ?? 0) + 1)
    }
    return new Map(equipos.map(({ id, nombre }) => [
      id,
      nombre && (repeticiones.get(nombre) ?? 0) > 1 ? `${nombre} (${id})` : nombre || id,
    ]))
  }, [equipos])
}
