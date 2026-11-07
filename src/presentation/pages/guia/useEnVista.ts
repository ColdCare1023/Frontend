import { useEffect, useState, type RefObject } from 'react'

/** Si el elemento está en pantalla. Lo que anima solo corre mientras se ve. */
export function useEnVista(ref: RefObject<HTMLElement | null>): boolean {
  const [enVista, setEnVista] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const elemento = ref.current
    if (!elemento || typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver(([entrada]) => setEnVista(entrada.isIntersecting), { rootMargin: '8% 0px' })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [ref])
  return enVista
}
