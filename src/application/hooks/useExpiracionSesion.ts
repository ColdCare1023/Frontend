import { useEffect, useState } from 'react'

import { useAuthStore } from '@/application/stores/authStore'

/** Antelación con la que se avisa al usuario de que su sesión va a caducar. */
export const ANTELACION_AVISO_MS = 5 * 60 * 1000

/** Cada cuánto se refresca el contador mientras el aviso está visible. */
const REFRESCO_MS = 1000

export interface EstadoExpiracion {
  /** Faltan menos de `ANTELACION_AVISO_MS` para que el token caduque. */
  porExpirar: boolean
  /** Milisegundos restantes; nunca negativo. */
  restanteMs: number
}

/**
 * FS5 — aviso de sesión próxima a expirar.
 *
 * Sin esto el usuario descubre la caducidad al pulsar «guardar»: la petición
 * devuelve 401 y el trabajo a medio escribir (una verificación BPA, una acción
 * correctiva) se pierde sin explicación. Avisar con antelación permite
 * guardar antes de perderlo.
 *
 * Al vencer el plazo se cierra la sesión desde el cliente en vez de esperar al
 * primer 401: la interfaz deja de mostrar datos de una sesión que ya no es
 * válida.
 */
export function useExpiracionSesion(
  alExpirar: () => void,
  antelacionMs: number = ANTELACION_AVISO_MS,
): EstadoExpiracion {
  const expiraEn = useAuthStore((s) => s.usuario?.expiraEn ?? 0)
  const [restanteMs, setRestanteMs] = useState(() => Math.max(0, expiraEn - Date.now()))

  useEffect(() => {
    // `expiraEn === 0` es un token sin `exp` legible: no se inventa una
    // caducidad ni se expulsa al usuario por una suposición.
    if (!expiraEn) {
      setRestanteMs(0)
      return
    }

    const recalcular = () => Math.max(0, expiraEn - Date.now())
    setRestanteMs(recalcular())

    // Un intervalo de un segundo, y no un `setTimeout` calculado de una vez:
    // si el equipo se suspende, el temporizador único dispararía tarde y la
    // sesión seguiría viva en pantalla mucho después de haber caducado.
    const temporizador = window.setInterval(() => {
      const restante = recalcular()
      setRestanteMs(restante)
      if (restante === 0) {
        window.clearInterval(temporizador)
        alExpirar()
      }
    }, REFRESCO_MS)

    if (recalcular() === 0) {
      window.clearInterval(temporizador)
      alExpirar()
    }

    return () => window.clearInterval(temporizador)
  }, [expiraEn, alExpirar])

  return {
    porExpirar: expiraEn > 0 && restanteMs > 0 && restanteMs <= antelacionMs,
    restanteMs,
  }
}

/** Formatea los milisegundos restantes como `m:ss`. */
export function formatearRestante(ms: number): string {
  const totalSegundos = Math.ceil(ms / 1000)
  const minutos = Math.floor(totalSegundos / 60)
  const segundos = totalSegundos % 60
  return `${minutos}:${String(segundos).padStart(2, '0')}`
}
