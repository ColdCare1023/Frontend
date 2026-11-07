import { useSyncExternalStore } from 'react'

/**
 * Un solo reloj por pantalla. Quien lo necesita deriva de él un valor simple y solo se vuelve a
 * dibujar cuando ese valor cambia: «hace 4 s» avanza cada segundo sin arrastrar al campo entero,
 * a la gráfica ni al vial.
 */
const oyentes = new Set<() => void>()
let temporizador: ReturnType<typeof setInterval> | null = null
let instante = Date.now()

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  if (temporizador === null) {
    instante = Date.now()
    temporizador = setInterval(() => {
      instante = Date.now()
      oyentes.forEach((avisar) => avisar())
    }, 1000)
  }
  return () => {
    oyentes.delete(oyente)
    if (oyentes.size === 0 && temporizador !== null) {
      clearInterval(temporizador)
      temporizador = null
    }
  }
}

export function useDelReloj<T extends number | boolean>(derivar: (ahora: number) => T): T {
  return useSyncExternalStore(suscribir, () => derivar(temporizador === null ? Date.now() : instante))
}

export function segundosDesde(marca: string, ahora: number): number {
  return Math.max(0, Math.floor((ahora - new Date(marca).getTime()) / 1000))
}

/**
 * Redondea la antigüedad a la unidad con que se dice («45 s», «2 min», «3 h», «2 d»). Quien la
 * deriva del reloj solo se vuelve a dibujar cuando cambia lo que se lee, no cada segundo.
 */
export function segundosRedondeados(segundos: number): number {
  if (segundos < 90) return segundos
  if (segundos < 5_400) return Math.round(segundos / 60) * 60
  if (segundos < 129_600) return Math.round(segundos / 3_600) * 3_600
  return Math.round(segundos / 86_400) * 86_400
}

/** «45 s», «2 min», «3 h», «2 días»: la unidad la pone el idioma, sin claves de traducción. */
export function tiempoBreve(segundos: number, locale: string): string {
  // Los días van en largo: en español la forma corta es «2 dd.».
  const unidad = (valor: number, nombre: 'second' | 'minute' | 'hour' | 'day') =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: nombre,
      unitDisplay: nombre === 'day' ? 'long' : 'short',
      maximumFractionDigits: 0,
    }).format(valor)
  const redondeados = segundosRedondeados(Math.max(0, Math.round(segundos)))
  const texto =
    redondeados < 90
      ? unidad(redondeados, 'second')
      : redondeados < 5_400
        ? unidad(redondeados / 60, 'minute')
        : redondeados < 129_600
          ? unidad(redondeados / 3_600, 'hour')
          : unidad(redondeados / 86_400, 'day')
  // «2 min» no se parte entre dos líneas.
  return texto.replace(/\s/g, '\u00a0')
}
