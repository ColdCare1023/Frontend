import { useEffect, useState } from 'react'

/** Sigue una media query desde el primer render, para no pintar el marco equivocado. */
export function useCoincideMedia(consulta: string): boolean {
  const [coincide, setCoincide] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const media = window.matchMedia(consulta)
    const cambio = () => setCoincide(media.matches)
    cambio()
    media.addEventListener?.('change', cambio)
    return () => media.removeEventListener?.('change', cambio)
  }, [consulta])
  return coincide
}
