import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Cpu, DoorClosed, DoorOpen, Droplets, ThermometerSun } from 'lucide-react'

import { useMonitoreoTermico } from '@/application/hooks/useMonitoreoTermico'
import { useSerieTermica } from '@/application/hooks/useSerieTermica'
import { brechasRecientes, CAPACIDAD_BUFFER_LITTLEFS, perdidasDeBrecha, type Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { duracionLegible, fechaHora, hora, localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { BadgeConectividad } from '../../../components/BadgeConectividad'
import { Cinta24h } from '../../../components/ui/cinta-24h'
import { EsqueletoTexto } from '../../../components/ui/esqueleto'
import { DECIMALES_HUMEDAD, ESPACIO_FINO, formatearCifra, formatearTemperatura } from '../../../components/ui/formato-cifra'
import { Regla } from '../../../components/ui/regla'
import { segmentarLecturas } from '../../../components/ui/segmentar-lecturas'
import { useMinuto } from '../../../hooks/useReloj'
import { CeldaCurva } from '../../dashboard/CeldaCurva'
import { claveBrecha, textosBrecha } from '../../dashboard/bufferNodo'
import { ActividadReciente } from '../ActividadReciente'
import { eventosRecientes } from '../actividad'
import { Dato, Tarjeta } from '../compartido'
import { useActividad } from '../contextoFlota'
import { TEXTO_EQUIPO, tonoDeEstado, type EstadoVisual, type LecturaBreve } from '../estadoEquipo'
import { AnilloBuffer } from '../lista/RailContexto'

const DIA_MS = 86_400_000
/** Cada tramo de la cinta de 24 h dura 30 min. */
const TRAMO_S = 30 * 60

/**
 * Monitoreo del equipo (SPEC P5b §6.3): lectura foco con condiciones, estado
 * del nodo, la curva térmica con su ventana 1 h / 24 h / 7 d y la actividad
 * del equipo (cinta 24 h, alertas e incidentes). La serie de 24 h es la misma
 * consulta del Dashboard (`useMonitoreoTermico` con `device_id`) y alimenta la
 * lectura, los extremos, la cinta y la curva por defecto.
 */
export function TabMonitoreo({ dispositivo, estado, ultima }: { dispositivo: Dispositivo; estado: EstadoVisual; ultima: LecturaBreve | undefined }) {
  const { t } = useTranslation()
  const dia = useMonitoreoTermico(24, dispositivo.id)
  const [horas, setHoras] = useState(24)
  // HU-31: la curva de 24 h cubre el periodo completo (serie agregada).
  const agregada24 = useSerieTermica(horas === 24 ? dispositivo.id : null, 24)
  const actividad = useActividad()
  const ahora = useMinuto()

  const ultimas24h = useMemo(() => {
    const desde = Date.now() - DIA_MS
    return dia.serie.filter((l) => Date.parse(l.timestamp) >= desde)
  }, [dia.serie])
  const segmentos = useMemo(() => {
    const tramos = segmentarLecturas(ultimas24h)
    // Sin datos ahora: el tramo en curso guarda la última lectura, pero el
    // equipo ya no reporta. Se marca como en la cinta de la lista, para que la
    // cinta no diga «las 24 h con datos» bajo «Sin datos desde…».
    if (estado !== 'sin_datos' || tramos.length === 0) return tramos
    const ultimo = tramos[tramos.length - 1]
    return [...tramos.slice(0, -1), { ...ultimo, tono: 'sin_datos' as const, minimo: null, maximo: null }]
  }, [ultimas24h, estado])
  const temperaturas = ultimas24h.map((l) => l.temperatura_interna).filter((v): v is number => typeof v === 'number')
  const minimo = temperaturas.length ? Math.min(...temperaturas) : null
  const maximo = temperaturas.length ? Math.max(...temperaturas) : null
  const actual = ultima?.temperatura ?? dia.ultima?.temperatura_interna ?? null
  const momento = ultima?.timestamp ?? dia.ultima?.timestamp ?? null
  const buffer = dispositivo.buffer_littlefs
  const numero = (n: number) => n.toLocaleString(localeActual())
  const eventos = useMemo(
    () => eventosRecientes(actividad.alertas, actividad.incidentes, ahora, { deviceId: dispositivo.id, limite: 6 }),
    [actividad.alertas, actividad.incidentes, ahora, dispositivo.id],
  )
  const fuera = segmentos.filter((s) => s.tono === 'critico' || s.tono === 'preventivo').length
  const sinDatos = segmentos.filter((s) => s.tono === 'sin_datos').length
  // Con una o dos filas, una caja de 360 px quedaba casi vacía: la columna toma
  // su alto natural y cierra con «Sin más actividad» y el enlace al historial.
  const pocaActividad = !actividad.cargando && !actividad.error && eventos.length <= 2

  return (
    <div className="grid grid-cols-12 gap-3 xl:gap-4">
      <section aria-labelledby="monitoreo-foco" className="superficie col-span-12 flex flex-col p-4 lg:col-span-7 xl:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="monitoreo-foco" className="eyebrow">{t('dispositivos.monitoreo.temperaturaInterna')}</h2>
          <span className={cn('text-meta font-medium', TEXTO_EQUIPO[estado])}>{t(`dispositivos.estadoEquipo.${estado}`)}</span>
        </div>
        {!dispositivo.activo && <p className="mt-2 text-meta text-muted">{t('dispositivos.detalle.fueraDeServicio')}</p>}
        {actual === null ? (
          <p className="mt-3 text-body text-muted">{t('dispositivos.estadoEquipo.esperando')}</p>
        ) : (
          <>
            <p className="mt-2 nums text-display text-foreground">
              {formatearCifra(actual)}
              <span className="text-title font-medium text-muted">{ESPACIO_FINO}°C</span>
            </p>
            <Regla tamano="xl" valor={actual} tono={tonoDeEstado(estado)} minimo={minimo} maximo={maximo} cotas className="mt-4" />
          </>
        )}
        <Condiciones lectura={dia.ultima} />
        <p className="mt-auto pt-4 nums text-meta text-faint">
          {momento ? t('dispositivos.lista.lecturaDe', { hora: fechaHora(momento) }) : '—'}
          {minimo !== null && maximo !== null &&
            ` · ${t('dispositivos.monitoreo.extremos24h', { min: formatearTemperatura(minimo), max: formatearTemperatura(maximo) })}`}
        </p>
      </section>

      <Tarjeta id="monitoreo-equipo" titulo={t('dispositivos.monitoreo.equipo')} icono={Cpu} className="col-span-12 lg:col-span-5">
        <dl className="grid grid-cols-2 gap-x-4">
          <Dato etiqueta={t('dispositivos.monitoreo.conexion')}>
            <BadgeConectividad estado={dispositivo.estado_conectividad} desde={dispositivo.conectividad_cambiada_en} />
          </Dato>
          <Dato etiqueta={t('dispositivos.estado')}>
            {dispositivo.estado_operativo ? t(`dispositivos.estadoOperativo.${dispositivo.estado_operativo}`) : '—'}
          </Dato>
          <Dato etiqueta={t('dispositivos.ultimoReporte')}>
            <span className="nums">{dispositivo.ultimo_reporte_en ? fechaHora(dispositivo.ultimo_reporte_en) : '—'}</span>
          </Dato>
          <Dato etiqueta={t('dispositivos.bufferLocal')}>
            <span className="flex items-center gap-2">
              <AnilloBuffer
                tamano={28}
                pendientes={buffer?.pendientes ?? 0}
                limite={buffer?.limite ?? CAPACIDAD_BUFFER_LITTLEFS}
                perdidas={buffer?.perdidas ?? 0}
              />
              <span className="nums">
                {numero(buffer?.pendientes ?? 0)} / {numero(buffer?.limite ?? CAPACIDAD_BUFFER_LITTLEFS)}
              </span>
            </span>
            <span className="block nums text-meta text-muted">{t('dispositivos.perdidas', { n: buffer?.perdidas ?? 0 })}</span>
          </Dato>
          {buffer?.desde && (
            <Dato etiqueta={t('dispositivos.periodoCola')} className="col-span-2">
              <span className="nums">
                {fechaHora(buffer.desde)} – {buffer.hasta ? fechaHora(buffer.hasta) : '—'}
                {buffer.rango_estimado && ` (${t('dashboard.rangoEstimado')})`}
              </span>
            </Dato>
          )}
          {(buffer?.brechas ?? []).length > 0 && (
            <Dato etiqueta={t('dispositivos.monitoreo.brechas')} className="col-span-2">
              {/* HU-48: la más reciente primero; sin hora del nodo, su secuencia. */}
              <ul className="space-y-0.5">
                {brechasRecientes(buffer).map((b, indice) => (
                  <li key={claveBrecha(b, indice)} className="nums text-meta">
                    {b.desde || b.hasta
                      ? t('dispositivos.monitoreo.brecha', { desde: fechaHora(b.desde), hasta: fechaHora(b.hasta), n: perdidasDeBrecha(b) })
                      : `${textosBrecha(b, t).resumen} · ${textosBrecha(b, t).periodo}`}
                    {b.abierta && (b.desde || b.hasta) && ` · ${t('dashboard.brechaEnCurso')}`}
                  </li>
                ))}
              </ul>
            </Dato>
          )}
          {(dispositivo.sensores ?? []).length > 0 && (
            <Dato etiqueta={t('dispositivos.sensores')} className="col-span-2">
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-meta">
                {(dispositivo.sensores ?? []).map((s) => (
                  <span key={s.modelo}>
                    {s.modelo} · <span className={s.estado === 'error' ? 'text-critical' : 'text-muted'}>{t(`dispositivos.sensorEstado.${s.estado}`)}</span>
                  </span>
                ))}
              </span>
            </Dato>
          )}
        </dl>
      </Tarjeta>

      {/* La celda de la curva del Dashboard ocupa una grilla de 4/8 columnas. */}
      <div className="col-span-12 grid min-w-0 grid-cols-4 sm:grid-cols-8 xl:col-span-8">
        {horas === 24 ? (
          <CeldaCurva
            serie={dia.serie}
            ultimaPresente={dia.ultima !== null}
            estadoHistorial={dia.estadoHistorial}
            reintentar={dia.reintentar}
            horasVentana={24}
            onCambiarVentana={setHoras}
            ventana={t('dashboard.ventanaFrase.24')}
            agregada={agregada24.serie}
            cobertura={dia.cobertura}
          />
        ) : (
          <CurvaOtraVentana deviceId={dispositivo.id} horas={horas} onCambiar={setHoras} />
        )}
      </div>

      {/* A ≥1280 la columna mide lo mismo que la curva (360 px): la actividad se desplaza dentro. */}
      <div
        className={cn(
          'col-span-12 grid min-w-0 content-start gap-3 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1 xl:gap-4',
          !pocaActividad && 'xl:h-[360px] xl:grid-rows-[auto_minmax(0,1fr)] xl:content-stretch',
        )}
      >
        <section aria-labelledby="monitoreo-24h" className="superficie min-w-0 p-4">
          <h2 id="monitoreo-24h" className="text-title text-foreground">{t('dispositivos.monitoreo.ultimas24h')}</h2>
          {dia.estadoHistorial === 'cargando' && dia.serie.length === 0 ? (
            <EsqueletoTexto lineas={2} className="mt-3" />
          ) : dia.estadoHistorial === 'error' && dia.serie.length === 0 ? (
            <p className="mt-2 text-meta text-muted">{t('dispositivos.monitoreo.cintaNoDisponible')}</p>
          ) : (
            <>
              <Cinta24h segmentos={segmentos} etiqueta={dispositivo.id} className="mt-3 h-5" />
              <div aria-hidden className="mt-1 flex justify-between text-micro text-faint">
                <span>−24 h</span>
                <span>−12</span>
                <span>{t('dispositivos.monitoreo.ahora')}</span>
              </div>
              <p className="mt-2 nums text-meta text-muted">
                {fuera === 0 && sinDatos === 0
                  ? t('dispositivos.monitoreo.resumen24hOk')
                  : [
                      fuera > 0 ? t('dispositivos.monitoreo.resumenRiesgo', { duracion: duracionLegible(fuera * TRAMO_S) }) : null,
                      sinDatos > 0 ? t('dispositivos.monitoreo.resumenSinDatos', { duracion: duracionLegible(sinDatos * TRAMO_S) }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </p>
            </>
          )}
        </section>
        <ActividadReciente
          id="monitoreo-actividad"
          titulo={t('dispositivos.actividad.tituloEquipo')}
          eventos={eventos}
          cargando={actividad.cargando}
          error={actividad.error}
          ahora={ahora}
          conEquipo={false}
          desplazable={!pocaActividad}
          className="xl:min-h-0"
          pie={
            pocaActividad && eventos.length > 0 ? (
              <>
                {t('dispositivos.actividad.sinMas')}
                {' · '}
                <Link
                  to={`/historial?device_id=${encodeURIComponent(dispositivo.id)}`}
                  className="font-medium text-primary-text underline-offset-2 hover:underline"
                >
                  {t('dispositivos.actividad.verHistorial')}
                </Link>
              </>
            ) : undefined
          }
        />
      </div>
    </div>
  )
}

/** Curva en 1 h o 7 d: su propia consulta, montada solo mientras se elige esa ventana. */
function CurvaOtraVentana({ deviceId, horas, onCambiar }: { deviceId: string; horas: number; onCambiar: (horas: number) => void }) {
  const { t } = useTranslation()
  const { ultima, serie, estadoHistorial, reintentar, cobertura } = useMonitoreoTermico(horas, deviceId)
  const agregada = useSerieTermica(deviceId, horas)
  return (
    <CeldaCurva
      serie={serie}
      ultimaPresente={ultima !== null}
      estadoHistorial={estadoHistorial}
      reintentar={reintentar}
      horasVentana={horas}
      onCambiarVentana={onCambiar}
      ventana={t(`dashboard.ventanaFrase.${horas}`)}
      agregada={agregada.serie}
      cobertura={cobertura}
    />
  )
}

/** Ambiente, humedad y puerta de la última lectura (sensores SHT31 y MC-38). */
function Condiciones({ lectura }: { lectura: LecturaTermica | null }) {
  const { t } = useTranslation()
  if (!lectura) return null
  const puerta = lectura.apertura_refrigerador
  const Puerta = puerta ? DoorOpen : DoorClosed
  const celdas = [
    {
      clave: 'ambiente',
      icono: ThermometerSun,
      etiqueta: t('dispositivos.monitoreo.ambiente'),
      valor: lectura.temperatura_ambiental != null ? formatearTemperatura(lectura.temperatura_ambiental) : '—',
      clase: 'text-foreground',
    },
    {
      clave: 'humedad',
      icono: Droplets,
      etiqueta: t('dispositivos.monitoreo.humedad'),
      valor: lectura.humedad_ambiental != null ? `${formatearCifra(lectura.humedad_ambiental, DECIMALES_HUMEDAD)}${ESPACIO_FINO}%` : '—',
      clase: 'text-foreground',
    },
    {
      clave: 'puerta',
      icono: Puerta,
      etiqueta: t('dispositivos.monitoreo.puerta'),
      valor:
        puerta == null ? t('dispositivos.monitoreo.puertaSinSensor') : puerta ? t('dispositivos.monitoreo.puertaAbierta') : t('dispositivos.monitoreo.puertaCerrada'),
      clase: puerta ? 'text-warning-700' : puerta == null ? 'text-muted' : 'text-foreground',
    },
  ]
  return (
    <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-(--radius-field) border border-border">
      {celdas.map(({ clave, icono: Icono, etiqueta, valor, clase }) => (
        <div key={clave} className="min-w-0 px-3 py-2">
          <dt className="flex items-center gap-1.5 text-meta text-muted">
            <Icono aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{etiqueta}</span>
          </dt>
          <dd className={cn('mt-0.5 truncate nums text-body font-semibold', clase)} title={`${etiqueta}: ${valor} · ${hora(lectura.timestamp)}`}>
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  )
}
