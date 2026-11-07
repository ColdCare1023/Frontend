import { memo, useCallback, useMemo, useState } from 'react'
import { LayoutGroup } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { useEstadoOperativo } from '@/application/hooks/useEstadoOperativo'
import { useMonitoreoTermico } from '@/application/hooks/useMonitoreoTermico'
import { umbralSilencioSegundos, type Dispositivo } from '@/domain/entities/Dispositivo'
import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { DISPOSITIVO_DEMO } from '@/infrastructure/demo/constantesDemo'
import { AnuncioRiesgo } from '../components/AnuncioRiesgo'
import { Button } from '../components/ui/button'
import { Detalles } from '../components/ui/detalles'
import { CampoEquipo } from './monitoreo/CampoEquipo'
import { causaDelEquipo, equipoMasReciente, mismoResumen, tieneIncidencias, type ResumenEquipo } from './monitoreo/estadoEquipo'
import { CargaMonitoreo, ErrorMonitoreo, VacioMonitoreo } from './monitoreo/EstadosMonitoreo'
import { EstadoEquiposIoT, IncidentesEquipos } from './monitoreo/IncidentesEquipos'
import { LecturasRecientes } from './monitoreo/LecturasRecientes'
import { LineaDelDia } from './monitoreo/LineaDelDia'
import { LlamadaAlertas } from './monitoreo/LlamadaAlertas'
import { segundosDesde, useDelReloj } from './monitoreo/reloj'
import { SimuladorEstados } from './monitoreo/SimuladorEstados'
import { Veredicto, type EstadoCarga } from './monitoreo/Veredicto'

/**
 * RF-11 + WCAG 4.1.3: la excursión térmica que llega por SSE se anuncia.
 * HU-34: se anuncia el riesgo EFECTIVO, no la clase cruda de la IA —
 * es lo que decide si hay que actuar, no lo que opinó el modelo.
 * HU-33 criterio 2 / B-17: frescura calculada con el umbral SIN_DATOS del nodo.
 */
function AnuncioVigente({ ultima, equipo }: { ultima: LecturaTermica | null; equipo?: Dispositivo }) {
  const marca = ultima?.timestamp
  const umbral = umbralSilencioSegundos(equipo)
  const enSilencio = useDelReloj((ahora) => (marca ? segundosDesde(marca, ahora) >= umbral : false))
  const desactualizado = equipo?.estado_operativo === 'SIN_DATOS' || enSilencio
  return (
    <AnuncioRiesgo
      nivel={desactualizado ? null : ultima?.riesgo_efectivo ?? null}
      temperatura={desactualizado ? null : ultima?.temperatura_interna}
    />
  )
}

/**
 * Con dos o más equipos, cada campo trae su propia última lectura: elegir otro no desmonta nada ni
 * apaga el vial. El elegido usa además la de la ventana completa, por si su última es más vieja
 * que la hora que pide cada campo.
 */
const CampoVivo = memo(function CampoVivo({
  equipo,
  seleccionado,
  ultimaElegida,
  previaElegida,
  onElegir,
  onResumen,
}: {
  equipo: Dispositivo
  seleccionado: boolean
  ultimaElegida: LecturaTermica | null
  previaElegida: LecturaTermica | null
  onElegir: (id: string) => void
  onResumen: (resumen: ResumenEquipo) => void
}) {
  const propio = useMonitoreoTermico(1, equipo.id)
  const ultima = (seleccionado ? ultimaElegida : null) ?? propio.ultima
  const previa = (seleccionado ? previaElegida : null) ?? propio.serie.at(-2) ?? null
  const seleccionar = useCallback(() => onElegir(equipo.id), [onElegir, equipo.id])
  return (
    <CampoEquipo
      ultima={ultima}
      previa={previa}
      equipo={equipo}
      seleccionado={seleccionado}
      variosEquipos
      onSeleccionar={seleccionar}
      onResumen={onResumen}
      esperando={ultima === null && propio.estadoHistorial === 'cargando'}
    />
  )
})

/** Sin lectura que mostrar, la frase sale del estado que el backend tiene de cada equipo. */
function resumenSinLectura(equipo: Dispositivo): ResumenEquipo {
  const causa = causaDelEquipo({ ultima: null, equipo, desactualizado: true, sensorFallido: false, puertaProlongada: false })
  return {
    id: equipo.id,
    nombre: equipo.nombre || equipo.id,
    causa,
    temperatura: null,
    marca: causa === 'silencio' ? (equipo.ultimo_reporte_en ?? null) : null,
  }
}

