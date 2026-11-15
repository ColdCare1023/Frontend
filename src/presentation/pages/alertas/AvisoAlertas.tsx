import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

import { Button } from '../../components/ui/button'

export type Aviso =
  | { tipo: 'conflicto' }
  | { tipo: 'errorRevisar'; equipo: string }
  /** 403 al reconocer: el rol ya no lo permite (p. ej. cambió durante la sesión). */
  | { tipo: 'prohibido' }
  /** HU-52: el `?id` del enlace del correo no está entre las alertas consultadas. */
  | { tipo: 'enlaceNoEncontrado' }

function textoAviso(aviso: Aviso, t: (clave: string, opciones?: Record<string, unknown>) => string): string {
  switch (aviso.tipo) {
    case 'conflicto':
      return t('alertas.conflictoEstado')
    case 'errorRevisar':
      return t('alertas.errorRevisar', { equipo: aviso.equipo })
    case 'prohibido':
      return t('alertas.soloFarmaceutico')
    case 'enlaceNoEncontrado':
      return t('alertas.enlaceNoEncontrado')
  }
}

/**
 * Avisos de página sobre la lista. El conflicto (HU-27 Esc. 2) vive aquí y no
 * en la fila: la fila puede desaparecer al refrescar y el aviso se perdería
 * con ella. Se cierra con la X o con la siguiente acción, nunca por tiempo.
 */
export function AvisoAlertas({
  aviso,
  onCerrar,
  errorRefresco,
  horaDatos,
  onReintentar,
}: {
  aviso: Aviso | null
  onCerrar: () => void
  errorRefresco: boolean
  horaDatos: string | null
  onReintentar: () => void
}) {
  const { t } = useTranslation()
  if (!aviso && !errorRefresco) return null
  return (
    <div className="space-y-2">
      {aviso &&
        (aviso.tipo === 'enlaceNoEncontrado' ? (
          // Informativo: no es un fallo de la acción del usuario.
          <div role="status" className="flex items-start gap-2 rounded-(--radius-field) bg-warning-100 py-2 pr-1 pl-3 text-body text-warning-700">
            <p className="min-w-0 flex-1 py-1">{textoAviso(aviso, t)}</p>
            <Button variant="ghost" size="sm" aria-label={t('alertas.cerrarAviso')} className="w-11 shrink-0 px-0 text-warning-700 sm:w-9" onClick={onCerrar}>
              <X aria-hidden />
            </Button>
          </div>
        ) : (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-(--radius-field) bg-critical-tint py-2 pr-1 pl-3 text-body text-critical"
          >
            <p className="min-w-0 flex-1 py-1">{textoAviso(aviso, t)}</p>
            <Button variant="ghost" size="sm" aria-label={t('alertas.cerrarAviso')} className="w-11 shrink-0 px-0 text-critical sm:w-9" onClick={onCerrar}>
              <X aria-hidden />
            </Button>
          </div>
        ))}
      {errorRefresco && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-(--radius-field) bg-warning-100 py-2 pr-2 pl-3 text-body text-warning-700">
          <p className="min-w-0 flex-1">{t('alertas.refrescoError', { hora: horaDatos ?? '—' })}</p>
          <Button variant="secondary" size="sm" onClick={onReintentar}>
            {t('comunes.reintentar')}
          </Button>
        </div>
      )}
    </div>
  )
}
