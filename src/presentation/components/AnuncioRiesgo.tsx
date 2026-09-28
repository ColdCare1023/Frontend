import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { NivelRiesgo } from '@/domain/value-objects/NivelRiesgo'

/**
 * Región viva que anuncia los cambios de nivel de riesgo que llegan por SSE
 * (RF-11).
 *
 * El problema: la lectura en vivo repinta la píldora del semáforo y las cifras
 * de las tarjetas sin mover el foco ni alterar la estructura del documento. Un
 * lector de pantalla no tiene por qué volver a leer nada, así que una excursión
 * térmica —el evento que justifica todo el sistema— pasaba completamente
 * inadvertida para quien no ve la pantalla. WCAG 4.1.3 (Mensajes de estado, AA)
 * exige que este cambio se comunique por rol o propiedad, sin recibir el foco.
 *
 * Decisiones:
 *
 * - `aria-live="assertive"` para la excursión crítica: interrumpe lo que se
 *   esté leyendo, que es exactamente el comportamiento deseado cuando el
 *   medicamento está fuera de rango. Los demás niveles usan `polite` para no
 *   convertir el dashboard en un martilleo.
 * - Solo se anuncia el **cambio** de nivel, no cada lectura. Con una muestra
 *   cada pocos segundos, anunciar todas haría el interfaz inusable; repetir
 *   «Normal» sesenta veces por minuto es ruido, no información.
 * - El mensaje incluye la temperatura, porque «excursión crítica» a secas no
 *   dice si el refrigerador está a 9 °C o a 22 °C.
 * - Dos regiones fijas y siempre montadas: insertar el contenedor a la vez que
 *   el texto es la causa habitual de que un anuncio no llegue a leerse.
 */
export function AnuncioRiesgo({
  nivel,
  temperatura,
}: {
  nivel: NivelRiesgo | null
  temperatura: number | null | undefined
}) {
  const { t, i18n } = useTranslation()
  const [mensaje, setMensaje] = useState('')
  const nivelPrevio = useRef<NivelRiesgo | null | undefined>(undefined)

  useEffect(() => {
    // El primer render no es un cambio de estado: es el estado inicial.
    if (nivelPrevio.current === undefined) {
      nivelPrevio.current = nivel
      return
    }
    if (nivel === nivelPrevio.current) return
    nivelPrevio.current = nivel
    if (!nivel) return

    setMensaje(
      temperatura == null
        ? t('dashboard.anuncioRiesgoSinTemp', { nivel: t(`riesgo.${nivel}`) })
        : t('dashboard.anuncioRiesgo', {
            nivel: t(`riesgo.${nivel}`),
            temperatura: temperatura.toFixed(1),
          }),
    )
    // `i18n.language` en las dependencias: si se cambia de idioma con una
    // alerta en pantalla, el texto anunciado debe seguir al idioma del
    // documento (WCAG 3.1.2).
  }, [nivel, temperatura, t, i18n.language])

  const critica = nivel === 'excursion_critica'

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {critica ? '' : mensaje}
      </div>
      <div role="alert" aria-live="assertive" className="sr-only">
        {critica ? mensaje : ''}
      </div>
    </>
  )
}
