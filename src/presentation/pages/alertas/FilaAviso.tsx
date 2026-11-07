import { memo } from 'react'
import { motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Check, CheckCheck, ChevronRight, CircleDot, MailWarning, TriangleAlert } from 'lucide-react'

import { estadoNotificacion, type AlertaTermica } from '@/domain/entities/AlertaTermica'
import type { EstadoAlerta } from '@/domain/value-objects/EstadoAlerta'
import { fechaHora, localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { segundosDesde, segundosRedondeados, tiempoBreve, useDelReloj } from '../monitoreo/reloj'
import { FONDO_POR_NIVEL, TINTA_POR_NIVEL, temperaturaDeAlerta } from './bandeja'

const ICONO_ESTADO: Record<EstadoAlerta, typeof Check> = {
  pendiente: CircleDot,
  reconocida: Check,
  atendida: CheckCheck,
}

/** Resorte de la bandeja: firme, sin rebote que distraiga. */
export const RESORTE_AVISO = { type: 'spring', stiffness: 420, damping: 42, mass: 0.9 } as const

/**
 * La placa de color de un aviso. Es la misma pieza en la fila y en el detalle (`layoutId`): al
 * abrir un aviso crece desde su fila hasta el detalle, y al elegir otro vuelve a su sitio. Solo
 * se mueve con `transform`; el radio lo corrige Motion para que no se deforme.
 */
export function PlacaAviso({ alerta, morfar, radio, className }: { alerta: AlertaTermica; morfar: boolean; radio: number; className?: string }) {
  const reducir = useReducedMotion()
  const clase = cn('placa-aviso', alerta.estado === 'atendida' ? 'bg-campo-sin-datos' : FONDO_POR_NIVEL[alerta.nivel_riesgo], className)
  if (!morfar || reducir) return <span aria-hidden className={clase} style={{ borderRadius: radio }} />
  return <motion.span aria-hidden layoutId={`aviso-${alerta.id}`} transition={RESORTE_AVISO} style={{ borderRadius: radio }} className={clase} />
}

/** «hace 2 h»: se vuelve a dibujar solo cuando cambia lo que se lee. */
export function HaceCuanto({ marca, className }: { marca: string | null | undefined; className?: string }) {
  const { t } = useTranslation()
  const valida = !!marca && Number.isFinite(Date.parse(marca))
  const segundos = useDelReloj((ahora) => (valida ? segundosRedondeados(segundosDesde(marca!, ahora)) : 0))
  if (!valida) return null
  return (
    <time dateTime={marca!} title={fechaHora(marca)} className={className}>
      {t('alertas.hace', { tiempo: tiempoBreve(segundos, localeActual()) })}
    </time>
  )
}

/**
 * Un aviso de la lista, en palabras simples: qué equipo, qué temperatura, hace cuánto. Un solo
 * gesto: tocarlo lo abre. El mensaje solo se escribe cuando no hay cifra que lo diga; el estado,
 * solo cuando la lista mezcla estados.
 */
export const FilaAviso = memo(function FilaAviso({
  alerta,
  nombre,
  elegida,
  abreHoja,
  morfar,
  mostrarEstado,
  onElegir,
}: {
  alerta: AlertaTermica
  nombre: string
  elegida: boolean
  /** En móvil la fila abre el detalle en una hoja inferior. */
  abreHoja: boolean
  /** Con dos paneles la placa viaja al detalle. */
  morfar: boolean
  mostrarEstado: boolean
  onElegir: (alerta: AlertaTermica, fila: HTMLButtonElement) => void
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  // Una fila que se va suelta la cápsula negra al instante: la siguiente la recibe sin fundidos cruzados.
  const presente = useIsPresent()
  const cifra = temperaturaDeAlerta(alerta)?.toFixed(1) ?? null
  const atendida = alerta.estado === 'atendida'
  const IconoEstado = ICONO_ESTADO[alerta.estado]
  const correoFallido = estadoNotificacion(alerta) === 'no_entregada'
  // Abierto en el panel, su color está allá: aquí queda el hueco con la cifra.
  const placaEnDetalle = elegida && morfar

  return (
    <button
      type="button"
      aria-current={elegida ? 'true' : undefined}
      aria-haspopup={abreHoja ? 'dialog' : undefined}
      onClick={(evento) => onElegir(alerta, evento.currentTarget)}
      className={cn('fila-aviso realce focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', elegida && 'tema-capsula')}
    >
      {elegida && presente && (
        <motion.span
          layoutId="aviso-elegido"
          aria-hidden
          transition={reducir ? { duration: 0 } : RESORTE_AVISO}
          className="fila-aviso__placa"
        />
      )}
      <span className="sr-only">{t('alertas.abrirAlerta')}:</span>{' '}

      <span
        className={cn(
          'fila-aviso__campo',
          placaEnDetalle ? 'fila-aviso__campo--hueco' : atendida ? 'text-campo-sin-datos-tinta' : TINTA_POR_NIVEL[alerta.nivel_riesgo],
        )}
      >
        {!placaEnDetalle && <PlacaAviso alerta={alerta} morfar={morfar} radio={14} />}
        {cifra != null ? (
          <span className="fila-aviso__cifra nums" data-larga={cifra.length > 3 || undefined}>
            {cifra}
            <span className="fila-aviso__unidad">°C</span>
          </span>
        ) : (
          <TriangleAlert aria-hidden className="size-6" />
        )}
        <span className="fila-aviso__nivel">
          {t(`riesgo.${alerta.nivel_riesgo}`)}
          <span className="sr-only"> — {t(`riesgo.detalle.${alerta.nivel_riesgo}`)}</span>
        </span>
      </span>

      <span className="fila-aviso__texto">
        <span className="fila-aviso__equipo">
          {nombre}
          {nombre !== alerta.device_id && <>{' '}<span className="sr-only">{alerta.device_id}</span></>}
        </span>
        {cifra == null && <span className="fila-aviso__mensaje">{alerta.mensaje}</span>}
        <span className="fila-aviso__pie">
          <HaceCuanto marca={alerta.created_at} />
          {mostrarEstado && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>·</span>
              <IconoEstado aria-hidden className="size-3.5 shrink-0" />
              {t(`alertas.estadoAlerta.${alerta.estado}`)}
            </span>
          )}
          {correoFallido && <MailWarning role="img" aria-label={t('alertas.notificacion.no_entregada')} className="size-3.5 shrink-0 text-critical" />}
        </span>
      </span>
      <ChevronRight aria-hidden className="fila-aviso__flecha" />
    </button>
  )
})
