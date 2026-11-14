import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Cpu } from 'lucide-react'

import { CAPACIDAD_BUFFER_LITTLEFS, type Dispositivo } from '@/domain/entities/Dispositivo'
import { fechaHora } from '@/lib/formato'
import { BadgeConectividad } from '../../../components/BadgeConectividad'
import { Cinta24h } from '../../../components/ui/cinta-24h'
import { EsqueletoTexto } from '../../../components/ui/esqueleto'
import { formatearTemperatura } from '../../../components/ui/formato-cifra'
import { Regla } from '../../../components/ui/regla'
import { segmentarLecturas } from '../../../components/ui/segmentar-lecturas'
import { Dato, Tarjeta } from '../compartido'
import { tonoDeEstado, type EstadoVisual, type LecturaBreve } from '../estadoEquipo'
import { AnilloBuffer } from '../lista/RailContexto'
import { useLecturasEquipo } from './datosEquipo'

/** Monitoreo del equipo: lectura foco, cinta 24 h y estado del nodo (HU-48/54). */
export function TabMonitoreo({ dispositivo, estado, ultima }: { dispositivo: Dispositivo; estado: EstadoVisual; ultima: LecturaBreve | undefined }) {
  const { t } = useTranslation()
  const { lecturas, cargando, error } = useLecturasEquipo(dispositivo.id)
  const segmentos = useMemo(() => segmentarLecturas(lecturas), [lecturas])
  const temperaturas = lecturas
    .filter((l) => Date.parse(l.timestamp) >= Date.now() - 86_400_000)
    .map((l) => l.temperatura_interna)
    .filter((v): v is number => typeof v === 'number')
  const minimo = temperaturas.length ? Math.min(...temperaturas) : null
  const maximo = temperaturas.length ? Math.max(...temperaturas) : null
  const actual = ultima?.temperatura ?? lecturas[0]?.temperatura_interna ?? null
  const momento = ultima?.timestamp ?? lecturas[0]?.timestamp ?? null
  const buffer = dispositivo.buffer_littlefs

  return (
    <div className="grid grid-cols-12 gap-3 xl:gap-4">
      <section aria-labelledby="monitoreo-foco" className="superficie col-span-12 flex flex-col p-4 lg:col-span-7 xl:p-5">
        <h2 id="monitoreo-foco" className="eyebrow">{t('dispositivos.monitoreo.temperaturaInterna')}</h2>
        {!dispositivo.activo && <p className="mt-2 text-meta text-muted">{t('dispositivos.detalle.fueraDeServicio')}</p>}
        {actual === null ? (
          <p className="mt-3 text-body text-muted">{t('dispositivos.estadoEquipo.esperando')}</p>
        ) : (
          <>
            <p className="mt-2 nums text-display text-foreground">{formatearTemperatura(actual)}</p>
            <Regla tamano="xl" valor={actual} tono={tonoDeEstado(estado)} minimo={minimo} maximo={maximo} cotas className="mt-4" />
          </>
        )}
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
                {buffer?.pendientes ?? 0} / {buffer?.limite ?? CAPACIDAD_BUFFER_LITTLEFS}
              </span>
            </span>
            <span className="block nums text-meta text-muted">{t('dispositivos.perdidas', { n: buffer?.perdidas ?? 0 })}</span>
          </Dato>
          {buffer?.desde && (
            <Dato etiqueta={t('dispositivos.periodoCola')} className="col-span-2">
              <span className="nums">
                {fechaHora(buffer.desde)} – {buffer.hasta ? fechaHora(buffer.hasta) : '—'}
              </span>
            </Dato>
          )}
          {(buffer?.brechas ?? []).length > 0 && (
            <Dato etiqueta={t('dispositivos.monitoreo.brechas')} className="col-span-2">
              <ul className="space-y-0.5">
                {(buffer?.brechas ?? []).map((b) => (
                  <li key={`${b.desde}-${b.hasta}`} className="nums text-meta">
                    {t('dispositivos.monitoreo.brecha', { desde: fechaHora(b.desde), hasta: fechaHora(b.hasta), n: b.muestras_perdidas })}
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

      <Tarjeta id="monitoreo-24h" titulo={t('dispositivos.monitoreo.ultimas24h')} icono={Activity} className="col-span-12">
        {cargando ? (
          <EsqueletoTexto lineas={2} />
        ) : error ? (
          <p className="text-meta text-muted">{t('dispositivos.monitoreo.cintaNoDisponible')}</p>
        ) : (
          <>
            <Cinta24h segmentos={segmentos} etiqueta={dispositivo.id} className="h-5" />
            <div aria-hidden className="mt-1 flex justify-between text-micro text-faint">
              <span>−24 h</span>
              <span>−18</span>
              <span>−12</span>
              <span>−6</span>
              <span>{t('dispositivos.monitoreo.ahora')}</span>
            </div>
          </>
        )}
      </Tarjeta>
    </div>
  )
}
