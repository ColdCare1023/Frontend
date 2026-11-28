import { useEffect, useState } from 'react'

import { TAMANO_PAGINA } from '@/lib/paginacion'

const TAMANO_PAGINA_MOVIL = 5
const BREAKPOINT_MOVIL = '(max-width: 639px)'

/** Keep dense record screens short on phones while preserving desktop density. */
export function useResponsivePageSize(tamanoEscritorio = TAMANO_PAGINA): number {
  const [tamano, setTamano] = useState(tamanoEscritorio)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(BREAKPOINT_MOVIL)
    const actualizar = () => setTamano(media.matches ? TAMANO_PAGINA_MOVIL : tamanoEscritorio)
    actualizar()
    media.addEventListener('change', actualizar)
    return () => media.removeEventListener('change', actualizar)
  }, [tamanoEscritorio])

  return tamano
}
