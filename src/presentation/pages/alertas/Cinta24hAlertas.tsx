import { useTranslation } from 'react-i18next'

import { useClasificacionPreventiva } from '@/application/hooks/useClasificacionPreventiva'
import type { CintaEquipo } from '@/lib/cinta24h'
import { Cinta24h } from '../../components/ui/cinta-24h'
import { Esqueleto } from '../../components/ui/esqueleto'

const PREVENTIVA = 'alertas.rail.leyendaPreventiva'

const LEYENDA = [
  { clase: 'bg-critical-solid', clave: 'alertas.rail.leyendaCritica' },
  { clase: 'bg-warning-600', clave: PREVENTIVA },
  { clase: 'trama-sin-datos', clave: 'alertas.rail.leyendaSinDatos' },
  // El gris liso del tramo sin eventos apenas se distingue de la superficie
  // (1.24:1): en la leyenda lleva un contorno ≥ 3:1 para poder identificarlo.
  { clase: 'bg-nodata-100 ring-1 ring-inset ring-nodata-600', clave: 'alertas.rail.leyendaSinEventos' },
] as const

/**
 * Cinta 24 h por equipo (21st System Status, la firma de DIRECTION §4), hecha
 * solo con las alertas y los incidentes que la pantalla ya cargó. Un tramo sin
 * eventos va en gris liso (sin trama ni borde, para que la cinta no parezca un
 * código de barras en oscuro): no se pinta como «en rango» porque no hay
 * lecturas que lo prueben. Sin animación: se recalcula con los datos o cada 5 min.
 *
 * HU-20: «Preventiva» (leyenda y resumen) solo se menciona si el backend
 * informa la clasificación preventiva en operación o si hay tramos
 * preventivos que rotular; si no, se diría que se vigila algo que no opera.
 */
export function Cinta24hAlertas({ cintas, cargando }: { cintas: readonly CintaEquipo[]; cargando: boolean }) {
  const { t } = useTranslation()
  const { operativa } = useClasificacionPreventiva()
  const conPreventiva = (cinta: CintaEquipo) => operativa || cinta.resumen.preventivos > 0
  const mostrarPreventiva = operativa || cintas.some((cinta) => cinta.resumen.preventivos > 0)
  const leyenda = LEYENDA.filter(({ clave }) => clave !== PREVENTIVA || mostrarPreventiva)
  return (
    <section aria-labelledby="cinta-titulo" className="superficie p-4">
      <h2 id="cinta-titulo" className="text-title text-foreground">
        {t('alertas.rail.ultimas24h')}
      </h2>
      <p className="text-meta text-faint">{t('alertas.rail.ayuda24h')}</p>
      {cargando ? (
        <div role="status" className="mt-3 space-y-2">
          <span className="sr-only">{t('app.cargando')}</span>
          {[0, 1].map((i) => (
            <Esqueleto key={i} className="h-5" />
          ))}
        </div>
      ) : cintas.length === 0 ? (
        <p className="mt-3 text-body text-muted">{t('alertas.rail.sinEventos24h')}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {cintas.map((cinta) => (
              <li key={cinta.deviceId} className="flex items-center gap-3">
                <span className="codigo w-24 shrink-0 truncate text-meta text-muted" title={cinta.deviceId}>
                  {cinta.deviceId}
                </span>
                <Cinta24h
                  segmentos={cinta.segmentos}
                  etiqueta={cinta.deviceId}
                  resumen={t(conPreventiva(cinta) ? 'alertas.rail.resumenCinta' : 'alertas.rail.resumenCintaSinPreventiva', {
                    equipo: cinta.deviceId,
                    ...cinta.resumen,
                  })}
                  textoTono={{ neutro: t('alertas.rail.leyendaSinEventos') }}
                  className="min-w-0 flex-1 [&>[data-tono=neutro]]:bg-nodata-100"
                />
              </li>
            ))}
          </ul>
          {/* Eje: el ancho de la etiqueta (96) + el hueco (12). */}
          <div aria-hidden className="mt-1 flex justify-between pl-[108px] text-micro text-faint">
            <span>{t('alertas.rail.ejeInicio')}</span>
            <span>{t('alertas.rail.ejeFin')}</span>
          </div>
        </>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-meta text-muted">
        {leyenda.map(({ clase, clave }) => (
          <li key={clave} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={`size-2.5 rounded-sm ${clase}`} />
            {t(clave)}
          </li>
        ))}
      </ul>
    </section>
  )
}
