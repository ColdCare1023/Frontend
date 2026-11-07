/** `scrollMargin` amplía también los contenedores con scroll propio, como el `main` en escritorio. */
type OpcionesObservador = IntersectionObserverInit & { scrollMargin?: string }

/** Observa un elemento con margen; sin `IntersectionObserver` lo da por visible. */
export function observarVista(el: Element, alCambiar: (visible: boolean) => void, margen = '0px'): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    alCambiar(true)
    return () => undefined
  }
  const opciones: OpcionesObservador = { rootMargin: margen, scrollMargin: margen }
  const observador = new IntersectionObserver((entradas) => {
    const ultima = entradas[entradas.length - 1]
    if (ultima) alCambiar(ultima.isIntersecting)
  }, opciones)
  observador.observe(el)
  return () => observador.disconnect()
}

/** Llama a `hacer` una vez, cuando el elemento está en pantalla o a punto de entrar. */
export function alAcercarse(el: Element, hacer: () => void, margen = '60% 0px'): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    hacer()
    return () => undefined
  }
  let hecho = false
  const dejar = observarVista(
    el,
    (visible) => {
      if (!visible || hecho) return
      hecho = true
      dejar()
      hacer()
    },
    margen,
  )
  return dejar
}

/** Llama a `hacer` en un momento libre del hilo principal, como mucho tras `esperaMs`. */
export function enMomentoLibre(hacer: () => void, esperaMs = 1500): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => hacer(), { timeout: esperaMs })
    return () => window.cancelIdleCallback(id)
  }
  // Safari no lo tiene: un respiro corto basta para no ir pegado al cuadro actual.
  const id = window.setTimeout(hacer, Math.min(esperaMs, 120))
  return () => window.clearTimeout(id)
}
