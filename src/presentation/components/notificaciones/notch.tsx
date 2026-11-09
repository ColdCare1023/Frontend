import { Toaster } from './sileo/toaster'

/**
 * Avisos tipo «notch» (Dynamic Island): una píldora oscura arriba al centro
 * que se expande con física para mostrar el detalle (sileo, adaptado).
 * Siempre oscura —negra sobre el tema claro, grafito con filo de luz sobre el
 * negro— para leerse igual en ambos temas.
 */
export function NotchToaster() {
  return <Toaster position="top-center" offset={{ top: 8 }} options={{ roundness: 18 }} />
}
