import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import type { FiltroEstado } from '@/application/hooks/useAlertas'

/** HU-23: los filtros siguen la máquina de estados. Pendientes va primero y es el de entrada. */
const FILTROS_ESTADO: FiltroEstado[] = ['pendiente', 'reconocida', 'atendida', 'todas']

/** Cápsula negra con una pastilla blanca que se desliza, igual que la navegación. */
export function PestanasEstado({ valor, onCambiar }: { valor: FiltroEstado; onCambiar: (filtro: FiltroEstado) => void }) {
  const { t } = useTranslation()
  const id = useId()
  const reducir = useReducedMotion()
  return (
    <div role="group" aria-label={t('alertas.filtroEstado')} className="pestanas-aviso">
      {FILTROS_ESTADO.map((opcion) => {
        const activo = opcion === valor
        return (
          <button key={opcion} type="button" aria-pressed={activo} onClick={() => onCambiar(opcion)} className="pestanas-aviso__boton">
            {activo && (
              <motion.span
                layoutId={`pestana-${id}`}
                aria-hidden
                transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }}
                className="pestanas-aviso__pastilla"
              />
            )}
            <span className="relative">{t(`alertas.filtro.${opcion}`)}</span>
          </button>
        )
      })}
    </div>
  )
}
