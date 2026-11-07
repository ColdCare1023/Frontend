import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * Número que rueda dígito a dígito: cada posición conserva su identidad desde la
 * derecha y solo se mueven los dígitos que cambiaron. Recibe el texto ya formateado
 * para no alterar el redondeo; el lector de pantalla lee el valor entero.
 */
function Celda({ caracter, direccion }: { caracter: string; direccion: number }) {
  const previo = useRef(caracter)
  const [estado, setEstado] = useState({ actual: caracter, saliente: null as string | null, generacion: 0 })

  useEffect(() => {
    if (caracter === previo.current) return
    setEstado((e) => ({ actual: caracter, saliente: previo.current, generacion: e.generacion + 1 }))
    previo.current = caracter
  }, [caracter])

  const animando = estado.saliente !== null
  return (
    <span className="num-celda" style={{ '--num-dir': direccion } as React.CSSProperties}>
      <span
        key={`entra-${estado.generacion}`}
        className={cn('num-capa', animando && 'num-entra')}
        onAnimationEnd={animando ? () => setEstado((e) => ({ ...e, saliente: null })) : undefined}
      >
        {estado.actual}
      </span>
      {animando && (
        <span key={`sale-${estado.generacion}`} className="num-capa num-sale">
          {estado.saliente}
        </span>
      )}
    </span>
  )
}

export function NumeroAnimado({ valor, className }: { valor: string; className?: string }) {
  const numero = Number.parseFloat(valor)
  const [anterior, setAnterior] = useState(numero)
  const [direccion, setDireccion] = useState(1)
  if (anterior !== numero && !Number.isNaN(numero)) {
    setDireccion(numero < anterior ? -1 : 1)
    setAnterior(numero)
  }

  const caracteres = valor.split('')
  return (
    <span className={cn('num-raiz', className)}>
      <span className="sr-only">{valor}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {caracteres.map((caracter, i) => (
          <Celda key={caracteres.length - 1 - i} caracter={caracter} direccion={direccion} />
        ))}
      </span>
    </span>
  )
}
