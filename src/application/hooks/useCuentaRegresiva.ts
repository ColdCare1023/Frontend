import { useEffect, useState } from 'react'

function segundosHasta(hasta: number | null): number {
  return hasta === null ? 0 : Math.max(0, Math.ceil((hasta - Date.now()) / 1000))
}

/**
 * Segundos que faltan hasta un instante absoluto (ms). Se calcula contra el
 * reloj en cada tic, así que una pestaña en segundo plano no se atrasa.
 * `hasta = null` detiene la cuenta y devuelve 0.
 */
export function useCuentaRegresiva(hasta: number | null): number {
  const [restante, setRestante] = useState(() => segundosHasta(hasta))

  useEffect(() => {
    setRestante(segundosHasta(hasta))
    if (hasta === null) return
    const id = window.setInterval(() => {
      const valor = segundosHasta(hasta)
      setRestante(valor)
      if (valor === 0) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [hasta])

  return restante
}

/** 75 → "1:15" (minutos:segundos). */
export function formatearMinSeg(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
