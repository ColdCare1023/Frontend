import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { RegistroAuditoria } from '@/domain/entities/Usuario'
import { claveDia } from '@/lib/agruparPorDia'
import { diaCorto } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { esFallida } from './categoriasAuditoria'

const DIAS = 14


/**
 * «Actividad de 14 días»: barras apiladas (exitosas / fallidas o denegadas)
 * sobre la última carga sin periodo. Pulsar una barra filtra ese día en el
 * servidor; volver a pulsarla lo quita. Sin escalonado ni animación de
 * entrada (MOTION §3.9): solo color en hover y anillo de selección.
 * Bajo `sm` las 14 barras van en dos filas de 7 (una por semana, cada una con
 * sus fechas) para que cada barra mida al menos 24 px de ancho (WCAG 2.5.8,
 * tamaño mínimo del objetivo); desde `sm` las dos semanas van seguidas.
 * Las exitosas van en `faint` (≥ 3:1 sobre la superficie, WCAG 1.4.11).
 */
export function HistogramaActividad({
  registros,
  diaSeleccionado,
  onSeleccionar,
  ahora = new Date(),
}: {
  registros: readonly RegistroAuditoria[]
  diaSeleccionado: string | null
  onSeleccionar: (clave: string | null, inicio: Date) => void
  ahora?: Date
}) {
  const { t } = useTranslation()
  const dias = useMemo(() => {
    const lista: { clave: string; inicio: Date; total: number; fallidas: number }[] = []
    for (let i = DIAS - 1; i >= 0; i--) {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - i)
      lista.push({ clave: claveDia(inicio.toISOString()), inicio, total: 0, fallidas: 0 })
    }
    const indice = new Map(lista.map((d) => [d.clave, d]))
    for (const r of registros) {
      const dia = indice.get(claveDia(r.created_at))
      if (!dia) continue
      dia.total += 1
      if (esFallida(r)) dia.fallidas += 1
    }
    return lista
    // `ahora` cambia en cada render del padre; el día basta como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, claveDia(ahora.toISOString())])
  const maximo = Math.max(1, ...dias.map((d) => d.total))
  const semanas = [dias.slice(0, DIAS / 2), dias.slice(DIAS / 2)]

  return (
    <section aria-labelledby="auditoria-actividad-titulo" className="superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="auditoria-actividad-titulo" className="text-title text-foreground">{t('auditoria.actividad.titulo')}</h2>
        <div className="flex items-center gap-3 text-meta text-muted">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-faint" />{t('auditoria.actividad.exitosas')}</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-critical" />{t('auditoria.actividad.fallidas')}</span>
        </div>
      </div>
      <div className="mt-3 grid gap-y-3 sm:grid-cols-2 sm:gap-x-1">
        {semanas.map((semana) => {
          const desde = diaCorto(semana[0].inicio.toISOString())
          const hasta = diaCorto(semana[semana.length - 1].inicio.toISOString())
          return (
            <div key={semana[0].clave} className="min-w-0">
              <ol
                aria-label={t('auditoria.actividad.semana', { desde, hasta })}
                className="grid h-12 grid-cols-7 items-end gap-x-1.5 sm:h-16 sm:gap-x-1"
              >
                {semana.map((dia) => {
                  const activo = diaSeleccionado === dia.clave
                  const alto = (dia.total / maximo) * 100
                  const altoFallidas = dia.total ? (dia.fallidas / dia.total) * 100 : 0
                  return (
                    <li key={dia.clave} className="h-full">
                      <button
                        type="button"
                        aria-pressed={activo}
                        aria-label={t('auditoria.actividad.barra', { dia: diaCorto(dia.inicio.toISOString()), total: dia.total, fallidas: dia.fallidas })}
                        onClick={() => onSeleccionar(activo ? null : dia.clave, dia.inicio)}
                        className={cn(
                          'group flex h-full w-full cursor-pointer flex-col justify-end rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                          activo && 'ring-2 ring-primary ring-offset-1 ring-offset-surface',
                        )}
                      >
                        {dia.total === 0 ? (
                          <span aria-hidden className="block h-0.5 w-full rounded-full bg-border-strong" />
                        ) : (
                          <span aria-hidden className="flex w-full flex-col overflow-hidden rounded-t-[2px]" style={{ height: `${Math.max(6, alto)}%` }}>
                            <span className="block w-full flex-1 bg-faint transition-colors duration-(--duration-micro) group-hover:bg-muted" />
                            {dia.fallidas > 0 && <span className="block w-full bg-critical" style={{ height: `${altoFallidas}%` }} />}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ol>
              <div aria-hidden className="mt-1.5 flex items-center justify-between gap-2 text-micro text-faint">
                <span>{desde}</span>
                <span>{hasta}</span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="nums mt-1 text-meta text-faint">{t('auditoria.actividad.base', { n: registros.length })}</p>
    </section>
  )
}
