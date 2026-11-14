import { useEffect, useRef } from 'react'

import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'

/**
 * Vuelve a pedir los incidentes operativos cuando un equipo entra o sale de un
 * estado no operativo (sin datos, suspendido, falla) según el estado en vivo
 * del shell, que se sondea cada 30 s. El SSE ya avisa en el backend real; esto
 * cubre el caso en que el evento no llega (y la demo, que no lo emite) para
 * que la fila diga «Sin datos» y la cinta y el rail lo muestren a la vez.
 */
export function useRefrescoIncidentes(consultar: () => unknown) {
  const clave = useEstadoVivoStore((s) =>
    s.equipos
      .filter((e) => e.estadoOperativo && e.estadoOperativo !== 'OPERATIVO')
      .map((e) => `${e.id}:${e.estadoOperativo}`)
      .sort()
      .join('|'),
  )
  const previa = useRef<string | null>(null)
  useEffect(() => {
    if (previa.current !== null && previa.current !== clave) void consultar()
    previa.current = clave
  }, [clave, consultar])
}
