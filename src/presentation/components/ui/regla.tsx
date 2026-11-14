import { useTranslation } from 'react-i18next'

import { RANGO_TERMICO } from '@/domain/value-objects/NivelRiesgo'
import { cn } from '@/lib/utils'
import { COLOR_ESTADO, type TonoEstado } from './estado-tonos'
import { formatearTemperatura } from './formato-cifra'
import { posicionEnRegla } from './regla-eje'

export type TamanoRegla = 'xl' | 'm' | 's' | 'xs'

const ANCHO: Record<TamanoRegla, string> = {
  xl: 'w-full',
  m: 'w-full',
  s: 'w-16',
  xs: 'w-10',
}

const CLASE: Record<TamanoRegla, string> = {
  xl: 'regla',
  m: 'regla regla--m',
  s: 'regla regla--s',
  xs: 'regla regla--xs',
}

/**
 * La firma de ColdCare: la «Regla 2–8» (DIRECTION §4). Un instrumento lineal
 * con la franja teal 2–8 °C, la marca del color del estado y, en XL y M, las
 * marcas finas de mínima y máxima de 24 h como el termómetro de máxima y
 * mínima de la puerta del refrigerador.
 *
 * La marca se mueve con `transform` (nunca `left`). Es `role="img"` con un
 * nombre que dice el valor y el rango: el color nunca va solo.
 */
export function Regla({
  valor,
  tono = 'neutro',
  tamano = 'm',
  minimo = null,
  maximo = null,
  cotas,
  etiqueta,
  decorativa = false,
  className,
}: {
  /** Temperatura en °C; `null` = sin lectura (sin marca). */
  valor: number | null
  tono?: TonoEstado
  tamano?: TamanoRegla
  /** Extremos de 24 h (XL y M). */
  minimo?: number | null
  maximo?: number | null
  /** Cotas bajo la pista: 0·2·8·10 en XL, 2·8 en M. Por defecto solo en XL. */
  cotas?: boolean
  /** Nombre accesible; por defecto «5.2 °C, rango 2–8 °C». */
  etiqueta?: string
  /** Dentro de un control que ya dice el valor: oculta la regla al lector. */
  decorativa?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const conExtremos = tamano === 'xl' || tamano === 'm'
  const mostrarCotas = cotas ?? tamano === 'xl'
  const nombre =
    etiqueta ??
    t('regla.nombre', {
      valor: valor === null ? t('regla.sinLectura') : formatearTemperatura(valor),
      minimo: RANGO_TERMICO.minimo,
      maximo: RANGO_TERMICO.maximo,
    })

  return (
    <div
      {...(decorativa ? { 'aria-hidden': true } : { role: 'img', 'aria-label': nombre })}
      className={cn(CLASE[tamano], ANCHO[tamano], 'shrink-0', className)}>
      <div className="regla__pista">
        <span aria-hidden className="regla__banda" />
        {conExtremos && minimo !== null && (
          <span aria-hidden className="regla__carro" style={{ '--pos': posicionEnRegla(minimo) } as React.CSSProperties}>
            <span className="regla__extremo" />
          </span>
        )}
        {conExtremos && maximo !== null && (
          <span aria-hidden className="regla__carro" style={{ '--pos': posicionEnRegla(maximo) } as React.CSSProperties}>
            <span className="regla__extremo" />
          </span>
        )}
        {valor !== null && (
          <span
            aria-hidden
            data-regla-marca
            className="regla__carro"
            style={{ '--pos': posicionEnRegla(valor), '--marca': COLOR_ESTADO[tono] } as React.CSSProperties}
          >
            <span className="regla__marca" />
          </span>
        )}
      </div>
      {mostrarCotas && (
        <div aria-hidden className="regla__cotas">
          {(tamano === 'xl' ? [0, 2, 8, 10] : [2, 8]).map((cota) => (
            <span key={cota} style={{ left: `${posicionEnRegla(cota) * 100}%` }}>
              {cota}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
