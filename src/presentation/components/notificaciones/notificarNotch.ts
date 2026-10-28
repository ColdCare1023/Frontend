import { sileo } from './sileo/toaster'
import type { SileoOptions } from './sileo/types'

export type NivelNotch = 'critico' | 'aviso' | 'ok'

const ESTADO: Record<NivelNotch, 'error' | 'warning' | 'success'> = {
  critico: 'error',
  aviso: 'warning',
  ok: 'success',
}

function rellenoNotch(): string {
  if (typeof document === 'undefined') return '#0a0a0a'
  return document.documentElement.dataset.theme === 'dark' ? '#161616' : '#0a0a0a'
}

/** Publica un aviso en el notch; devuelve su id para poder retirarlo. */
export function notificarNotch(
  nivel: NivelNotch,
  { id, titulo, detalle, duracion }: { id: string; titulo: string; detalle: string; duracion: number },
): string {
  const opciones: SileoOptions & { id: string } = {
    id,
    title: titulo,
    description: detalle,
    duration: duracion,
    fill: rellenoNotch(),
    etiqueta: `${titulo}. ${detalle}`,
  }
  return sileo[ESTADO[nivel]](opciones)
}

export function retirarNotch(id: string) {
  sileo.dismiss(id)
}
