import { useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'

import { useAlertas } from '@/application/hooks/useAlertas'
import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { puedeVerRuta } from '../../layouts/navegacion'
import { FrasePendientes } from '../alertas/FrasePendientes'

// Reconocer una alerta no llega por SSE: se repasa con calma, como la isla.
const REPASO_MS = 30_000

/** Solo para quien puede abrir Alertas: el resto no consulta nada. */
export function LlamadaAlertas() {
  const rol = useAuthStore((s) => s.usuario?.rol)
  if (!rol || !puedeVerRuta(rol, '/alertas')) return null
  return <Llamada rol={rol} />
}

/**
 * «Tienes 3 alertas por revisar →». Solo aparece si hay pendientes y se sabe cuántas: mientras
 * carga o si falla no dice «cero».
 */
function Llamada({ rol }: { rol: Rol }) {
  const { alertas, errorCarga, reintentar } = useAlertas()

  useEffect(() => {
    const repaso = window.setInterval(() => {
      if (!document.hidden) reintentar()
    }, REPASO_MS)
    return () => window.clearInterval(repaso)
  }, [reintentar])

  const pendientes = alertas.filter((alerta) => alerta.estado === 'pendiente')
  if (errorCarga || pendientes.length === 0) return null
  const critica = pendientes.some((alerta) => alerta.nivel_riesgo === 'excursion_critica')

  return (
    <Link to="/alertas" className="llamada-alertas capsula tema-capsula realce animate-fade" data-critica={critica || undefined}>
      <span aria-hidden className="llamada-alertas__punto" />
      <span className="min-w-0">
        <FrasePendientes
          n={pendientes.length}
          puedeReconocer={tienePermiso(rol, ['farmaceutico'])}
          puedeRegistrar={tienePermiso(rol, ['farmaceutico', 'tecnico'])}
        />
      </span>
      <ArrowRight aria-hidden className="size-4 shrink-0" />
    </Link>
  )
}
