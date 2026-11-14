import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'

/**
 * Cambio de paso de los flujos de cuenta: eje compartido en X (SmoothUI
 * «Shared Axis X», ETAPA_2_REFERENCIAS #21). Avanzar entra desde la derecha;
 * volver, desde la izquierda. Solo opacity y transform: 90 ms de salida y
 * 190 ms de entrada (`mode="wait"` los encadena, < 300 ms en total); con
 * `prefers-reduced-motion` queda un fundido sin desplazamiento.
 */
const DESPLAZAMIENTO = 20

const variantes: Variants = {
  entrar: ({ direccion, reducir }: Custom) => ({ opacity: 0, x: reducir ? 0 : direccion * DESPLAZAMIENTO }),
  centro: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.19, ease: [0.16, 1, 0.3, 1] },
  },
  salir: ({ direccion, reducir }: Custom) => ({
    opacity: 0,
    x: reducir ? 0 : direccion * -DESPLAZAMIENTO,
    transition: { duration: 0.09, ease: [0.4, 0, 1, 1] },
  }),
}

interface Custom {
  direccion: 1 | -1
  reducir: boolean
}

export function TransicionPasos({
  paso,
  direccion,
  children,
}: {
  /** Identifica el paso visible; al cambiar, se anima el relevo. */
  paso: string
  direccion: 1 | -1
  children: ReactNode
}) {
  const reducir = Boolean(useReducedMotion())
  const custom: Custom = { direccion, reducir }
  return (
    <AnimatePresence mode="wait" initial={false} custom={custom}>
      <motion.div key={paso} custom={custom} variants={variantes} initial="entrar" animate="centro" exit="salir">
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
