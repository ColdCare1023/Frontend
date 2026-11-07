import { memo, Suspense, useEffect, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ArrowDownRight, ArrowUpRight, ShieldQuestion } from 'lucide-react'

import { umbralSilencioSegundos, type Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { adorno } from '@/lib/adorno'
import { duracionBreve, hora as formatearHora, localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Detalles } from '@/presentation/components/ui/detalles'
import { NumeroAnimado } from '@/presentation/components/ui/numero-animado'
import { BandaRango, CapasColor } from './CapasColor'
import {
  causaDelEquipo,
  estadoPuerta,
  fallaSensor,
  puertaProlongada,
  tonoDe,
  varianteDe,
  type EstadoPanel,
  type EstadoPuerta,
  type ResumenEquipo,
} from './estadoEquipo'
import { segundosDesde, segundosRedondeados, tiempoBreve, useDelReloj } from './reloj'
import './monitoreo.css'

const VialEquipo = adorno(() => import('../../efectos/tresd/VialEquipo').then((m) => m.VialEquipo))

/** Un dato de «Ver más»: nombre pequeño y valor. */
function Dato({ etiqueta, ancho = false, children }: { etiqueta: string; ancho?: boolean; children: ReactNode }) {
  return (
    <div className={cn('campo__dato', ancho && 'campo__dato--ancho')}>
      <dt>{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function ValorMetrica({
  lectura,
  campo,
  decimales,
  unidad,
}: {
  lectura: LecturaTermica
  campo: 'temperatura_ambiental' | 'humedad_ambiental'
  decimales: number
  unidad: string
}) {
  const { t } = useTranslation()
  const valor = lectura[campo]
  // HU-33 criterio 3: un sensor que falló no se confunde con «aún no llegó».
  if (fallaSensor(lectura, campo)) return <span role="alert">{t('dashboard.fallaSensor')}</span>
  if (valor == null) return <span role="status">{t('dashboard.sinLecturaDisponible')}</span>
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <NumeroAnimado valor={valor.toFixed(decimales)} />
      <span className="campo__dato-unidad">{unidad}</span>
    </span>
  )
}

/** HU-35: la puerta, con lo que lleva abierta. Abierta y con dato fresco se ve sin abrir «Ver más». */
function ValorPuerta({ ultima, puerta, desactualizado }: { ultima: LecturaTermica; puerta: EstadoPuerta; desactualizado: boolean }) {
  const { t } = useTranslation()
  // Mientras el dato es fresco, el contador sigue avanzando entre lecturas: solo aquí corre el reloj.
  const contando = puerta.abiertaAhora && puerta.continua != null && !desactualizado
  const transcurrido = useDelReloj((ahora) => (contando ? segundosDesde(ultima.timestamp, ahora) : 0))
  const enCurso = puerta.abiertaAhora && puerta.continua != null ? puerta.continua + transcurrido : null
  const prolongada = puertaProlongada(puerta, transcurrido)

  return (
    <div role={prolongada ? 'alert' : undefined} data-testid={puerta.abiertaAhora ? 'puerta-advertencia' : undefined}>
      {puerta.sinDato ? t('dashboard.puertaSinDato') : puerta.abiertaAhora ? t('dashboard.puertaAbierta') : t('dashboard.puertaCerrada')}
      {enCurso != null && (
        <span className="nums campo__dato-extra">
          · {t('dashboard.puertaDesdeHace', { duracion: duracionBreve(enCurso) })}
          {prolongada && <span className="sr-only"> — {t('dashboard.puertaProlongada')}</span>}
        </span>
      )}
      {!puerta.conContinua && puerta.abiertaAhora && puerta.duracionVentana != null && (
        <span className="nums campo__dato-extra">
          · {duracionBreve(puerta.duracionVentana)}
          {prolongada && <span className="sr-only"> — {t('dashboard.puertaProlongada')}</span>}
        </span>
      )}
      {puerta.huboCerrada && puerta.duracionVentana != null && (
        <span className="campo__dato-nota">{t('dashboard.puertaHuboApertura', { segundos: puerta.duracionVentana })}</span>
      )}
      {prolongada && <span className="campo__dato-nota campo__dato-nota--fuerte">{t('dashboard.puertaSuperaUmbral', { segundos: puerta.umbral })}</span>}
    </div>
  )
}

/** HU-13: estado del NODO (LWT/online/telemetría), no el campo de la lectura, que siempre se envió conectada. */
function ValorConexion({ estado, desde, testId }: { estado: string; desde?: string | null; testId?: string }) {
  const { t } = useTranslation()
  return (
    <span data-testid={testId}>
      {estado === 'online'
        ? t('dashboard.dispositivoOnline')
        : desde
          ? t('dashboard.nodoSinConexionDesde', { hora: formatearHora(desde) })
          : t('dashboard.dispositivoOffline')}
    </span>
  )
}

/** «Hace 4 s»: lo único del campo que cambia cada segundo. */
function Frescura({ marca }: { marca: string }) {
  const { t } = useTranslation()
  const segundos = useDelReloj((ahora) => segundosDesde(marca, ahora))
  return (
    <p className="campo__frescura">
      <span className="punto-vivo" aria-hidden />
      {t('dashboard.lecturaReciente', { s: segundos })}
    </p>
  )
}

/** Sin dato nuevo, eso es lo primero que hay que leer: pasa a ser la palabra grande del campo. */
function Silencio({ marca }: { marca: string }) {
  const { t } = useTranslation()
  const segundos = useDelReloj((ahora) => segundosRedondeados(segundosDesde(marca, ahora)))
  return <p className="campo__palabra">{t('dashboard.sinLecturaHace', { tiempo: tiempoBreve(segundos, localeActual()) })}</p>
}

/** Si la puerta lleva abierta de más con el dato fresco, la causa del equipo lo dice; el campo solo lo cuenta. */
function usePuertaProlongada(ultima: LecturaTermica | null, puerta: EstadoPuerta | null, desactualizado: boolean): boolean {
  const vigilar = !!ultima && !!puerta && puerta.abiertaAhora && !desactualizado
  return useDelReloj((ahora) => (vigilar ? puertaProlongada(puerta!, segundosDesde(ultima!.timestamp, ahora)) : false))
}

/**
 * Un equipo es un campo de color enorme (Acta N.° 05, acuerdo 6): el nombre, la cifra y una palabra.
 * Lo que ayuda a decidir ahora (puerta abierta, equipo sin conexión) va en una línea discreta; el
 * resto queda en «Ver más», sin borrarse. El campo cuenta su estado hacia arriba (`onResumen`) para
 * que la frase de Inicio salga de lo mismo que se pinta.
 */
export const CampoEquipo = memo(function CampoEquipo({
  ultima,
  previa,
  equipo,
  seleccionado,
  variosEquipos,
  onSeleccionar,
  onResumen,
  esperando = false,
}: {
  ultima: LecturaTermica | null
  previa: LecturaTermica | null
  equipo?: Dispositivo
  seleccionado: boolean
  variosEquipos: boolean
  onSeleccionar?: () => void
  onResumen?: (resumen: ResumenEquipo) => void
  /** Su primera lectura todavía viene en camino: el campo espera en reposo, sin decir nada. */
  esperando?: boolean
}) {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const conVial = !reducir && import.meta.env.MODE !== 'test' && typeof IntersectionObserver !== 'undefined'
  // HU-33 criterio 2 / B-17: el dato se marca desactualizado al superar el umbral SIN_DATOS del propio nodo.
  const umbral = umbralSilencioSegundos(equipo)
  const marca = ultima?.timestamp
  const enSilencio = useDelReloj((ahora) => (marca ? segundosDesde(marca, ahora) >= umbral : false))
  const desactualizado = equipo?.estado_operativo === 'SIN_DATOS' || enSilencio
  const riesgo = ultima?.riesgo_efectivo ?? null
  const estado: EstadoPanel = !ultima || desactualizado
    ? 'sinDatos'
    : riesgo === 'excursion_critica'
      ? 'critico'
      : riesgo === 'riesgo_preventivo'
        ? 'aviso'
        : 'normal'
  const lectura = ultima?.temperatura_interna ?? null
  const lecturaFinita = lectura != null && Number.isFinite(lectura)
  const fueraDeEscala = lecturaFinita && (lectura < 0 || lectura > 10)
  const sensorFallido = ultima ? fallaSensor(ultima, 'temperatura_interna') : false
  const nombre = equipo?.nombre || ultima?.device_id || equipo?.id || t('dashboard.dispositivo')
  const codigo = ultima?.device_id ?? equipo?.id
  const delta = ultima?.temperatura_ambiental != null && previa?.temperatura_ambiental != null
    ? ultima.temperatura_ambiental - previa.temperatura_ambiental
    : null
  const idTitulo = `equipo-${codigo ?? 'unico'}-titulo`
  const variante = varianteDe(ultima?.device_id ?? equipo?.id)
  const textoLectura = lecturaFinita ? lectura.toFixed(1) : null
  const tono = tonoDe(estado, sensorFallido ? null : lectura)
  const puerta = ultima ? estadoPuerta(ultima) : null
  const conectividad = equipo?.estado_conectividad ?? ultima?.estado_conectividad ?? 'offline'
  // A la vista solo lo que ayuda a decidir: una puerta abierta con dato fresco y un equipo sin conexión.
  const puertaALaVista = !!puerta && puerta.abiertaAhora && !desactualizado
  const conexionALaVista = conectividad !== 'online'
  const estadoOperativoALaVista = equipo?.estado_operativo === 'FALLA_SENSOR' || equipo?.estado_operativo === 'MONITOREO_SUSPENDIDO'

  const prolongada = usePuertaProlongada(ultima, puerta, desactualizado)
  const causa = esperando ? null : causaDelEquipo({ ultima, equipo, desactualizado, sensorFallido, puertaProlongada: prolongada })
  const id = equipo?.id ?? ultima?.device_id ?? null
  const temperaturaCitada = causa === 'critico' || causa === 'preventivo' ? lectura : null
  const marcaSilencio = causa === 'silencio' ? (ultima?.timestamp ?? equipo?.ultimo_reporte_en ?? null) : null
  useEffect(() => {
    if (onResumen && id && causa) onResumen({ id, nombre, causa, temperatura: temperaturaCitada, marca: marcaSilencio })
  }, [onResumen, id, nombre, causa, temperaturaCitada, marcaSilencio])

  const cabecera = (
    <>
      <span className="campo__nombre">{nombre}</span>
      {/* El código no se lee de primeras, pero el lector de pantalla y la búsqueda lo encuentran. */}
      {codigo && nombre !== codigo && <>{' '}<span className="sr-only">{codigo}</span></>}
    </>
  )

  return (
    <section
      aria-labelledby={idTitulo}
      data-estado={estado}
      data-tono={tono}
      data-elegible={variosEquipos && !seleccionado ? '' : undefined}
      className={cn('panel-equipo campo', esperando && 'campo--reposo')}
      onClick={variosEquipos && !seleccionado ? onSeleccionar : undefined}
    >
      <CapasColor tono={tono} />
      {conVial && (
        <Suspense fallback={null}>
          <VialEquipo
            fase={variante === 'vacuna' ? 0 : 2}
            variante={variante}
            temperatura={sensorFallido || !lecturaFinita || desactualizado ? null : lectura}
            className="campo__vial"
          />
        </Suspense>
      )}
      {variosEquipos && seleccionado && (
        <motion.span
          layoutId="equipo-activo"
          aria-hidden
          transition={reducir ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }}
          className="campo__elegido"
        />
      )}

      <div className="campo__cabeza">
        <h2 id={idTitulo} className="min-w-0">
          {variosEquipos ? (
            <button type="button" aria-pressed={seleccionado} onClick={onSeleccionar} className="campo__boton-nombre">
              {cabecera}
            </button>
          ) : cabecera}
        </h2>
        {ultima && !desactualizado && <Frescura marca={ultima.timestamp} />}
      </div>

      <div className="campo__cuerpo">
        {esperando ? (
          <>
            <span className="sr-only" role="status">{t('app.cargando')}</span>
            <span aria-hidden className="campo__reposo-cifra" />
            <span aria-hidden className="campo__reposo-linea mt-4" style={{ width: '24%' }} />
          </>
        ) : !ultima ? (
          <p role="status" className="campo__mensaje">{t('dashboard.esperandoDatos')}</p>
        ) : sensorFallido || lectura == null ? (
          <p role={sensorFallido ? 'alert' : 'status'} className="campo__mensaje">
            {sensorFallido ? t('dashboard.fallaSensor') : t('dashboard.sinLecturaDisponible')}
          </p>
        ) : (
          <p
            className={cn('campo__cifra', desactualizado && 'campo__cifra--vieja')}
            style={{ '--cifra-largo': (textoLectura ?? String(lectura)).length } as React.CSSProperties}
          >
            <NumeroAnimado valor={textoLectura ?? String(lectura)} />
            <span className="campo__unidad">°C</span>
          </p>
        )}

        {ultima && desactualizado && <Silencio marca={ultima.timestamp} />}
        {riesgo && !desactualizado && (
          <p className="campo__palabra">
            {t(`riesgo.${riesgo}`)}
            <span className="sr-only"> — {t(`riesgo.detalle.${riesgo}`)}</span>
          </p>
        )}
        {/* Con el dato viejo el riesgo es el de la última lectura, no el de ahora. */}
        {riesgo && desactualizado && <p className="campo__palabra-previa">{t('dashboard.ultimaLecturaFue', { nivel: t(`riesgo.${riesgo}`) })}</p>}
        {ultima && !riesgo && !sensorFallido && <p className="campo__palabra-previa">{t('dashboard.sinClasificacion')}</p>}

        {/* Lo que cambia la decisión de ahora, en una línea. */}
        {!esperando && (
        <div className="campo__lineas empty:hidden">
          {ultima && puertaALaVista && puerta && (
            <div className="campo__linea">
              <span className="campo__linea-etiqueta">{t('dashboard.puerta')}</span>
              <ValorPuerta ultima={ultima} puerta={puerta} desactualizado={desactualizado} />
            </div>
          )}
          {conexionALaVista && (
            <div className="campo__linea">
              <ValorConexion estado={conectividad} desde={equipo?.conectividad_cambiada_en} testId={seleccionado ? 'conectividad-dispositivo' : undefined} />
            </div>
          )}
          {estadoOperativoALaVista && equipo?.estado_operativo && (
            <div className="campo__linea">{t(`dispositivos.estadoOperativo.${equipo.estado_operativo}`)}</div>
          )}
          {ultima && !ultima.excursion_confirmada && ultima.nivel_riesgo === 'excursion_critica' && riesgo !== 'excursion_critica' && (
            <p className="campo__linea">
              <ShieldQuestion className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t('dashboard.clasificacionIaDivergente')}
            </p>
          )}
          {ultima?.ia_experimental && !ultima.excursion_confirmada && (
            // HU-20 / B-1: advertencia honesta, en corto; el detalle queda en «Ver más».
            <p className="campo__linea">{t('dashboard.iaExperimental')}</p>
          )}
        </div>
        )}

        {(ultima || equipo) && !esperando && (
          // Abrir «Ver más» no elige el equipo.
          <div className="campo__mas" onClick={(evento) => evento.stopPropagation()}>
            <Detalles titulo={<>{t('comunes.verMas')}<span className="sr-only"> · {nombre}</span></>}>
              <dl className="campo__datos">
                {codigo && nombre !== codigo && <Dato etiqueta={t('dashboard.codigoEquipo')}><span className="nums">{codigo}</span></Dato>}
                {ultima && puerta && !puertaALaVista && (
                  <Dato etiqueta={t('dashboard.puerta')} ancho={puerta.abiertaAhora || puerta.huboCerrada}>
                    <ValorPuerta ultima={ultima} puerta={puerta} desactualizado={desactualizado} />
                  </Dato>
                )}
                {ultima && (
                  <Dato etiqueta={t('dashboard.ambienteCorto')}>
                    <ValorMetrica lectura={ultima} campo="temperatura_ambiental" decimales={1} unidad="°C" />
                    {delta != null && Math.abs(delta) >= 0.05 && (
                      <span className="nums campo__dato-extra inline-flex items-center gap-0.5">
                        {delta > 0 ? <ArrowUpRight aria-hidden className="size-3" /> : <ArrowDownRight aria-hidden className="size-3" />}
                        {Math.abs(delta).toFixed(1)}
                        <span className="sr-only"> °C. {t('dashboard.variacionVsAnterior')}</span>
                      </span>
                    )}
                  </Dato>
                )}
                {ultima && (
                  <Dato etiqueta={t('dashboard.humedad')}>
                    <ValorMetrica lectura={ultima} campo="humedad_ambiental" decimales={0} unidad="%" />
                  </Dato>
                )}
                {!conexionALaVista && (
                  <Dato etiqueta={t('dashboard.conexionEquipo')}>
                    <ValorConexion estado={conectividad} testId={seleccionado ? 'conectividad-dispositivo' : undefined} />
                  </Dato>
                )}
                {ultima && (
                  <Dato etiqueta={t('dashboard.ultimaLecturaHora')}>
                    <time dateTime={ultima.timestamp} className="nums">{formatearHora(ultima.timestamp)}</time>
                  </Dato>
                )}
              </dl>
              <div className="campo__notas empty:hidden">
                {ultima?.excursion_confirmada && <p className="font-semibold">{t('dashboard.excursionConfirmada')}</p>}
                {ultima && riesgo === 'normal' && !ultima.ia_experimental && !ultima.excursion_confirmada && ultima.nivel_riesgo === null && (
                  // Sin clase del modelo (omitida, fallida o sin modelo): «Normal» lo dice solo la regla 2-8 °C.
                  <p>
                    <strong className="font-semibold">{t('dashboard.sinClasificacionIa')}</strong> {t('dashboard.sinClasificacionIaDetalle')}
                  </p>
                )}
                {ultima?.ia_experimental && !ultima.excursion_confirmada && <p>{t('dashboard.iaExperimentalDetalle')}</p>}
                {fueraDeEscala && lectura != null && (
                  <p role="note">
                    {lectura > 10
                      ? t('dashboard.lecturaSobreEscala', { temperatura: lectura.toFixed(1) })
                      : t('dashboard.lecturaBajoEscala', { temperatura: lectura.toFixed(1) })}
                  </p>
                )}
              </div>
            </Detalles>
          </div>
        )}
      </div>

      <BandaRango valor={sensorFallido ? null : lectura} title={t('guia.rangoNota')} />
    </section>
  )
})
