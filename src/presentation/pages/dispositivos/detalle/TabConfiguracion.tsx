import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cpu, History, Radio, Thermometer } from 'lucide-react'

import { INTERVALO_REPORTE_POR_DEFECTO, umbralSilencioSegundos, type Dispositivo } from '@/domain/entities/Dispositivo'
import { fechaHora } from '@/lib/formato'
import { Badge } from '../../../components/ui/badge'
import { Segmentado } from '../../../components/ui/segmentado'
import { Dato, Tarjeta } from '../compartido'
import { CAMPOS_CALIBRACION, CAMPOS_RESPONSABLE, CAMPOS_UBICACION } from '../estadoEquipo'
import { useCambiosEquipo } from './datosEquipo'
import { LineaTiempoCambios } from './LineaTiempoCambios'

type FiltroCambios = 'todos' | 'calibracion' | 'ubicacion' | 'responsable'
const CAMPOS: Record<FiltroCambios, readonly string[] | undefined> = {
  todos: undefined,
  calibracion: CAMPOS_CALIBRACION,
  ubicacion: CAMPOS_UBICACION,
  responsable: CAMPOS_RESPONSABLE,
}

/** HU-49 (historial completo) y ficha técnica del nodo (HU-43/48/54/55). */
export function TabConfiguracion({ dispositivo }: { dispositivo: Dispositivo }) {
  const { t } = useTranslation()
  const { cambios, cargando } = useCambiosEquipo(dispositivo.id)
  const [filtro, setFiltro] = useState<FiltroCambios>('todos')
  const evento = dispositivo.ultimo_evento

  return (
    <div className="grid grid-cols-12 items-start gap-3 xl:gap-4">
      <Tarjeta
        id="configuracion-historial"
        titulo={t('dispositivos.historialConfiguracion')}
        icono={History}
        className="col-span-12 lg:col-span-7"
      >
        <Segmentado<FiltroCambios>
          etiqueta={t('dispositivos.historialConfiguracion')}
          valor={filtro}
          onCambiar={setFiltro}
          className="mb-3"
          opciones={[
            { valor: 'todos', etiqueta: t('dispositivos.configuracionTab.filtroTodos') },
            { valor: 'calibracion', etiqueta: t('dispositivos.configuracionTab.filtroCalibracion') },
            { valor: 'ubicacion', etiqueta: t('dispositivos.configuracionTab.filtroUbicacion') },
            { valor: 'responsable', etiqueta: t('dispositivos.configuracionTab.filtroResponsable') },
          ]}
        />
        <LineaTiempoCambios cambios={cambios} cargando={cargando} campos={CAMPOS[filtro]} className="max-h-120 overflow-y-auto" />
      </Tarjeta>

      <div className="col-span-12 grid gap-3 lg:col-span-5 xl:gap-4">
        <Tarjeta id="configuracion-sensores" titulo={t('dispositivos.sensores')} icono={Thermometer}>
          {(dispositivo.sensores ?? []).length === 0 ? (
            <p className="text-meta text-muted">—</p>
          ) : (
            <ul className="divide-y divide-border">
              {(dispositivo.sensores ?? []).map((sensor) => (
                <li key={sensor.modelo} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-body font-medium text-foreground">{sensor.modelo}</p>
                    <p className="codigo truncate font-mono text-meta text-muted">{sensor.campo_telemetria}</p>
                  </div>
                  <Badge variant={sensor.estado === 'ok' ? 'ok' : sensor.estado === 'error' ? 'critical' : 'neutral'}>
                    {t(`dispositivos.sensorEstado.${sensor.estado}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta id="configuracion-nodo" titulo={t('dispositivos.configuracionTab.nodo')} icono={Cpu}>
          <dl className="grid grid-cols-2 gap-x-4">
            <Dato etiqueta={t('dispositivos.id')}><span className="codigo">{dispositivo.id}</span></Dato>
            <Dato etiqueta={t('dispositivos.firmware')}><span className="nums">{dispositivo.firmware_version || '—'}</span></Dato>
            <Dato etiqueta={t('dispositivos.intervaloReporte')}>
              {t('dispositivos.reporteCada', { s: dispositivo.intervalo_reporte_segundos ?? INTERVALO_REPORTE_POR_DEFECTO })}
            </Dato>
            <Dato etiqueta={t('dispositivos.umbralSinDatos')}>{t('dispositivos.sinDatosTras', { s: umbralSilencioSegundos(dispositivo) })}</Dato>
            <Dato etiqueta={t('dispositivos.configuracionTab.registrado')}>
              <span className="nums">{dispositivo.registrado_en ? fechaHora(dispositivo.registrado_en) : '—'}</span>
            </Dato>
            <Dato etiqueta={t('dispositivos.configuracionTab.ultimoLatido')}>
              <span className="nums">{dispositivo.ultimo_latido_en ? fechaHora(dispositivo.ultimo_latido_en) : '—'}</span>
            </Dato>
          </dl>
        </Tarjeta>

        <Tarjeta id="configuracion-telemetria" titulo={t('dispositivos.telemetria')} icono={Radio}>
          {evento ? (
            <p className="codigo break-all font-mono text-meta text-subtle">
              schema {evento.schema_version} · boot_id {evento.boot_id} · seq_no {evento.seq_no} · {evento.time_quality}
            </p>
          ) : (
            <p className="text-meta text-muted">—</p>
          )}
        </Tarjeta>
      </div>
    </div>
  )
}
