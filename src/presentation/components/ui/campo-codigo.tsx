import { forwardRef, useEffect, useImperativeHandle, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnimate, useReducedMotion } from 'motion/react'

import { LONGITUD_CODIGO, normalizarCodigo } from '@/domain/value-objects/codigoVerificacion'
import { cn } from '@/lib/utils'

export type EstadoCampoCodigo = 'normal' | 'error' | 'exito'

export interface CampoCodigoProps {
  /** Solo dígitos, de 0 a `longitud` caracteres. */
  valor: string
  onCambiar: (valor: string) => void
  /** Se llama una vez cuando se completan todos los dígitos. */
  onCompleto?: (codigo: string) => void
  longitud?: number
  estado?: EstadoCampoCodigo
  /**
   * Cambia en cada rechazo: dispara la sacudida aunque el estado ya fuera
   * `error` (dos códigos incorrectos seguidos).
   */
  intentoFallido?: number
  disabled?: boolean
  autoFocus?: boolean
  /** Nombre accesible del grupo («Código de verificación»). */
  etiqueta: string
  /** id del texto de ayuda o del error asociado. */
  describedBy?: string
  idBase?: string
}

export interface CampoCodigoRef {
  enfocar: () => void
}

/**
 * Entrada de un código de un solo uso en casillas (patrón OTP de SmoothUI /
 * shadcn, ETAPA_2_REFERENCIAS #21), con inputs nativos para conservar el
 * autocompletado del sistema (`one-time-code`), el teclado numérico y el
 * pegado. Pegar el código completo en cualquier casilla rellena todas.
 *
 * Movimiento: sacudida corta en X ante un rechazo y un pulso de escala
 * escalonado al aceptarse; solo `transform`, < 300 ms, y nada con
 * `prefers-reduced-motion` (el color sigue comunicando el estado).
 */
