import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ArrowUpRight, Sigma } from 'lucide-react'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import { estadoRiesgoDe } from '@/domain/entities/LecturaTermica'
import { rangoPagina } from '@/lib/paginacion'
import { EstadoError } from '../../../components/EstadoPagina'
import { HoraLectura } from '../../../components/HoraLectura'
import { Paginacion } from '../../../components/Paginacion'
import { RiskBadge } from '../../../components/RiskBadge'
import { Button } from '../../../components/ui/button'
import { EsqueletoTabla } from '../../../components/ui/esqueleto'
import { DECIMALES_HUMEDAD, formatearTemperatura } from '../../../components/ui/formato-cifra'
import { Dato, Tarjeta } from '../compartido'
import { useLecturasEquipo } from './datosEquipo'

const POR_PAGINA = 15

/** Últimas 200 lecturas del equipo con su resumen (mismo endpoint que Historial). */
export function TabHistorial({ dispositivo }: { dispositivo: Dispositivo }) {
  const { t } = useTranslation()
  const { lecturas, cargando, error, consultar } = useLecturasEquipo(dispositivo.id)
  const [pagina, setPagina] = useState(1)
  const visibles = useMemo(() => lecturas.slice(...rangoPagina(pagina, POR_PAGINA)), [lecturas, pagina])
  const resumen = useMemo(() => {
    const valores = lecturas.map((l) => l.temperatura_interna).filter((v): v is number => typeof v === 'number')
    if (valores.length === 0) return null
    const enRango = valores.filter((v) => v >= 2 && v <= 8).length
    return {
      min: Math.min(...valores),
      max: Math.max(...valores),
      promedio: valores.reduce((a, b) => a + b, 0) / valores.length,
      pct: Math.round((enRango / valores.length) * 100),
    }
  }, [lecturas])

  return (
    <div className="grid grid-cols-12 items-start gap-3 xl:gap-4">
      <Tarjeta id="historial-resumen" titulo={t('dispositivos.historialTab.resumen')} icono={Sigma} className="col-span-12 xl:col-span-4">
        {resumen ? (
          <dl className="grid grid-cols-2 gap-x-4">
            <Dato etiqueta={t('dispositivos.monitoreo.minimo')}><span className="nums text-title">{formatearTemperatura(resumen.min)}</span></Dato>
            <Dato etiqueta={t('dispositivos.monitoreo.maximo')}><span className="nums text-title">{formatearTemperatura(resumen.max)}</span></Dato>
            <Dato etiqueta={t('dispositivos.monitoreo.promedio')}><span className="nums text-title">{formatearTemperatura(resumen.promedio)}</span></Dato>
            <Dato etiqueta={t('dispositivos.monitoreo.enRango')}><span className="nums text-title">{resumen.pct} %</span></Dato>
          </dl>
        ) : (
          <p className="text-meta text-muted">{cargando ? '…' : t('dispositivos.estadoEquipo.esperando')}</p>
        )}
        <Link
          to={`/historial?device_id=${encodeURIComponent(dispositivo.id)}`}
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-meta font-medium text-primary-text hover:underline sm:min-h-8"
        >
          {t('dispositivos.historialTab.abrirHistorial')}
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </Tarjeta>

      <section aria-labelledby="historial-lecturas" className="superficie col-span-12 min-w-0 overflow-hidden xl:col-span-8">
        <h2 id="historial-lecturas" className="border-b border-border px-4 py-3 text-title text-foreground">
          {t('dispositivos.historialTab.lecturas')}
        </h2>
        {cargando ? (
          <EsqueletoTabla filas={5} columnas={5} className="p-4" />
        ) : error ? (
          <div className="p-4">
            <EstadoError mensaje={t('comunes.errorCargar')}>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => void consultar()}>{t('comunes.reintentar')}</Button>
            </EstadoError>
          </div>
        ) : lecturas.length === 0 ? (
          <p className="p-4 text-meta text-muted">{t('dispositivos.estadoEquipo.esperando')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-body">
                <thead className="bg-surface-sunken text-meta text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">{t('comunes.hora')}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t('dispositivos.monitoreo.interna')}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t('dispositivos.monitoreo.ambiente')}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t('dispositivos.monitoreo.humedad')}</th>
                    <th scope="col" className="px-4 py-2 font-medium">{t('dispositivos.monitoreo.riesgo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibles.map((l) => (
                    <tr key={l.id ?? `${l.timestamp}-${l.device_id}`}>
                      {/* HU-07: hora de captura (≈ si se reconstruyó; «Sin hora» si no la hay). */}
                      <td className="nums px-4 py-2 text-meta text-muted"><HoraLectura lectura={l} formato="fechaHora" /></td>
                      <td className="nums px-4 py-2">{l.temperatura_interna !== null ? formatearTemperatura(l.temperatura_interna) : '—'}</td>
                      <td className="nums px-4 py-2 text-subtle">{l.temperatura_ambiental !== null ? formatearTemperatura(l.temperatura_ambiental) : '—'}</td>
                      <td className="nums px-4 py-2 text-subtle">{l.humedad_ambiental !== null ? `${l.humedad_ambiental.toFixed(DECIMALES_HUMEDAD)} %` : '—'}</td>
                      {/* HU-34 esc. 4: sin clasificación IA o falla de sensor no se rotulan Normal. */}
                      <td className="px-4 py-2"><RiskBadge nivel={estadoRiesgoDe(l)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-4 py-2">
              <Paginacion total={lecturas.length} pagina={pagina} onCambiar={setPagina} tamano={POR_PAGINA} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
