import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Check, ShieldCheck } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '../../components/ui/button'

/**
 * Un solo botón grande, blanco sobre el color del veredicto. Mientras comprueba muestra su avance; al
 * terminar, la misma pieza (`layoutId`) se encoge hasta ser el resultado, con «Comprobar otra vez».
 */
export function AccionComprobar({
  comprobando,
  comprobado,
  hora,
  onComprobar,
}: {
  comprobando: boolean
  /** Ya hay un resultado en pantalla. */
  comprobado: boolean
  /** Hora del último resultado, si se comprobó en esta visita. */
  hora: string | null
  onComprobar: () => void
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const transicion = reducir ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.8 }
  const otraVez = useRef<HTMLButtonElement>(null)
  const pidio = useRef(false)
  const resultado = comprobado && !comprobando

  // El botón deja de existir: el foco pasa al resultado, que es donde sigue la conversación.
  useEffect(() => {
    if (!resultado || !pidio.current) return
    pidio.current = false
    otraVez.current?.focus()
  }, [resultado])

  const comprobar = () => {
    pidio.current = true
    onComprobar()
  }

  if (resultado) {
    return (
      <motion.div layoutId="comprobar-pieza" transition={transicion} className="comprobar-resultado rounded-[26px]">
        <motion.div
          initial={reducir ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reducir ? { duration: 0 } : { duration: 0.16, delay: 0.12 }}
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          <span className="inline-flex items-center gap-2 pl-1 text-[15px] leading-5 font-semibold">
            <Check aria-hidden className="size-4" />
            {hora ? t('trazabilidad.comprobadoALas', { hora }) : t('trazabilidad.comprobado')}
          </span>
          <Button ref={otraVez} variant="ghost" size="sm" className="comprobar-resultado__otra" onClick={comprobar}>
            {t('trazabilidad.comprobarOtraVez')}
          </Button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div layoutId="comprobar-pieza" transition={transicion} className="w-full rounded-[14px] sm:w-auto">
      <Button
        variant="secondary"
        size="lg"
        onClick={comprobar}
        cargando={comprobando}
        className={cn(
          'comprobar-boton h-14 w-full border-0 bg-white px-8 text-[17px] font-semibold text-[#0f172a] sm:h-14 sm:w-auto sm:pointer-coarse:h-14',
          comprobando && 'disabled:opacity-100',
        )}
      >
        <span aria-hidden className="comprobar-boton__avance" data-activo={comprobando} />
        {!comprobando && <ShieldCheck />}
        {comprobando ? t('trazabilidad.verificando') : t('trazabilidad.verificar')}
      </Button>
    </motion.div>
  )
}
