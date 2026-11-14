import { useEffect, useState } from 'react'

/** Reloj compartido de la página (PERFORMANCE C1): un tic por minuto, nunca por segundo. */
export function useAhora(cadaMs = 60_000) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), cadaMs)
    return () => window.clearInterval(id)
  }, [cadaMs])
  return ahora
}
