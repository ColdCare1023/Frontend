import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TableProperties } from 'lucide-react'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { hora as formatearHora } from '@/lib/formato'
import { cn } from '@/lib/utils'

/**
 * Tabla accesible de datos para la curva del dashboard.
 * Las filas solo se convierten a texto mientras la tabla está abierta; el
 * componente memorizado tampoco se ejecuta cuando cambia otra parte de la pantalla.
 */
export const TablaDatos = memo(function TablaDatos({ serie, titulo }: { serie: LecturaTermica[]; titulo: string }) {
  const { t } = useTranslation()
  const [abierto, setAbierto] = useState(false)
  const columnas = [
    t('historial.fecha'),
    t('dashboard.tempInterna'),
    t('dashboard.tempAmbiental'),
    t('historial.riesgo'),
    t('dashboard.eventoGrafica'),
  ]
  const filas = useMemo(
    () =>
      abierto
        ? serie.map((lectura) => [
            formatearHora(lectura.timestamp),
            lectura.temperatura_interna?.toFixed(1) ?? '—',
            lectura.temperatura_ambiental?.toFixed(1) ?? '—',
            lectura.riesgo_efectivo ? t(`riesgo.${lectura.riesgo_efectivo}`) : '—',
            lectura.excursion_confirmada ? t('dashboard.excursionEvento') : '—',
          ])
        : [],
    [abierto, serie, t],
  )

  if (serie.length === 0) return null

  return (
    <details
      id="curva-termica-datos"
      open={abierto}
      onToggle={(evento) => setAbierto(evento.currentTarget.open)}
      className="mt-3"
    >
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-field) text-[13px] font-medium text-primary sm:min-h-9 sm:pointer-coarse:min-h-11">
        <TableProperties className="size-3.5" aria-hidden />
        {t('comunes.verDatosGrafica')}
      </summary>
      {abierto && (
        <div className="mt-2 max-h-72 overflow-auto rounded-(--radius-card) border border-border bg-surface">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">{titulo}</caption>
            <thead className="sticky top-0 bg-cream-100">
              <tr>
                {columnas.map((columna, indice) => (
                  <th
                    key={columna}
                    scope="col"
                    className={cn('px-3 py-2 text-xs font-medium text-muted', indice > 0 && 'text-center')}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((fila, indice) => (
                <tr key={indice}>
                  {fila.map((celda, columna) => (
                    <td key={columna} className={cn('nums px-3 py-1.5', columna > 0 && 'text-center')}>
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
})
