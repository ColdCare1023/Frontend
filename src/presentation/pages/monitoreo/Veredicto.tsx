import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { localeActual } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { articuloDe, ordenarResumenes, type CausaEquipo, type ResumenEquipo } from './estadoEquipo'
import { segundosDesde, segundosRedondeados, tiempoBreve, useDelReloj } from './reloj'

export type EstadoCarga = 'cargando' | 'listo' | 'vacio' | 'error'
type Nivel = 'ok' | 'aviso' | 'critico' | 'sinDatos' | 'espera'

const NIVEL_DE_CAUSA: Record<CausaEquipo, Nivel> = {
  critico: 'critico',
  preventivo: 'aviso',
  puerta: 'aviso',
  sensor: 'sinDatos',
  suspendido: 'sinDatos',
  silencio: 'sinDatos',
  sinReporte: 'sinDatos',
  sinRiesgo: 'sinDatos',
  ok: 'ok',
}

/** «Sin lectura hace 2 min»: solo se vuelve a dibujar cuando cambia lo que se lee. */
function SinLecturaHace({ marca }: { marca: string }) {
  const { t } = useTranslation()
  const segundos = useDelReloj((ahora) => segundosRedondeados(segundosDesde(marca, ahora)))
  return <>{t('dashboard.sinLecturaHace', { tiempo: tiempoBreve(segundos, localeActual()) })}</>
}

/** Qué le pasa al equipo y qué hacer, en una línea. */
function Causa({ resumen }: { resumen: ResumenEquipo }) {
  const { t } = useTranslation()
  const temperatura = resumen.temperatura?.toFixed(1)
  switch (resumen.causa) {
    case 'critico':
      return <>{t('dashboard.causaCritico', { temperatura })}</>
    case 'preventivo':
      return <>{t('dashboard.causaPreventivo', { temperatura })}</>
    case 'silencio':
      return (
        <>
          <strong className="veredicto__fuerte">{resumen.marca ? <SinLecturaHace marca={resumen.marca} /> : t('dashboard.sinLecturaNueva')}.</strong>{' '}
          {t('dashboard.causaConexion')}
        </>
      )
    case 'sinReporte':
      return (
        <>
          <strong className="veredicto__fuerte">{t('dashboard.causaSinReporte')}</strong> {t('dashboard.causaConexion')}
        </>
      )
    case 'sensor':
      return <>{t('dashboard.causaSensor')}</>
    case 'suspendido':
      return <>{t('dashboard.causaSuspendido')}</>
    case 'sinRiesgo':
      return <>{t('dashboard.causaSinRiesgo')}</>
    case 'puerta':
      return <>{t('dashboard.causaPuerta')}</>
    default:
      return null
  }
}

/**
 * Arriba de Inicio, la respuesta a «¿están bien mis medicamentos?». Sale de lo mismo que pinta los
 * campos: «Todo en orden» solo cuando cada equipo esperado ya reportó y ninguno pide atención. Un
 * dato viejo, un sensor caído o una consulta que falló nunca se leen como «en orden».
 */
export const Veredicto = memo(function Veredicto({
  estado,
  resumenes,
  completos,
  sseConectado,
  children,
}: {
  estado: EstadoCarga
  resumenes: ResumenEquipo[]
  /** Todos los equipos esperados ya dijeron cómo están. */
  completos: boolean
  sseConectado: boolean
  /** La llamada a Alertas. */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const ordenados = ordenarResumenes(resumenes)
  const peor = ordenados[0]
  const otros = ordenados.slice(1).filter((resumen) => resumen.causa !== 'ok').length

  let nivel: Nivel
  let frase: string
  let detalle: ReactNode = null
  if (peor && peor.causa !== 'ok') {
    nivel = NIVEL_DE_CAUSA[peor.causa]
    frase = t('dashboard.veredictoRevisa', { articulo: articuloDe(peor.nombre), equipo: peor.nombre })
    detalle = (
      <>
        <Causa resumen={peor} />
        {otros > 0 && <span className="veredicto__otros">{t('dashboard.veredictoOtros', { count: otros })}</span>}
      </>
    )
  } else if (estado === 'error') {
    nivel = 'sinDatos'
    frase = t('dashboard.veredictoError')
    detalle = t('dashboard.veredictoErrorDetalle')
  } else if (estado === 'cargando' || (estado === 'listo' && !completos)) {
    nivel = 'espera'
    frase = t('dashboard.veredictoComprobando')
  } else if (estado === 'vacio' || ordenados.length === 0) {
    nivel = 'sinDatos'
    frase = t('dashboard.veredictoSinLecturas')
  } else {
    nivel = 'ok'
    frase = t('dashboard.veredictoOk')
    detalle = ordenados.length === 1
      ? t('dashboard.veredictoOkUno', { equipo: ordenados[0].nombre })
      : t('dashboard.veredictoOkVarios', { n: ordenados.length })
  }

  return (
    <section aria-labelledby="veredicto-frase" className="veredicto" data-nivel={nivel}>
      <div className="min-w-0">
        <p className={cn('veredicto__vivo', !sseConectado && 'veredicto__vivo--reconectando')}>
          <span aria-hidden className={sseConectado ? 'punto-vivo text-primary' : 'veredicto__punto'} />
          {sseConectado ? t('dashboard.actualizacionActiva') : t('dashboard.actualizacionReconectando')}
        </p>
        <h1 id="veredicto-frase" className="veredicto__frase">
          <span className="sr-only">{t('dashboard.titulo')}:</span>{' '}
          {/* Cambia la frase, no el bloque: se funde en su sitio. */}
          <span key={frase} className="veredicto__texto">{frase}</span>
        </h1>
        {detalle && <p className="veredicto__detalle">{detalle}</p>}
      </div>
      {children && <div className="veredicto__lado">{children}</div>}
    </section>
  )
})
