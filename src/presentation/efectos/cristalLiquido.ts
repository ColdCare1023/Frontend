import { useRefraction } from '@zakisheriff/liquid-glass'
import '@zakisheriff/liquid-glass/styles.css'

/**
 * Cristal líquido real (@zakisheriff/liquid-glass, MIT): refracción trazada
 * con la ley de Snell sobre un bisel y aplicada al fondo vivo con
 * `feDisplacementMap` (Chromium); Safari y Firefox reciben desenfoque y filo
 * especular horneado. El elemento necesita las clases `lg-glass` (o
 * `lg-glass lg-glass--host`) y el atributo `data-liquid-glass`.
 * Úsese en pocas superficies grandes y estables: el mapa se hornea por tamaño.
 */
// El motor re-hornea al cambiar de tamaño con ResizeObserver; sin él (jsdom en
// las pruebas) el elemento se queda con el esmerilado CSS.
const CON_OBSERVADOR = typeof window !== 'undefined' && typeof window.ResizeObserver === 'function'

export function useCristalLiquido(
  ref: React.RefObject<HTMLElement | null>,
  { intensidad = 0.8, bisel = 14 }: { intensidad?: number; bisel?: number } = {},
) {
  useRefraction(ref, { kind: 'surface', strength: intensidad, bezel: bisel, thickness: Math.round(bisel * 1.5) }, CON_OBSERVADOR)
}
