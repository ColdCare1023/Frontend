import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

/**
 * Tema de la interfaz. El oscuro es el predeterminado; «system» sigue la
 * preferencia del sistema operativo y reacciona si cambia con la app abierta.
 *
 * `public/theme-init.js` aplica la misma regla antes del primer pintado; este
 * módulo toma el relevo cuando React arranca. La preferencia es solo visual,
 * por eso puede vivir en localStorage (el token de sesión, no).
 */
export type PreferenciaTema = 'dark' | 'light' | 'system'
export type TemaResuelto = 'dark' | 'light'

export const CLAVE_TEMA = 'coldcare-tema'
const PREFERENCIAS: PreferenciaTema[] = ['dark', 'light', 'system']
const COLOR_BARRA: Record<TemaResuelto, string> = { dark: '#000000', light: '#F4F7FB' }

type Escucha = () => void
const escuchas = new Set<Escucha>()

function consultaOscura(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia('(prefers-color-scheme: dark)')
}

export function leerPreferencia(): PreferenciaTema {
  try {
    const guardada = window.localStorage.getItem(CLAVE_TEMA)
    if (guardada && (PREFERENCIAS as string[]).includes(guardada)) return guardada as PreferenciaTema
  } catch {
    // Almacenamiento bloqueado (modo privado estricto): se usa el predeterminado.
  }
  return 'dark'
}

export function resolverTema(preferencia: PreferenciaTema): TemaResuelto {
  if (preferencia === 'system') return consultaOscura()?.matches ? 'dark' : 'light'
  return preferencia
}

let preferenciaActual: PreferenciaTema = typeof window === 'undefined' ? 'dark' : leerPreferencia()
let temaActual: TemaResuelto = typeof window === 'undefined' ? 'dark' : resolverTema(preferenciaActual)

function aplicarEnDocumento(tema: TemaResuelto) {
  if (typeof document === 'undefined') return
  const raiz = document.documentElement
  raiz.dataset.theme = tema
  raiz.style.colorScheme = tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[tema])
}

function notificar() {
  escuchas.forEach((escucha) => escucha())
}

function establecer(preferencia: PreferenciaTema) {
  preferenciaActual = preferencia
  temaActual = resolverTema(preferencia)
  aplicarEnDocumento(temaActual)
  notificar()
}

if (typeof window !== 'undefined') {
  aplicarEnDocumento(temaActual)
  consultaOscura()?.addEventListener?.('change', () => {
    if (preferenciaActual === 'system') establecer('system')
  })
}

/**
 * Cambia el tema. Con `origen` (centro del botón pulsado) y soporte de View
 * Transitions, el tema nuevo se revela en círculo desde ese punto; sin soporte
 * o con movimiento reducido, el cambio es inmediato.
 */
export function cambiarTema(preferencia: PreferenciaTema, origen?: { x: number; y: number }) {
  try {
    window.localStorage.setItem(CLAVE_TEMA, preferencia)
  } catch {
    // Sin almacenamiento el cambio sigue valiendo para esta visita.
  }
  const destino = resolverTema(preferencia)
  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const documento = document as Document & {
    startViewTransition?: (actualizar: () => void) => { ready: Promise<void> }
  }
  if (!origen || reducido || destino === temaActual || typeof documento.startViewTransition !== 'function') {
    establecer(preferencia)
    return
  }
  const transicion = documento.startViewTransition(() => {
    flushSync(() => establecer(preferencia))
  })
  const radio = Math.hypot(Math.max(origen.x, window.innerWidth - origen.x), Math.max(origen.y, window.innerHeight - origen.y))
  void transicion.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${origen.x}px ${origen.y}px)`, `circle(${radio}px at ${origen.x}px ${origen.y}px)`] },
      { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  })
}

function suscribir(escucha: Escucha) {
  escuchas.add(escucha)
  return () => {
    escuchas.delete(escucha)
  }
}

/** Tema efectivo; las gráficas lo usan para releer sus colores al cambiar. */
export function useTemaResuelto(): TemaResuelto {
  return useSyncExternalStore(suscribir, () => temaActual, () => 'dark')
}

export function usePreferenciaTema(): PreferenciaTema {
  return useSyncExternalStore(suscribir, () => preferenciaActual, () => 'dark')
}
