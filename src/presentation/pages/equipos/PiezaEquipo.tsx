import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  FlaskConical,
  History,
  KeyRound,
  MapPin,
  PowerOff,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  TriangleAlert,
  UserRound,
} from 'lucide-react'

import { estadoCredencial, type Dispositivo, type SensorIoT } from '@/domain/entities/Dispositivo'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { MenuItem, MenuSeparator } from '../../components/ui/menu'
import { MenuOpciones } from '../usuarios/piezas'
import {
  CAMPO,
  datosSecundarios,
  MUELLE_FICHA,
  nombreEquipo,
  tonoEquipo,
  useEstadoEquipo,
  useFraseCalibracion,
  type TonoEquipo,
} from './estadoEquipo'
import type { AccionesEquipo } from './useAccionesEquipo'

const TONOS = Object.keys(CAMPO) as TonoEquipo[]

/** El color de fondo. Cambia de estado fundiendo capas: solo se anima la opacidad. */
export function CapasCampo({ tono }: { tono: TonoEquipo }) {
  return (
    <span aria-hidden className="absolute inset-0 -z-10">
      {TONOS.map((capa) => (
        <span
          key={capa}
          className={cn(
            'absolute inset-0 transition-opacity duration-(--duration-reveal) ease-(--ease-out-soft)',
            CAMPO[capa].capa,
            capa === tono ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      {/* Fuera de servicio: rayado, para que no se confunda con «sin conexión» de un vistazo. */}
      {tono === 'baja' && (
        <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_12px,color-mix(in_srgb,currentColor_7%,transparent)_12px_24px)]" />
      )}
    </span>
  )
}

/** Pendiente que pide una acción: cápsula negra, se lee sobre cualquier campo de color. */
function ChipAviso({ tono, title, children }: { tono: 'warn' | 'critical'; title?: string; children: ReactNode }) {
  const Icono = tono === 'critical' ? ShieldAlert : TriangleAlert
  return (
    <li title={title} className="relative z-[2] inline-flex max-w-full items-start gap-1.5 rounded-[12px] bg-capsula px-2.5 py-1.5 text-[12.5px] leading-4 font-medium text-white shadow-(--shadow-capsula)">
      <Icono aria-hidden className={cn('mt-px size-3.5 shrink-0', tono === 'critical' ? 'text-[#ff8a80]' : 'text-[#fdb022]')} />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

/** Los pendientes de un equipo (consola del broker, prueba de posesión). */
export function AvisosEquipo({ d, className }: { d: Dispositivo; className?: string }) {
  const { t } = useTranslation()
  if (!d.broker_pendiente && !d.rotacion_por_compromiso && !d.posesion_pendiente) return null
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {d.broker_pendiente && (
        <ChipAviso
          tono="warn"
          title={d.broker_pendiente_desde ? t('dispositivos.brokerPendienteDesde', { fecha: fechaHora(d.broker_pendiente_desde) }) : undefined}
        >
          {t(`dispositivos.brokerPendiente.${d.broker_pendiente}`)}
        </ChipAviso>
      )}
      {d.rotacion_por_compromiso && (
        <ChipAviso tono="critical" title={t('dispositivos.telemetriaRetenidaAyuda')}>
          {t('dispositivos.telemetriaRetenida')}
        </ChipAviso>
      )}
      {d.posesion_pendiente && (
        <ChipAviso tono="warn" title={t('dispositivos.posesionPendienteAyuda')}>
          {t('dispositivos.posesionPendiente')}
        </ChipAviso>
      )}
    </ul>
  )
}

/** Un sensor como una luz del aparato: encendida, en falla (rombo) o sin instalar (hueca). */
export function LuzSensor({ estado, className }: { estado: SensorIoT['estado']; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0',
        estado === 'ok' && 'rounded-full bg-current',
        estado === 'error' && 'rotate-45 rounded-[2px] bg-current',
        estado === 'no_instalado' && 'rounded-full border-[1.5px] border-current opacity-60',
        className,
      )}
    />
  )
}

/** Nombre accesible de un equipo: el nombre primero y, para distinguir dos iguales, su código. */
function etiquetaEquipo(d: Dispositivo): string {
  const nombre = nombreEquipo(d)
  return nombre === d.id ? d.id : `${nombre} (${d.id})`
}

/** Todas las opciones de un equipo. Las mismas condiciones en la tarjeta y en cualquier ancho. */
function MenuEquipo({ d, a }: { d: Dispositivo; a: AccionesEquipo }) {
  const { t } = useTranslation()
  return (
    <MenuOpciones etiqueta={etiquetaEquipo(d)} tono="noche">
      <MenuItem onSelect={() => a.abrirFicha(d)}>
        <ScanLine aria-hidden />
        {t('dispositivos.fichaYSensores')}
      </MenuItem>
      <MenuItem onSelect={() => void a.abrirHistorial(d)}>
        <History aria-hidden />
        {t('dispositivos.historialConfiguracion')}
      </MenuItem>
      <MenuSeparator />
      <MenuItem onSelect={() => a.abrirCalibracion(d)}>
        <CalendarClock aria-hidden />
        {t('dispositivos.registrarCalibracion')}
      </MenuItem>
      <MenuItem onSelect={() => a.abrirInstalacion(d)}>
        <MapPin aria-hidden />
        {t('dispositivos.editarInstalacion')}
      </MenuItem>
      <MenuItem onSelect={() => a.abrirResponsable(d)}>
        <UserRound aria-hidden />
        {t('dispositivos.editarResponsable')}
      </MenuItem>
      <MenuSeparator />
      <MenuItem title={t('dispositivos.rotarCredencial')} disabled={!d.activo} onSelect={() => a.abrirCredencial(d, 'rotar')}>
        <KeyRound aria-hidden />
        {t('dispositivos.rotarCredencial')}
      </MenuItem>
      {d.broker_pendiente && (
        <MenuItem onSelect={() => a.abrirConfirmarBroker(d)}>
          <CircleCheck aria-hidden />
          {t('dispositivos.confirmarBroker')}
        </MenuItem>
      )}
      {d.posesion_pendiente && (
        <MenuItem title={t('dispositivos.reenviarDesafioAyuda')} disabled={a.enviando} onSelect={() => void a.enviarReenviarDesafio(d)}>
          <RefreshCw aria-hidden />
          {t('dispositivos.reenviarDesafio')}
        </MenuItem>
      )}
      {estadoCredencial(d) !== 'revocada' && (
        <MenuItem title={t('dispositivos.revocarCredencial')} className="text-critical" onSelect={() => a.abrirCredencial(d, 'revocar')}>
          <PowerOff aria-hidden />
          {t('dispositivos.revocarCredencial')}
        </MenuItem>
      )}
      {(MODO_DEMO || d.activo) && <MenuSeparator />}
      {MODO_DEMO && (
        <MenuItem onSelect={() => a.abrirSimulacion(d)}>
          <FlaskConical aria-hidden />
          {t('dispositivos.probarIoT')}
        </MenuItem>
      )}
      {d.activo && (
        <MenuItem className="text-critical" onSelect={() => a.abrirBaja(d)}>
          <PowerOff aria-hidden />
          {t('dispositivos.darDeBaja')}
        </MenuItem>
      )}
    </MenuOpciones>
  )
}

/**
 * Un equipo: su nombre, su estado en color y su calibración en palabras. Lo técnico (sensores,
 * firmware, buffer, credencial) está en la ficha, que nace de esta misma pieza (`layoutId`).
 */
export function PiezaEquipo({ d, a }: { d: Dispositivo; a: AccionesEquipo }) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const tono = tonoEquipo(d)
  const { principal, segundo } = useEstadoEquipo(d)
  const calibracion = useFraseCalibracion(d)
  const { tinta, suave } = CAMPO[tono]
  const nombre = nombreEquipo(d)
  // En la pieza, un pendiente técnico se dice en palabras; su explicación completa está en la ficha.
  const aviso = d.rotacion_por_compromiso ? 'retenida' : d.broker_pendiente || d.posesion_pendiente ? 'pendiente' : null
  // Lo de dentro también lleva `layout`: así, al volver de la ficha, el texto no se ve estirado.
  const interior = { layout: true, transition: reducir ? { duration: 0 } : MUELLE_FICHA } as const
  return (
    <motion.div
      layoutId={`equipo-${d.id}`}
      transition={reducir ? { duration: 0 } : MUELLE_FICHA}
      style={{ borderRadius: 14 }}
      role="row"
      data-tono={tono}
      className={cn(
        'group relative isolate flex min-h-[208px] min-w-0 flex-[1_1_21rem] flex-col overflow-hidden p-5 shadow-(--shadow-card) transition-[translate,scale] duration-(--duration-ui) ease-(--ease-out-soft) hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 sm:min-h-[224px] sm:p-6',
        tinta,
      )}
    >
      <CapasCampo tono={tono} />

      <motion.div {...interior} role="cell" className="min-w-0 pr-12">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[15px] leading-6 font-semibold">
          <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full bg-current', tono === 'enLinea' && 'punto-vivo')} />
          <span>{principal}</span>
          {segundo && <span className={cn('text-[13.5px] font-medium', suave)}>· <span>{segundo}</span></span>}
        </span>
        {aviso && (
          <span className="relative z-[2] mt-2.5 inline-flex max-w-full items-start gap-1.5 rounded-[12px] bg-capsula px-2.5 py-1.5 text-[12.5px] leading-4 font-medium text-white shadow-(--shadow-capsula)">
            <TriangleAlert aria-hidden className={cn('mt-px size-3.5 shrink-0', aviso === 'retenida' ? 'text-[#ff8a80]' : 'text-[#fdb022]')} />
            <span className="min-w-0">{t(`dispositivos.avisoPieza.${aviso}`)}</span>
          </span>
        )}
      </motion.div>

      {/* El nombre manda; dónde está y su código, en segundo plano. */}
      <motion.div {...interior} role="rowheader" className="mt-auto min-w-0 pt-6">
        <span className="block text-[clamp(1.625rem,7.5cqw,2.625rem)] leading-[1.04] font-semibold tracking-[-0.04em] [overflow-wrap:anywhere]">
          {nombre}
        </span>
        <span className={cn('nums mt-1.5 block text-[13.5px] leading-5 [overflow-wrap:anywhere]', suave)}>{datosSecundarios(d)}</span>
        <button
          type="button"
          aria-label={t('dispositivos.verFichaDe', { nombre })}
          onClick={() => a.abrirFicha(d)}
          className="absolute inset-0 z-[1] cursor-pointer rounded-(--radius-card) focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current"
        />
      </motion.div>

      <motion.div {...interior} role="cell" className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-current/15 pt-3.5">
        {calibracion.destacar ? (
          <span className="inline-flex min-h-7 items-center rounded-full bg-capsula px-3 text-[13.5px] font-semibold text-white shadow-(--shadow-capsula)">
            {calibracion.frase}
          </span>
        ) : (
          <span className="text-[15px] leading-6 font-semibold">{calibracion.frase}</span>
        )}
        <span aria-hidden className="inline-flex shrink-0 items-center gap-1 text-[13.5px] leading-5 font-semibold">
          {t('dispositivos.verFicha')}
          <ArrowRight className="size-4 transition-transform duration-(--duration-ui) ease-(--ease-out-soft) group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
        </span>
      </motion.div>

      <motion.div {...interior} role="cell" className="absolute right-3 top-3 z-[2] sm:right-4 sm:top-4">
        <MenuEquipo d={d} a={a} />
      </motion.div>
    </motion.div>
  )
}

/** Mientras llegan los equipos: piezas con la misma geometría, sin saltos al cargar. */
export function EsqueletoEquipos() {
  const { t } = useTranslation()
  return (
    <div role="status" className="animate-fade">
      <span className="sr-only">{t('app.cargando')}</span>
      <div aria-hidden className="flex flex-wrap gap-3 sm:gap-4">
        {[0, 1, 2].map((clave) => (
          <div key={clave} className="esqueleto min-h-[208px] flex-[1_1_21rem] rounded-(--radius-card) sm:min-h-[224px]" />
        ))}
      </div>
    </div>
  )
}
