import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { localeActual } from '@/lib/formato'
import { etiquetaEvento, temperaturaDelRegistro, type Eslabon } from './cadena'

type Traductor = ReturnType<typeof useTranslation>['t']

const GIRO_TIMBRE = [-5, 4, -3, 6, -6, 3]
const INCLINACION = [-0.5, 0.35, -0.25, 0.45, -0.4, 0.3]
const CAIDA = [1.4, -1, 1.8, -1.4, 1.2]
const PASO_MS = 110

function hashCorto(hash: string) {
  return hash ? `${hash.slice(0, 10)}…` : '··········'
}

/** Lo que se escribe a mano en la tableta: la temperatura si la hay; si no, el nivel o el tipo de evento. */
function textoDelSello(eslabon: Eslabon, t: Traductor) {
  const temperatura = temperaturaDelRegistro(eslabon.payload)
  if (temperatura !== null) return `${temperatura.toFixed(1)}\u00a0°C`
  const nivel = eslabon.payload.nivel_riesgo
  if (typeof nivel === 'string') return t(`riesgo.${nivel}`, { defaultValue: etiquetaEvento(eslabon.tipo_evento, t) })
  return etiquetaEvento(eslabon.tipo_evento, t)
}

function Tableta({ eslabon, indice, indiceRoto, tecnico }: { eslabon: Eslabon; indice: number; indiceRoto: number; tecnico: boolean }) {
  const { t } = useTranslation()
  const fecha = new Date(eslabon.timestamp)
  const valida = !Number.isNaN(fecha.getTime())
  const estilo = {
    '--demora': `${indice * PASO_MS}ms`,
    '--inclina': `${INCLINACION[indice % INCLINACION.length]}deg`,
    '--giro': `${GIRO_TIMBRE[indice % GIRO_TIMBRE.length]}deg`,
    '--caida': `${CAIDA[indice % CAIDA.length]}deg`,
    '--tras': indiceRoto >= 0 ? indice - indiceRoto : 0,
  } as CSSProperties

  return (
    <li className="cadena__item" data-estado={eslabon.estado} style={estilo}>
      {eslabon.enlace !== 'inicio' && (
        <span aria-hidden className="cadena__aros" data-enlace={eslabon.enlace}>
          <span className="cadena__aro" />
          <span className="cadena__aro" />
        </span>
      )}
      {eslabon.saltados > 0 && (
        <span className="cadena__saltados nums">{t('trazabilidad.registrosSaltados', { count: eslabon.saltados })}</span>
      )}
      <article className="sello">
        <time dateTime={eslabon.timestamp} className="sello__hora nums">
          {valida ? (
            <>
              <span className="block">{fecha.toLocaleDateString(localeActual(), { day: 'numeric', month: 'short' })}</span>
              <span className="block whitespace-nowrap">{fecha.toLocaleTimeString(localeActual(), { hour: 'numeric', minute: '2-digit' })}</span>
            </>
          ) : '—'}
        </time>
        <span className="sello__valor">{textoDelSello(eslabon, t)}</span>
        {eslabon.estado !== 'pendiente' && (
          <span className="timbre" data-tipo={eslabon.estado}>{t(`trazabilidad.timbre.${eslabon.estado}`)}</span>
        )}
        {tecnico && (
          <span className="sello__hash nums">
            {eslabon.hashEsperado ? (
              <>
                <span className="sello__tachado">
                  <span className="sr-only">{t('trazabilidad.hashAlmacenado')}: </span>
                  {hashCorto(eslabon.hash)}
                </span>
                <span className="block">
                  <span className="sr-only">{t('trazabilidad.hashEsperado')}: </span>
                  {hashCorto(eslabon.hashEsperado)}
                </span>
              </>
            ) : (
              <>
                <span className="sr-only">{t('trazabilidad.hash')}: </span>
                {hashCorto(eslabon.hash)}
              </>
            )}
          </span>
        )}
      </article>
    </li>
  )
}

/**
 * Sellos encadenados: cada registro se une al anterior por su sello. Al verificar, cada tableta recibe
 * su timbre en orden; la que no coincide se adelanta, el eslabón se suelta y lo que sigue cae. Es un
 * dibujo sencillo: la fecha, lo anotado y el timbre. El sello en sí se ve solo con `tecnico`.
 */
export function CadenaSellos({ eslabones, tecnico = false }: { eslabones: Eslabon[]; tecnico?: boolean }) {
  const { t } = useTranslation()
  const indiceRoto = eslabones.findIndex((e) => e.estado === 'no_coincide')
  return (
    <ol aria-label={t('trazabilidad.cadenaEtiqueta')} className="cadena">
      {eslabones.map((eslabon, indice) => (
        <Tableta key={eslabon.id} eslabon={eslabon} indice={indice} indiceRoto={indiceRoto} tecnico={tecnico} />
      ))}
    </ol>
  )
}
