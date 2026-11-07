import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ArrowRight, Check, CheckCheck, CircleDot, ClipboardPen, MailWarning } from 'lucide-react'

import type { ResultadoRectificacion } from '@/application/hooks/useAlertas'
import {
  estadoNotificacion,
  type AccionCorrectiva,
  type AlertaTermica,
  type EstadoNotificacion,
} from '@/domain/entities/AlertaTermica'
import type { EstadoAlerta } from '@/domain/value-objects/EstadoAlerta'
import { duracionBreve, fechaHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Detalles } from '../../components/ui/detalles'
import { Indicador, Indicadores } from '../../components/ui/indicadores'
import { NumeroAnimado } from '../../components/ui/numero-animado'
import { accionesDisponibles, TINTA_POR_NIVEL, temperaturaDeAlerta } from './bandeja'
import { Cronologia } from './Cronologia'
import { HaceCuanto, PlacaAviso } from './FilaAviso'

const ICONO_ESTADO: Record<EstadoAlerta, typeof Check> = {
  pendiente: CircleDot,
  reconocida: Check,
  atendida: CheckCheck,
}

const VARIANTE_NOTIFICACION: Record<EstadoNotificacion, 'ok' | 'warn' | 'critical' | 'outline'> = {
  notificada: 'ok',
  reintentando: 'warn',
  no_entregada: 'critical',
  pendiente: 'outline',
}

/** «2–8 °C» no se parte al final de una línea. */
const sinCortarRango = (mensaje: string) => mensaje.replace(/(\d)([–-])(\d)/g, '$1⁠$2⁠$3')

/**
 * El aviso abierto, en grande: equipo, hace cuánto, la cifra y su nivel. Su placa de color es la
 * misma de la fila (`morfar`): la fila crece hasta ser este detalle.
 */
