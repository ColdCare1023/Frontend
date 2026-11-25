import { SeccionDetalle } from '@/presentation/components/ui/seccion-detalle'
import { useTranslation } from 'react-i18next'
import { OctagonAlert, RefreshCw, ServerCog, TriangleAlert } from 'lucide-react'

import { useEstadoServicio } from '@/application/hooks/useEstadoServicio'
import {
  esConsumidorUnico,
  estadoMigraciones,
  motivosDegradado,
  situacionRespaldos,
  type EstadoServicio,
} from '@/domain/entities/EstadoServicio'
import { fechaHora, localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { EstadoCarga, EstadoError, EstadoVacio } from '../components/EstadoPagina'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { TiraEstado, type SegmentoTira } from '../components/ui/tira-estado'
import {
  BloqueArranque,
  BloqueBaseDatos,
  BloqueModeloIA,
  BloqueMqtt,
  BloqueNotificaciones,
  BloqueProxy,
  BloqueRespaldos,
  BloqueVigilancia,
} from './estado-servicio/BloquesServicio'

/**
 * HU-29 esc. 3: el respaldo programado falló o venció. Es lo único de la
 * pantalla que interrumpe (`role="alert"`) y dice qué hacer.
 */
function AlertaRespaldo({ e }: { e: EstadoServicio }) {
  const { t } = useTranslation()
  const situacion = situacionRespaldos(e.respaldos)
  if (situacion !== 'fallido' && situacion !== 'vencido') return null
  return (
    <div role="alert" className="flex items-start gap-3 rounded-(--radius-card) bg-critical-solid px-4 py-3 text-on-critical">
      <OctagonAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-body font-semibold">{t(`estadoServicio.respaldos.alerta.${situacion}`)}</p>
        <p className="text-body">{t('estadoServicio.respaldos.alerta.accion')}</p>
        {e.respaldos?.ultimo_completado && (
          <p className="nums mt-0.5 text-meta opacity-90">
            {t('estadoServicio.respaldos.alerta.ultimo', { fecha: fechaHora(e.respaldos.ultimo_completado) })}
          </p>
        )}
      </div>
    </div>
  )
}

function Resumen({ e }: { e: EstadoServicio }) {
  const { t } = useTranslation()
  const motivos = motivosDegradado(e)
  const lista = new Intl.ListFormat(localeActual(), { type: 'conjunction' })
  const guia =
    e.status === 'ok'
      ? t('estadoServicio.general.guiaOk')
      : motivos.length > 0
        ? t('estadoServicio.general.guiaDegradado', { motivos: lista.format(motivos.map((m) => t(`estadoServicio.general.motivos.${m}`))) })
        : t('estadoServicio.general.guiaDegradadoSinMotivo')
  const migraciones = estadoMigraciones(e)
  const respaldos = situacionRespaldos(e.respaldos)
  const unico = esConsumidorUnico(e.arranque)
  // Los valores de esta tira son estados en palabras (22 px), no cifras, y con
  // «…» se perdía justo el de aviso o crítico. Por eso: valores cortos (el
  // bloque de cada dependencia trae el texto completo); entre 640 y 1439 px,
  // segmentos de 12rem como base (3 + 2 bajo 1280 px en vez de 5 de ~145 px;
  // desde 1440 px la tira los deja a su ancho); etiqueta corta en móvil (mismo
  // patrón que UsuariosPage) y, si aun así algo no cabe, salto de línea.
  const segmentos: SegmentoTira[] = [
    {
      clave: 'general',
      etiqueta: t('estadoServicio.general.etiqueta'),
      valor: e.status === 'ok' ? t('estadoServicio.general.ok') : t('estadoServicio.general.degradado'),
      tono: e.status === 'ok' ? 'neutro' : e.db !== 'ok' ? 'critico' : 'aviso',
    },
    {
      clave: 'bd',
      etiqueta: t('estadoServicio.bd.titulo'),
      valor: e.db !== 'ok' ? t('estadoServicio.bd.conError') : migraciones === 'pendientes' ? t('estadoServicio.tira.bdPendientes') : t('estadoServicio.bd.conectada'),
      tono: e.db !== 'ok' ? 'critico' : migraciones === 'pendientes' ? 'aviso' : 'neutro',
    },
    {
      clave: 'mqtt',
      etiqueta: t('estadoServicio.mqtt.titulo'),
      valor: !e.mqtt
        ? t('estadoServicio.sinDato')
        : !e.mqtt.habilitado
          ? t('estadoServicio.tira.mqttDeshabilitado')
          : e.mqtt.conectado
            ? t('estadoServicio.mqtt.conectado')
            : t('estadoServicio.tira.mqttDesconectado'),
      tono: !e.mqtt ? 'sinDatos' : !e.mqtt.habilitado ? 'aviso' : e.mqtt.conectado ? 'neutro' : 'critico',
    },
    {
      clave: 'consumidor',
      etiqueta: (
        <>
          <span className="sm:hidden">{t('estadoServicio.tira.consumidorUnico')}</span>
          <span className="max-sm:hidden">{t('estadoServicio.arranque.consumidorUnico')}</span>
        </>
      ),
      valor: unico ? t('comunes.si') : t('comunes.no'),
      tono: unico ? 'neutro' : (e.arranque?.workers ?? 0) > 1 ? 'critico' : 'aviso',
    },
    {
      clave: 'respaldos',
      etiqueta: t('estadoServicio.respaldos.titulo'),
      valor: t(`estadoServicio.respaldos.estados.${respaldos}`),
      tono:
        respaldos === 'al_dia'
          ? 'neutro'
          : respaldos === 'sin_vigilancia' || respaldos === 'sin_pasada'
            ? 'sinDatos'
            : respaldos === 'sin_respaldos'
              ? 'aviso'
              : 'critico',
    },
  ]
  return (
    <TiraEstado
      etiqueta={t('estadoServicio.resumen')}
      guia={guia}
      segmentos={segmentos.map((segmento) => ({ ...segmento, className: 'sm:max-[1440px]:flex-[1_1_12rem]' }))}
      apilarGuia
      ajustarTexto
    />
  )
}

/**
 * Estado del servicio (solo administrador): `GET /health/detalle` en claro.
 * Evidencia de HU-12 esc. 4 (un consumidor MQTT: 1 worker), HU-55
 * (migraciones aplicadas, arranque reproducible, proxy https) y HU-29 esc. 3
 * (respaldo programado fallido o vencido). Solo lectura; se actualiza cada
 * 30 s con la pestaña visible y con «Actualizar».
 */
export function EstadoServicioPage() {
  const { t } = useTranslation()
  const { datos, cargando, refrescandoManual, error, consultadoEn, actualizar } = useEstadoServicio()

  // Hora de la consulta que se muestra (la del backend; si no la trae, la local).
  const momento = datos ? (datos.timestamp ?? consultadoEn) : null
  // Solo la recarga que pide la persona gira y cambia el texto: el sondeo de
  // cada 30 s no mueve el encabezado ni renombra el botón con el foco puesto.
  const botonActualizar = (
    <Button variant="secondary" size="sm" onClick={() => void actualizar()} aria-describedby={momento ? 'estado-servicio-consulta' : undefined}>
      <RefreshCw aria-hidden className={cn(refrescandoManual && 'animate-spin motion-reduce:animate-none')} />
      {refrescandoManual ? t('estadoServicio.actualizando') : t('estadoServicio.actualizar')}
    </Button>
  )

  let cuerpo: React.ReactNode
  if (cargando && !datos) {
    cuerpo = <EstadoCarga texto={t('estadoServicio.cargando')} />
  } else if (error === 'sin_permiso' || error === 'sin_sesion') {
    cuerpo = <EstadoError mensaje={error === 'sin_permiso' ? t('estadoServicio.errores.sinPermiso') : t('estadoServicio.errores.sinSesion')} />
  } else if (!datos && error === 'error') {
    cuerpo = (
      <EstadoError mensaje={t('estadoServicio.errores.carga')}>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void actualizar()}>
          {t('comunes.reintentar')}
        </Button>
      </EstadoError>
    )
  } else if (!datos) {
    cuerpo = (
      <EstadoVacio icono={ServerCog} titulo={t('estadoServicio.vacio.titulo')} detalle={t('estadoServicio.vacio.detalle')}>
        {botonActualizar}
      </EstadoVacio>
    )
  } else {
    cuerpo = (
      <div className="space-y-3 xl:space-y-4">
        <AlertaRespaldo e={datos} />
        {error === 'error' && (
          <p role="status" className="flex items-start gap-2 rounded-(--radius-field) bg-warning-100 px-3 py-2 text-meta text-warning-700">
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {t('estadoServicio.errores.refresco', { fecha: fechaHora(momento) })}
          </p>
        )}
        <Resumen e={datos} />
        <SeccionDetalle titulo={t('lectura.diagnostico')} open={datos.status !== 'ok'}>
          <div className="grid gap-3 lg:grid-cols-2 xl:gap-4">
            <BloqueBaseDatos e={datos} />
            <BloqueMqtt e={datos} />
            <BloqueArranque e={datos} />
            <BloqueProxy e={datos} />
            <BloqueNotificaciones e={datos} />
            <BloqueVigilancia e={datos} />
            <BloqueRespaldos e={datos} />
            <BloqueModeloIA e={datos} />
          </div>
        </SeccionDetalle>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        titulo={t('estadoServicio.titulo')}
        descripcion={t('estadoServicio.descripcion')}
        meta={momento ? <span id="estado-servicio-consulta">{t('estadoServicio.consultado', { fecha: fechaHora(momento) })}</span> : undefined}
      >
        {/* Sin datos y con error, la única acción es «Volver a intentar» de la tarjeta de error. */}
        {datos && botonActualizar}
      </PageHeader>
      {cuerpo}
    </div>
  )
}
