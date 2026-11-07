import { useEffect, useState } from 'react'

import { TAMANO_PAGINA } from '@/lib/paginacion'

const TAMANO_PAGINA_MOVIL = 5
const BREAKPOINT_MOVIL = '(max-width: 639px)'

function tamanoActual(): number {
  if (typeof window.matchMedia !== 'function') return TAMANO_PAGINA
  return window.matchMedia(BREAKPOINT_MOVIL).matches ? TAMANO_PAGINA_MOVIL : TAMANO_PAGINA
}

/** Keep dense record screens short on phones while preserving desktop density. */
export function useResponsivePageSize(): number {
  // Se lee antes del primer render: en un teléfono no pinta la tabla larga para recortarla después.
  const [tamano, setTamano] = useState(tamanoActual)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(BREAKPOINT_MOVIL)
    const actualizar = () => setTamano(media.matches ? TAMANO_PAGINA_MOVIL : TAMANO_PAGINA)
    media.addEventListener('change', actualizar)
    return () => media.removeEventListener('change', actualizar)
  }, [])

  return tamano
}
