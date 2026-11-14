import { Outlet } from 'react-router'

import { useDispositivos } from '@/application/hooks/useDispositivos'
import { ContextoFlota } from './contextoFlota'

/** Dueño de la flota y de sus suscripciones SSE para `/dispositivos/*`. */
export function DispositivosLayout() {
  const flota = useDispositivos()
  return (
    <ContextoFlota.Provider value={flota}>
      <Outlet />
    </ContextoFlota.Provider>
  )
}