export function CampoAviso({ alerta, nombre, morfar = false }: { alerta: AlertaTermica; nombre: string; morfar?: boolean }) {
  const { t } = useTranslation()
  const temperatura = temperaturaDeAlerta(alerta)
  const nivel = alerta.nivel_riesgo
  const atendida = alerta.estado === 'atendida'
  const IconoEstado = ICONO_ESTADO[alerta.estado]

  return (
    <header aria-live="polite" aria-atomic="true" className={cn('campo-aviso', atendida ? 'text-campo-sin-datos-tinta' : TINTA_POR_NIVEL[nivel])}>
      {/* Una placa por aviso: cambiar el `layoutId` de una pieza montada la dejaría proyectada sobre la fila. */}
      <PlacaAviso key={`placa-${alerta.id}`} alerta={alerta} morfar={morfar} radio={16} />
      {/* El contenido se funde cuando la placa ya llegó: nunca texto claro sobre blanco. */}
      <div key={`contenido-${alerta.id}`} className="campo-aviso__contenido">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pr-12">
          <p className="min-w-0 text-[19px] leading-6 font-semibold tracking-[-0.015em] text-balance">
            {nombre}
            {nombre !== alerta.device_id && <>{' '}<span className="sr-only">{alerta.device_id}</span></>}
          </p>
          <HaceCuanto marca={alerta.created_at} className="nums text-[14px] leading-5 font-medium" />
        </div>
        <div className="campo-aviso__fila">
          {temperatura != null ? (
            <p className="campo-aviso__cifra nums">
              <NumeroAnimado valor={temperatura.toFixed(1)} />
              <span className="campo-aviso__unidad">°C</span>
            </p>
          ) : (
            <p className="campo-aviso__sin-cifra">{t(`riesgo.${nivel}`)}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {temperatura != null && (
              <p className="text-[19px] leading-6 font-semibold tracking-[-0.015em]">
                {t(`riesgo.${nivel}`)}
                <span className="sr-only"> — {t(`riesgo.detalle.${nivel}`)}</span>
              </p>
            )}
            <span className="campo-aviso__estado">
              <IconoEstado aria-hidden className="size-3.5" />
              {t(`alertas.estadoAlerta.${alerta.estado}`)}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

/** Estado del correo de una alerta crítica: solo lo que el backend registró. */
function NotificacionAviso({ alerta, estado }: { alerta: AlertaTermica; estado: EstadoNotificacion }) {
  const { t } = useTranslation()
  return (
    <p className="flex flex-wrap items-center gap-2 text-[13px] leading-5 text-muted">
      <Badge variant={VARIANTE_NOTIFICACION[estado]}>{t(`alertas.notificacion.${estado}`)}</Badge>
      <span className="min-w-0 flex-1 basis-48">
        {t(`alertas.notificacion.${estado}Ayuda`, {
          fecha: fechaHora(alerta.notificada_en),
          intentos: alerta.notificacion_intentos ?? 0,
        })}
      </span>
    </p>
  )
}

/** Evidencia de la excursión: solo lo que el backend registró, sin inventar. */
function EvidenciaAviso({ alerta, notificacion }: { alerta: AlertaTermica; notificacion: EstadoNotificacion | null }) {
  const { t } = useTranslation()
  const cifras = alerta.temperatura_pico != null || alerta.duracion_s != null
  return (
    <div className="grid gap-3">
      <p className="text-[15px] leading-[22px] text-pretty text-foreground">{sinCortarRango(alerta.mensaje)}</p>
      {cifras && (
        <Indicadores>
          {alerta.temperatura_pico != null && (
            <Indicador etiqueta={t('alertas.pico')} valor={alerta.temperatura_pico.toFixed(2)} unidad="°C" />
          )}
          {alerta.duracion_s != null && <Indicador etiqueta={t('alertas.duracion')} valor={duracionBreve(alerta.duracion_s)} />}
        </Indicadores>
      )}
      {alerta.iniciada_en && (
        <p className="text-[13.5px] leading-5 text-muted">
          {t('alertas.inicioExcursion')}: <span className="nums font-medium text-foreground">{fechaHora(alerta.iniciada_en)}</span>
        </p>
      )}
      {alerta.historica && (
        <p className="flex flex-wrap items-center gap-2 text-[13px] leading-5 text-muted">
          <Badge variant="warn">{t('alertas.historica')}</Badge>
          <span className="min-w-0 flex-1 basis-48">{t('alertas.historicaAyuda')}</span>
        </p>
      )}
      {notificacion !== null && notificacion !== 'no_entregada' && <NotificacionAviso alerta={alerta} estado={notificacion} />}
      <p className="text-[13px] leading-5 text-muted">
        {t('dashboard.codigoEquipo')}: <span className="nums font-medium text-foreground">{alerta.device_id}</span>
        {alerta.created_at && (
          <>
            {' · '}
            <time dateTime={alerta.created_at} className="nums">{fechaHora(alerta.created_at)}</time>
          </>
        )}
      </p>
    </div>
  )
}

function Paso({ numero, titulo, children }: { numero: number; titulo: ReactNode; children: ReactNode }) {
  return (
    <li className="paso-aviso">
      <span aria-hidden className="paso-aviso__numero nums">{numero}</span>
      <span className="min-w-0">
        <span className="block text-[15px] leading-[21px] font-semibold text-foreground">{titulo}</span>
        <span className="block text-[14px] leading-5 text-muted">{children}</span>
      </span>
    </li>
  )
}

/**
 * «Qué hacer», en el orden en que se hace. Cada rol lee lo que le toca: el técnico no ve «márcala
 * como revisada» y el auditor, que solo consulta, no ve pasos.
 */
function QueHacer({ alerta, puedeReconocer, puedeRegistrar }: { alerta: AlertaTermica; puedeReconocer: boolean; puedeRegistrar: boolean }) {
  const { t } = useTranslation()
  const { reconocer, registrar } = accionesDisponibles(alerta, puedeReconocer, puedeRegistrar)
  const id = `que-hacer-${alerta.id}`

  let contenido: ReactNode
  if (alerta.estado === 'atendida') {
    contenido = <p className="que-hacer__nota">{t('alertas.yaAtendida')}</p>
  } else if (!reconocer && !registrar) {
    contenido = <p className="que-hacer__nota">{t('alertas.soloConsulta')}</p>
  } else if (alerta.estado === 'reconocida') {
    contenido = (
      <>
        <p className="que-hacer__nota">{t('alertas.yaRevisada')}</p>
        <ol className="pasos-aviso">
          <Paso numero={1} titulo={t('alertas.pasoConstanciaTitulo')}>{t('alertas.pasoConstanciaAnotar')}</Paso>
        </ol>
      </>
    )
  } else {
    contenido = (
      <ol className="pasos-aviso">
        <Paso
          numero={1}
          titulo={
            <Link to="/dashboard" className="paso-aviso__enlace">
              {t('alertas.pasoMirarTitulo')}
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          }
        >
          {t('alertas.pasoMirarDetalle')}
        </Paso>
        <Paso numero={2} titulo={alerta.nivel_riesgo === 'excursion_critica' ? t('alertas.pasoProtegerTitulo') : t('alertas.pasoRevisarEquipoTitulo')}>
          {t('alertas.pasoProtegerDetalle')}
        </Paso>
        <Paso numero={3} titulo={t('alertas.pasoConstanciaTitulo')}>
          {reconocer ? t('alertas.pasoConstanciaRevisar') : t('alertas.pasoConstanciaAnotar')}
        </Paso>
      </ol>
    )
  }

  return (
    <section aria-labelledby={id} className="que-hacer">
      <h3 id={id} className="que-hacer__titulo">{t('alertas.queHacer')}</h3>
      {contenido}
    </section>
  )
}

/**
 * Lo que va debajo del campo: primero «Qué hacer» y, si el correo no llegó, ese aviso; después,
 * tras «Ver más», el mensaje, la evidencia y la cronología. Se monta por aviso y estado: lo cargado
 * empieza de cero y una acción nueva aparece en la cronología.
 */
export function CuerpoAviso({
  alerta,
  conflicto,
  obtenerCicloAtencion,
  rectificarAccion,
  puedeRectificar,
  puedeReconocer,
  puedeRegistrar,
}: {
  alerta: AlertaTermica
  /** HU-27 Escenario 2: otra persona lo cambió entre la carga de la lista y este clic. */
  conflicto: boolean
  obtenerCicloAtencion: (alertaId: string) => Promise<AccionCorrectiva[]>
  rectificarAccion: (accionId: string, descripcion: string, motivo: string) => Promise<ResultadoRectificacion>
  puedeRectificar: (accion: AccionCorrectiva) => boolean
  puedeReconocer: boolean
  puedeRegistrar: boolean
}) {
  const { t } = useTranslation()
  const notificacion = estadoNotificacion(alerta)
  const { reconocer, registrar } = accionesDisponibles(alerta, puedeReconocer, puedeRegistrar)
  // Quien solo consulta, o una alerta ya atendida, viene a leer lo que pasó: «Ver más» abre solo.
  const paraLeer = alerta.estado === 'atendida' || (!reconocer && !registrar)

  return (
    <div className="cuerpo-aviso animate-fade">
      {conflicto && (
        <p role="alert" className="rounded-(--radius-field) bg-critical-tint px-3 py-2 text-[13.5px] leading-5 font-medium text-critical">
          {t('alertas.conflictoEstado')}
        </p>
      )}
      <QueHacer alerta={alerta} puedeReconocer={puedeReconocer} puedeRegistrar={puedeRegistrar} />
      {notificacion === 'no_entregada' && (
        // Nadie recibió el correo: eso cambia lo que hay que hacer, no va plegado.
        <div className="aviso-correo">
          <MailWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
          <NotificacionAviso alerta={alerta} estado={notificacion} />
        </div>
      )}
      <Detalles className="cuerpo-aviso__mas" abiertoInicial={paraLeer} titulo={t('comunes.verMas')}>
        <div className="grid gap-6 pb-1">
          <EvidenciaAviso alerta={alerta} notificacion={notificacion} />
          <Cronologia
            alerta={alerta}
            obtenerCicloAtencion={obtenerCicloAtencion}
            rectificarAccion={rectificarAccion}
            puedeRectificar={puedeRectificar}
          />
          <Link
            to="/historial"
            className="justify-self-start text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            {t('nav.historial')}
          </Link>
        </div>
      </Detalles>
    </div>
  )
}

export function AccionesAviso({
  alerta,
  puedeReconocer,
  puedeRegistrar,
  reconociendo,
  onReconocer,
  onRegistrar,
}: {
  alerta: AlertaTermica
  puedeReconocer: boolean
  puedeRegistrar: boolean
  reconociendo: boolean
  onReconocer: () => void
  onRegistrar: () => void
}) {
  const { t } = useTranslation()
  const { reconocer, registrar } = accionesDisponibles(alerta, puedeReconocer, puedeRegistrar)
  return (
    <>
      {reconocer && (
        <Button size="lg" onClick={onReconocer} cargando={reconociendo}>
          {!reconociendo && <CheckCheck />}
          {t('alertas.marcarRevisada')}
        </Button>
      )}
      {registrar && (
        <Button size="lg" variant={reconocer ? 'secondary' : 'primary'} onClick={onRegistrar} title={t('alertas.registrarAccion')}>
          <ClipboardPen />
          {t('alertas.accionCorrectiva')}
        </Button>
      )}
    </>
  )
}
