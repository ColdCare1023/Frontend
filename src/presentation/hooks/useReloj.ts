import { useEffect, useState } from 'react'

/**
 * Reloj de hoja (PERFORMANCE C1): solo repinta el componente que lo usa, cada
 * `intervaloMs`. Con la pestaña oculta se detiene y al volver se pone al día
 * de inmediato, así que nada muestra un «hace X s» congelado.
 */
export function useReloj(intervaloMs: number): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    let id: number | undefined
    const arrancar = () => {
      window.clearInterval(id)
      setAhora(Date.now())
      id = window.setInterval(() => setAhora(Date.now()), intervaloMs)
    }
    const alCambiarVisibilidad = () => {
      if (document.hidden) window.clearInterval(id)
      else arrancar()
    }
    id = window.setInterval(() => setAhora(Date.now()), intervaloMs)
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [intervaloMs])
  return ahora
}

/** Inicio del minuto en curso: para lo que solo cambia de minuto en minuto. */
export function useMinuto(): number {
  return Math.floor(useReloj(60_000) / 60_000) * 60_000
}

/** Segundos transcurridos desde `marca` (ISO), al segundo; `null` sin marca. */
export function useSegundosDesde(marca: string | null | undefined): number | null {
  const ahora = useReloj(1000)
  if (!marca) return null
  return Math.max(0, Math.floor((ahora - new Date(marca).getTime()) / 1000))
}

/**
 * `true` en cuanto pasan `umbralSegundos` desde `marca`. No hace tictac: un
 * temporizador cambia el valor justo en ese instante, así que el componente
 * que lo usa solo se repinta cuando el dato se vuelve viejo.
 */
export function useVencido(marca: string | null | undefined, umbralSegundos: number): boolean {
  const instante = marca ? new Date(marca).getTime() : Number.NaN
  const limite = Number.isFinite(instante) ? instante + umbralSegundos * 1000 : null
  const [estado, setEstado] = useState(() => ({ limite, vencido: limite !== null && Date.now() >= limite }))
  if (estado.limite !== limite) setEstado({ limite, vencido: limite !== null && Date.now() >= limite })
  useEffect(() => {
    if (limite === null) return
    const resta = limite - Date.now()
    if (resta <= 0) return
    const id = window.setTimeout(() => setEstado({ limite, vencido: true }), resta)
    return () => window.clearTimeout(id)
  }, [limite])
  return estado.vencido
}
