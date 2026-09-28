import { useCallback, useEffect, useState } from 'react'

import type { ChecklistBPA, ChecklistBPARequest } from '@/domain/entities/ChecklistBPA'
import { apiClient } from '@/infrastructure/api/apiClient'

/**
 * HU-37: el checklist BPA vive en el backend, no en `localStorage`.
 *
 * Con almacenamiento local la declaración se perdía al cambiar de navegador o
 * limpiar la caché, no podía auditarse y no dejaba rastro en la cadena de
 * trazabilidad — es decir, no servía como evidencia de cumplimiento.
 */
export function useChecklistBPA() {
  const [checklist, setChecklist] = useState<ChecklistBPA | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorCarga, setErrorCarga] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga(false)
    try {
      // El backend devuelve `null` (no 404) cuando aún no se registró hoy:
      // "todavía sin verificar" es un estado normal del flujo diario.
      const { data } = await apiClient.get<ChecklistBPA | null>('/api/checklist-bpa')
      setChecklist(data ?? null)
    } catch {
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardar = useCallback(async (payload: ChecklistBPARequest): Promise<boolean> => {
    setGuardando(true)
    setErrorGuardado(false)
    try {
      const { data } = await apiClient.post<ChecklistBPA>('/api/checklist-bpa', payload)
      setChecklist(data)
      return true
    } catch {
      setErrorGuardado(true)
      return false
    } finally {
      setGuardando(false)
    }
  }, [])

  return { checklist, cargando, guardando, errorCarga, errorGuardado, cargar, guardar }
}
