import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

export interface MedidaIndicador {
  /** Desplazamiento del elemento activo desde el borde izquierdo del contenedor. */
  izquierda: number
  ancho: number
  /** Ancho total del contenedor. */
  total: number
  /** Falso en la primera pintura: el indicador aparece sin transición. */
  listo: boolean
}

/**
 * Mide el elemento activo (`[data-activo]`) dentro de `contenedor` para un
 * indicador compartido (segmentado, pestañas). Lee una vez por cambio y con
 * un ResizeObserver (idioma, ancho); nunca anima propiedades de layout: el
 * consumidor convierte la medida en `transform` o `clip-path`.
 */
export function useIndicador(contenedor: RefObject<HTMLElement | null>, clave: unknown): MedidaIndicador {
  const [medida, setMedida] = useState<MedidaIndicador>({ izquierda: 0, ancho: 0, total: 0, listo: false })
  const listo = useRef(false)

  useLayoutEffect(() => {
    const raiz = contenedor.current
    if (!raiz) return
    const medir = () => {
      const activo = raiz.querySelector<HTMLElement>('[data-activo]')
      if (!activo) return
      const siguiente = { izquierda: activo.offsetLeft, ancho: activo.offsetWidth, total: raiz.offsetWidth }
      setMedida((previa) =>
        previa.izquierda === siguiente.izquierda && previa.ancho === siguiente.ancho && previa.total === siguiente.total
          ? previa
          : { ...siguiente, listo: listo.current },
      )
    }
    medir()
    // La primera medida se pinta sin transición; las siguientes, con ella.
    const marco = requestAnimationFrame(() => {
      listo.current = true
      setMedida((previa) => (previa.listo ? previa : { ...previa, listo: true }))
    })
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(marco)
    const observador = new ResizeObserver(medir)
    observador.observe(raiz)
    return () => {
      cancelAnimationFrame(marco)
      observador.disconnect()
    }
  }, [contenedor, clave])

  return medida
}
