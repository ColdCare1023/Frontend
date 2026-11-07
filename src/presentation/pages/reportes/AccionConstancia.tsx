import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Check, FileDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '../../components/ui/button'

export type FaseConstancia = 'reposo' | 'preparando' | 'descargando' | 'listo'

/**
 * El gesto principal: un botón que muestra su avance (preparar la hoja, generar el PDF) y, al
 * terminar, se transforma en el resultado. La pieza es la misma (`layoutId`): cambia de forma con
 * `transform` y lo de dentro aparece cuando ya casi llegó.
 */
export function AccionConstancia({
  fase,
  deshabilitado,
  archivo,
  onDescargar,
}: {
  fase: FaseConstancia
  deshabilitado: boolean
  archivo: string
  onDescargar: () => void
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const transicion = reducir ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.8 }
  const otraVez = useRef<HTMLButtonElement>(null)
  // El foco sigue a quien pulsó: el botón deja de existir y su sitio lo ocupa el resultado.
  const pidio = useRef(false)
  useEffect(() => {
    if (fase !== 'listo' || !pidio.current) return
    pidio.current = false
    otraVez.current?.focus()
  }, [fase])

  const descargar = () => {
    pidio.current = true
    onDescargar()
  }

  if (fase === 'listo') {
    return (
      <motion.div layoutId="constancia-pieza" transition={transicion} className="constancia-resultado tema-capsula rounded-[26px]">
        <motion.div
          initial={reducir ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reducir ? { duration: 0 } : { duration: 0.16, delay: 0.12 }}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2"
        >
          <span aria-hidden className="constancia-resultado__marca">
            <Check className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] leading-5 font-semibold text-foreground">{t('reportes.descargada')}</span>
            <span className="nums block truncate text-xs leading-4 text-muted">{archivo}</span>
          </span>
          <Button ref={otraVez} variant="secondary" size="sm" onClick={descargar} disabled={deshabilitado}>
            {t('reportes.descargarOtraVez')}
          </Button>
        </motion.div>
      </motion.div>
    )
  }

  const ocupado = fase !== 'reposo'
  return (
    <motion.div layoutId="constancia-pieza" transition={transicion} className="w-full rounded-(--radius-field) sm:w-auto">
      <Button
        size="lg"
        onClick={descargar}
        disabled={deshabilitado}
        cargando={ocupado}
        className={cn(
          'constancia-boton h-14 w-full px-7 text-base sm:h-14 sm:w-auto sm:min-w-[15rem] sm:pointer-coarse:h-14',
          ocupado && 'disabled:opacity-100',
        )}
      >
        <span aria-hidden className="constancia-boton__avance" data-fase={fase} />
        {!ocupado && <FileDown />}
        {fase === 'preparando'
          ? t('reportes.generandoConstancia')
          : fase === 'descargando'
            ? t('reportes.generandoPdf')
            : t('reportes.descargarPdf')}
      </Button>
    </motion.div>
  )
}