export function DashboardPage() {
  const { t } = useTranslation()
  const [horasVentana, setHorasVentana] = useState<number>(24)
  // Un solo sondeo y una sola suscripción: los equipos con incidencias se filtran aquí.
  const { equipos, consultar: consultarEstadoOperativo } = useEstadoOperativo(true)
  const equiposConIncidencias = useMemo(() => equipos.filter(tieneIncidencias), [equipos])
  // HU-31/HU-33: la línea del día sigue a UN refrigerador a la vez. Por defecto,
  // el que reportó más recientemente; con más de uno, se elige tocando su campo.
  const [equipoElegido, setEquipoElegido] = useState<string | null>(null)
  const deviceId = equipoElegido ?? equipoMasReciente(equipos)
  // El equipo inicial se fija una vez: con dos reportando, el «más reciente» cambia en cada sondeo
  // y eso vaciaba la serie y volvía a montar la gráfica. Después solo cambia si la persona elige otro.
  if (equipoElegido === null && deviceId !== null) setEquipoElegido(deviceId)
  const { ultima, serie, sseConectado, estadoHistorial, reintentar } = useMonitoreoTermico(horasVentana, deviceId)
  const estadoIoTPrincipal =
    equipos.find((equipo) => equipo.id === deviceId) ??
    equiposConIncidencias.find((equipo) => equipo.id === (deviceId ?? DISPOSITIVO_DEMO))
  const previa = serie.at(-2) ?? null
  const variosEquipos = equipos.length > 1
  const nombreEquipo = estadoIoTPrincipal?.nombre || ultima?.device_id || deviceId

  // Cada campo cuenta cómo está; la frase de arriba sale de ahí.
  const [resumenes, setResumenes] = useState<Record<string, ResumenEquipo>>({})
  const reportar = useCallback(
    (resumen: ResumenEquipo) => setResumenes((previos) => (mismoResumen(previos[resumen.id], resumen) ? previos : { ...previos, [resumen.id]: resumen })),
    [],
  )

  // Una vez que hubo campos, elegir otro equipo no vuelve al esqueleto mientras llega su ventana.
  const [huboLectura, setHuboLectura] = useState(false)
  if (ultima && !huboLectura) setHuboLectura(true)

  const vista: 'campos' | 'carga' | 'vacio' =
    variosEquipos || ultima ? 'campos' : estadoHistorial === 'cargando' && !huboLectura ? 'carga' : estadoHistorial === 'cargando' ? 'campos' : 'vacio'
  // Los equipos que la frase espera oír antes de decir «Todo en orden».
  const esperados = (variosEquipos ? equipos.map((equipo) => equipo.id) : [estadoIoTPrincipal?.id ?? ultima?.device_id ?? '']).filter(Boolean).join('|')
  const listaVeredicto = useMemo(
    () =>
      vista === 'vacio'
        ? equipos.map(resumenSinLectura)
        : esperados.split('|').map((id) => resumenes[id]).filter((resumen): resumen is ResumenEquipo => !!resumen),
    [vista, equipos, resumenes, esperados],
  )
  const estadoCarga: EstadoCarga =
    vista === 'carga' ? 'cargando' : vista === 'vacio' ? (estadoHistorial === 'error' ? 'error' : 'vacio') : 'listo'
  const completos = esperados !== '' && listaVeredicto.length === esperados.split('|').length
  const elegidoEnSilencio = !!deviceId && resumenes[deviceId]?.causa === 'silencio'

  const actualizarDemo = async () => {
    await consultarEstadoOperativo()
    reintentar()
  }

  return (
    <div className="monitoreo">
      <AnuncioVigente ultima={ultima} equipo={estadoIoTPrincipal} />

      <Veredicto estado={estadoCarga} resumenes={listaVeredicto} completos={completos} sseConectado={sseConectado}>
        <LlamadaAlertas />
      </Veredicto>

      {estadoHistorial === 'error' && ultima !== null && (
        <div role="alert" className="monitoreo__error-linea">
          <span>{t('dashboard.errorHistorial')}</span>
          <Button variant="secondary" size="sm" onClick={reintentar}>
            {t('comunes.reintentar')}
          </Button>
        </div>
      )}

      {vista === 'carga' ? (
        <CargaMonitoreo>
          <EstadoEquiposIoT equipos={equiposConIncidencias} />
        </CargaMonitoreo>
      ) : vista === 'vacio' ? (
        <>
          {estadoHistorial === 'error' ? <ErrorMonitoreo onReintentar={reintentar} /> : <VacioMonitoreo />}
          {/* El estado del nodo no depende de que exista una lectura térmica para
              mostrar: una cámara sin telemetría también debe aparecer aquí. */}
          <EstadoEquiposIoT equipos={equiposConIncidencias} />
        </>
      ) : (
        <>
          <LayoutGroup>
            <div className="campos" data-varios={variosEquipos ? '' : undefined}>
              {variosEquipos ? (
                equipos.map((equipo) => (
                  <CampoVivo
                    key={equipo.id}
                    equipo={equipo}
                    seleccionado={equipo.id === deviceId}
                    ultimaElegida={equipo.id === deviceId ? ultima : null}
                    previaElegida={equipo.id === deviceId ? previa : null}
                    onElegir={setEquipoElegido}
                    onResumen={reportar}
                  />
                ))
              ) : (
                <CampoEquipo
                  ultima={ultima}
                  previa={previa}
                  equipo={estadoIoTPrincipal}
                  seleccionado
                  variosEquipos={false}
                  onResumen={reportar}
                  esperando={ultima === null}
                />
              )}
            </div>
          </LayoutGroup>

          <LineaDelDia
            serie={serie}
            nombreEquipo={nombreEquipo}
            horasVentana={horasVentana}
            onVentana={setHorasVentana}
            cargando={estadoHistorial === 'cargando'}
            equipos={equipos}
            deviceId={deviceId}
            onEquipo={setEquipoElegido}
            enSilencio={elegidoEnSilencio}
          />

          {/* Lo de segundo plano: las últimas lecturas y la ficha de los equipos, a un toque. */}
          <Detalles className="monitoreo__mas" titulo={t('dashboard.verLecturasIncidentes')}>
            <div className="monitoreo__columnas" data-dos={equiposConIncidencias.length > 0 ? '' : undefined}>
              <LecturasRecientes serie={serie} />
              <IncidentesEquipos equipos={equiposConIncidencias} />
            </div>
          </Detalles>
        </>
      )}
      <SimuladorEstados onActualizado={actualizarDemo} />
    </div>
  )
}
