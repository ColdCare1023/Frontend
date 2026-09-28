import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TableProperties } from 'lucide-react'

/**
 * Alternativa textual a una gráfica (WCAG 1.1.1).
 *
 * Etiquetar el `<canvas>` con `role="img"` da un nombre, no los datos: «Curva
 * térmica de las últimas 60 lecturas» no permite auditar una excursión. Esta
 * tabla expone las mismas series en HTML real, navegable celda a celda.
 *
 * Va dentro de un `<details>` y no siempre visible por una razón de UX, no de
 * accesibilidad: sesenta filas debajo de cada gráfica arruinarían la lectura de
 * un vistazo del dashboard, y `<details>` es un patrón nativo, operable por
 * teclado y anunciado como «contraído/expandido» sin ARIA adicional.
 */
export function TablaAlternativa({
  id,
  titulo,
  columnas,
  filas,
}: {
  id?: string
  titulo: string
  columnas: string[]
  filas: Array<Array<string | number>>
}) {
  const { t } = useTranslation()
  // El contenido se monta solo al desplegar. En el dashboard llega una lectura
  // cada pocos segundos y la serie tiene 60 puntos: mantener 60 filas montadas
  // significaría reconstruirlas en cada evento SSE para algo que nadie está
  // mirando. `<details>` conserva su semántica: el navegador sigue anunciando
  // «contraído/expandido» aunque el interior esté vacío.
  const [abierto, setAbierto] = useState(false)

  if (filas.length === 0) return null

  return (
    <details
      id={id}
      open={abierto}
      onToggle={(evento) => setAbierto(evento.currentTarget.open)}
      className="mt-4 border-t border-border pt-3"
    >
      <summary className="inline-flex cursor-pointer items-center gap-2 rounded-(--radius-field) text-[13px] font-medium text-pine-600 hover:text-pine-700">
        <TableProperties className="size-3.5" aria-hidden />
        {t('comunes.verDatosGrafica')}
      </summary>
      {abierto && (
      <div className="mt-3 max-h-72 overflow-auto rounded-(--radius-field) border border-border">
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">{titulo}</caption>
          <thead className="sticky top-0 bg-cream-100">
            <tr>
              {columnas.map((columna) => (
                <th
                  key={columna}
                  scope="col"
                  className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint"
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
                  <td key={columna} className="nums px-3 py-1.5">
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
}
