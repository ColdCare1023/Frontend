import { useCallback, useEffect, useState } from 'react'

import type { RegistroAuditoria } from '@/domain/entities/Usuario'
import { apiClient } from '@/infrastructure/api/apiClient'

// HU-50 criterio 1: el panel de seguridad debe poder filtrar por periodo,
// usuario o tipo — el backend ya expone estos filtros en `GET /api/auditoria`
// (`desde`, `hasta`, `usuario_id`, `accion`) pero ningún consumidor los usaba.
export interface FiltrosAuditoria {
  desde?: string
  hasta?: string
  usuario_id?: string
  accion?: string
}

export function useAuditoria() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [cargando, setCargando] = useState(true)

  const consultar = useCallback(async (filtros: FiltrosAuditoria = {}) => {
    setCargando(true)
    try {
      const params: Record<string, string> = { limite: '200' }
      if (filtros.desde) params.desde = new Date(filtros.desde).toISOString()
      if (filtros.hasta) params.hasta = new Date(filtros.hasta).toISOString()
      if (filtros.usuario_id) params.usuario_id = filtros.usuario_id
      if (filtros.accion) params.accion = filtros.accion
      const { data } = await apiClient.get<RegistroAuditoria[]>('/api/auditoria', { params })
      setRegistros(data)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  return { registros, cargando, consultar }
}
