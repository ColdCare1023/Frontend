import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import type { LecturaTermica } from '@/domain/entities/LecturaTermica'
import { localeActual } from '@/lib/formato'
import { resumir, tituloDeDia, type DiaDeLecturas } from './agrupar'
import { TablaLecturas } from './TablaLecturas'

/**
 * Las lecturas de un día, con su encabezado. `todas` son las del día en toda la consulta (la cifra no
 * cambia al pasar de página); `dia.lecturas` son las de la página visible.
 */
export function LecturasDelDia({
  dia,
  todas,
  mostrarCabecera,
  onVerEvidencia,
}: {
  dia: DiaDeLecturas
  todas: LecturaTermica[]
  /** Los nombres de columna se ven en el primer día; en los demás siguen para el lector de pantalla. */
  mostrarCabecera: boolean
  onVerEvidencia: (lectura: LecturaTermica) => void
}) {
  const { t } = useTranslation()
  const idTitulo = useId()
  const resumen = resumir(todas)
  const titulo = tituloDeDia(dia.clave, t)
  const completa = new Date(`${dia.clave}T12:00:00`).toLocaleDateString(localeActual(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <section aria-labelledby={idTitulo} className="dia-lecturas">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 id={idTitulo} className="dia-lecturas__titulo first-letter:uppercase">{titulo}</h3>
          <p className="mt-1 text-[13.5px] leading-5 text-muted first-letter:uppercase">{completa}</p>
        </div>
        <div className="flex items-baseline justify-between gap-x-4 max-sm:w-full sm:block sm:text-right">
          {resumen.minima !== null && resumen.maxima !== null && (
            <p className="dia-lecturas__rango nums text-foreground">
              {resumen.minima === resumen.maxima ? resumen.maxima.toFixed(1) : `${resumen.minima.toFixed(1)}–${resumen.maxima.toFixed(1)}`}
              <span className="ml-1 text-sm font-semibold tracking-normal text-muted">°C</span>
            </p>
          )}
          <p className="nums mt-1 text-[13.5px] leading-5 text-muted">
            {t('historial.lecturasDia', { count: resumen.total })}
            {resumen.fueraDeRango > 0 && (
              <span className="ml-2 font-semibold text-critical">{t('historial.fueraDeRangoDia', { count: resumen.fueraDeRango })}</span>
            )}
          </p>
        </div>
      </header>

      <TablaLecturas
        titulo={`${t('historial.titulo')} · ${titulo}`}
        lecturas={dia.lecturas}
        mostrarCabecera={mostrarCabecera}
        onVerEvidencia={onVerEvidencia}
      />
    </section>
  )
}
