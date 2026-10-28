/**
 * Luz que sigue al puntero sobre las superficies `.spotlight` (patrón
 * «Spotlight Card», 21st.dev). Un único oyente pasivo para toda la página
 * escribe las coordenadas como variables CSS, como mucho una vez por
 * fotograma; el dibujo lo hace el CSS (index.css). Sin puntero fino —táctil—
 * no se instala.
 */
export function instalarSpotlight(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
    return () => {}
  }
  let fotograma = 0
  let ultimo: PointerEvent | null = null

  const aplicar = () => {
    fotograma = 0
    const evento = ultimo
    if (!evento) return
    const superficie = (evento.target as Element | null)?.closest?.<HTMLElement>('.spotlight')
    if (!superficie) return
    const caja = superficie.getBoundingClientRect()
    superficie.style.setProperty('--mx', `${evento.clientX - caja.left}px`)
    superficie.style.setProperty('--my', `${evento.clientY - caja.top}px`)
  }

  const mover = (evento: PointerEvent) => {
    ultimo = evento
    if (!fotograma) fotograma = requestAnimationFrame(aplicar)
  }

  document.addEventListener('pointermove', mover, { passive: true })
  return () => {
    document.removeEventListener('pointermove', mover)
    if (fotograma) cancelAnimationFrame(fotograma)
  }
}
