import { useSyncExternalStore } from 'react'

export type NivelNotch = 'critico' | 'aviso' | 'ok'

export interface AvisoIsla {
  id: string
  nivel: NivelNotch
  titulo: string
  detalle: string
  /** Cuánto sigue vigente, en milisegundos. La isla lo cuenta y se recoge antes. */
  duracion: number
  creadoEn: number
}

/** Cuántos avisos de la sesión se conservan para releerlos en el panel de la isla. */
const MAXIMO_RECIENTES = 8

/*
 * Lo que la isla tiene que contar. Cualquiera publica aquí (hoy, AvisosTiempoReal) y la
 * isla crece para contenerlo; no hay avisos sueltos en otra parte de la pantalla.
 */
let avisos: AvisoIsla[] = []
const oyentes = new Set<() => void>()

function emitir() {
  oyentes.forEach((oyente) => oyente())
}

/** Publica un aviso en la isla; devuelve su id para poder retirarlo. */
export function notificarNotch(
  nivel: NivelNotch,
  { id, titulo, detalle, duracion }: { id: string; titulo: string; detalle: string; duracion: number },
): string {
  avisos = [{ id, nivel, titulo, detalle, duracion, creadoEn: Date.now() }, ...avisos.filter((a) => a.id !== id)].slice(0, MAXIMO_RECIENTES)
  emitir()
  return id
}

export function retirarNotch(id: string) {
  avisos = avisos.filter((a) => a.id !== id)
  emitir()
}

/** Al cerrar sesión: el siguiente usuario de la pestaña no hereda los avisos. */
export function limpiarAvisos() {
  if (avisos.length === 0) return
  avisos = []
  emitir()
}

/** Avisos de la sesión, del más nuevo al más antiguo. */
export function useAvisosIsla(): AvisoIsla[] {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente)
      return () => {
        oyentes.delete(oyente)
      }
    },
    () => avisos,
    () => avisos,
  )
}
