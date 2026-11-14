import { useCallback, useSyncExternalStore } from 'react'

/**
 * `matchMedia` como estado de React (sin re-render en cada resize: solo al
 * cruzar el umbral). Sin `matchMedia` (jsdom, SSR) devuelve `false`.
 */
export function useCoincideMedia(consulta: string): boolean {
  const suscribir = useCallback(
    (avisar: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const mql = window.matchMedia(consulta)
      mql.addEventListener?.('change', avisar)
      return () => mql.removeEventListener?.('change', avisar)
    },
    [consulta],
  )
  return useSyncExternalStore(
    suscribir,
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(consulta).matches : false),
    () => false,
  )
}

/** Riel lateral visible (≥ 1024 px). */
export const CONSULTA_RIEL = '(min-width: 64rem)'
/** Cabecera con controles de idioma y tema (≥ 640 px). */
export const CONSULTA_SM = '(min-width: 40rem)'