export const CampoCodigo = forwardRef<CampoCodigoRef, CampoCodigoProps>(function CampoCodigo(
  {
    valor,
    onCambiar,
    onCompleto,
    longitud = LONGITUD_CODIGO,
    estado = 'normal',
    intentoFallido = 0,
    disabled = false,
    autoFocus = false,
    etiqueta,
    describedBy,
    idBase = 'codigo',
  },
  ref,
) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const casillas = useRef<Array<HTMLInputElement | null>>([])
  const digitos = Array.from({ length: longitud }, (_, i) => valor[i] ?? '')
  const mitad = Math.ceil(longitud / 2)

  useImperativeHandle(ref, () => ({
    enfocar: () => casillas.current[Math.min(valor.length, longitud - 1)]?.focus(),
  }))

  useEffect(() => {
    if (autoFocus) casillas.current[0]?.focus()
  }, [autoFocus])

  // Sacudida de rechazo (transform only).
  useEffect(() => {
    if (intentoFallido === 0 || reducir || !scope.current) return
    void animate(scope.current, { x: [0, -7, 6, -4, 2, 0] }, { duration: 0.28, ease: 'easeOut' })
  }, [intentoFallido, reducir, animate, scope])

  // Pulso de aceptación, escalonado de izquierda a derecha.
  useEffect(() => {
    if (estado !== 'exito' || reducir || !scope.current) return
    const elementos = scope.current.querySelectorAll('[data-casilla]')
    elementos.forEach((elemento, i) => {
      void animate(elemento, { scale: [1, 1.08, 1] }, { duration: 0.18, delay: i * 0.012, ease: 'easeOut' })
    })
  }, [estado, reducir, animate, scope])

  const fijar = (siguiente: string, foco: number) => {
    const limpio = normalizarCodigo(siguiente, longitud)
    onCambiar(limpio)
    casillas.current[Math.min(foco, longitud - 1)]?.focus()
    if (limpio.length === longitud && limpio !== valor) onCompleto?.(limpio)
  }

  const escribir = (indice: number, texto: string) => {
    const nuevos = normalizarCodigo(texto, longitud)
    if (!nuevos) {
      // Algunos teclados Android informan Retroceso como `Unidentified`: solo
      // llega el `change` con la casilla vacía, que aquí equivale a borrar.
      if (!texto && digitos[indice]) borrar(indice)
      return
    }
    // Autocompletado del sistema o pegado sobre una casilla: reparte los
    // dígitos desde esa posición. El valor no tiene huecos, así que escribir
    // en una casilla posterior al último dígito continúa donde termina.
    const inicio = Math.min(indice, valor.length)
    const combinado = (valor.slice(0, inicio) + nuevos + valor.slice(inicio + nuevos.length)).slice(0, longitud)
    fijar(combinado, inicio + nuevos.length)
  }

  const borrar = (indice: number) => {
    if (digitos[indice]) {
      fijar(valor.slice(0, indice) + valor.slice(indice + 1), indice)
      return
    }
    if (indice === 0) return
    fijar(valor.slice(0, indice - 1) + valor.slice(indice), indice - 1)
  }

  const alPresionar = (indice: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      borrar(indice)
    } else if (event.key === 'Delete') {
      event.preventDefault()
      fijar(valor.slice(0, indice) + valor.slice(indice + 1), indice)
    } else if (event.key === 'ArrowLeft' && indice > 0) {
      event.preventDefault()
      casillas.current[indice - 1]?.focus()
    } else if (event.key === 'ArrowRight' && indice < longitud - 1) {
      event.preventDefault()
      casillas.current[indice + 1]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      casillas.current[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      casillas.current[Math.min(valor.length, longitud - 1)]?.focus()
    }
  }

  const alPegar = (indice: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pegado = normalizarCodigo(event.clipboardData.getData('text'), longitud)
    if (!pegado) return
    // Un código completo reemplaza todo, se pegue donde se pegue.
    if (pegado.length === longitud) fijar(pegado, longitud - 1)
    else escribir(indice, pegado)
  }

  return (
    <div
      ref={scope}
      role="group"
      aria-label={etiqueta}
      aria-describedby={describedBy}
      data-estado={estado}
      className="flex items-center gap-2 sm:gap-2.5"
    >
      {digitos.map((digito, indice) => (
        <div key={indice} className="contents">
          {indice === mitad && <span aria-hidden className="h-0.5 w-2.5 shrink-0 rounded-full bg-border-strong" />}
          <input
            ref={(nodo) => {
              casillas.current[indice] = nodo
            }}
            id={`${idBase}-${indice}`}
            data-casilla
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={indice === 0 ? 'one-time-code' : 'off'}
            // Admite que el sistema rellene el código entero en la primera casilla.
            maxLength={indice === 0 ? longitud : 1}
            value={digito}
            disabled={disabled}
            aria-label={t('codigo.digito', { n: indice + 1, total: longitud })}
            aria-invalid={estado === 'error' || undefined}
            // El foco salta a la primera casilla: ahí se lee a dónde llegó el código.
            aria-describedby={indice === 0 ? describedBy : undefined}
            onChange={(event) => escribir(indice, event.target.value)}
            onKeyDown={(event) => alPresionar(indice, event)}
            onPaste={(event) => alPegar(indice, event)}
            onFocus={(event) => event.target.select()}
            className={cn(
              'h-14 min-w-0 flex-1 rounded-[10px] border bg-surface text-center text-[22px] leading-none font-semibold tabular-nums text-foreground caret-primary dark:bg-surface-sunken',
              'transition-[border-color,box-shadow,background-color] duration-(--duration-micro) ease-(--ease-ui)',
              'focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20',
              'disabled:cursor-not-allowed disabled:opacity-60',
              estado === 'error' && 'border-critical bg-critical-tint text-critical focus:border-critical focus:ring-critical/45',
              estado === 'exito' && 'border-success-600 bg-success-100 text-success-700 dark:bg-success-100/10',
              estado === 'normal' && (digito ? 'border-border-strong' : 'border-border-field hover:border-faint'),
            )}
          />
        </div>
      ))}
    </div>
  )
})
