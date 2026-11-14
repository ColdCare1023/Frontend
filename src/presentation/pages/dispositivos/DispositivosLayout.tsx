import { useMemo } from 'react'
import { Outlet } from 'react-router'

import { useAtendidasRecientes } from '@/application/hooks/useAtendidasRecientes'
import { useDispositivos } from '@/application/hooks/useDispositivos'
import { useIncidentesOperativos } from '@/application/hooks/useIncidentesOperativos'
import { useEstadoVivoStore } from '@/application/stores/estadoVivoStore'
import { useRefrescoIncidentes } from '@/presentation/hooks/useRefrescoIncidentes'
import { ContextoActividad, ContextoFlota, type Actividad } from './contextoFlota'

/** Dueño de la flota, de su actividad y de sus suscripciones SSE para `/dispositivos/*`. */
export function DispositivosLayout() {
  const flota = useDispositivos()
  const incidentes = useIncidentesOperativos()
  useRefrescoIncidentes(incidentes.consultar)
  const atendidas = useAtendidasRecientes()
  const pendientes = useEstadoVivoStore((s) => s.alertas?.pendientes)
  const revisadas = useEstadoVivoStore((s) => s.alertas?.revisadas)

  const actividad = useMemo<Actividad>(
    () => ({
      alertas: [...(pendientes ?? []), ...(revisadas ?? []), ...atendidas.alertas],
      incidentes: incidentes.incidentes,
      cargando: incidentes.cargando || atendidas.estado === 'cargando',
      error: incidentes.errorCarga,
    }),
    [pendientes, revisadas, atendidas.alertas, atendidas.estado, incidentes.incidentes, incidentes.cargando, incidentes.errorCarga],
  )

  return (
    <ContextoFlota.Provider value={flota}>
      <ContextoActividad.Provider value={actividad}>
        <Outlet />
      </ContextoActividad.Provider>
    </ContextoFlota.Provider>
  )
}
