import { useTranslation } from 'react-i18next'

import type { Usuario } from '@/domain/entities/Usuario'
import { fechaCorta } from '@/lib/formato'

/** «Farmacéutica Demo» → «FD». */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  return (partes.slice(0, 2).map((p) => p.charAt(0)).join('') || '?').toUpperCase()
}

export function useMotivoFecha() {
  const { t } = useTranslation()
  return (u: Usuario) =>
    u.motivo_desactivacion
      ? t('usuarios.motivoFecha', {
          motivo: t(`usuarios.motivos.${u.motivo_desactivacion}`, { defaultValue: u.motivo_desactivacion }),
          fecha: fechaCorta(u.desactivado_en),
        })
      : null
}
