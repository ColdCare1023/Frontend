import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ShieldQuestion } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { Button } from './ui/button'

/** HU-44 / FE-005: consentimiento explícito de la Ley N.° 29733, no
 * descartable — sin `Escape`, sin clic fuera, sin botón de cerrar. El backend
 * (BE-014) no presume el consentimiento: hasta aceptarlo responde 403 a todo.
 * Rechazar revoca la sesión en el servidor y la cierra en el cliente. */
export function PrivacyConsentModal() {
  const { t } = useTranslation()
  const requierePrivacidad = useAuthStore((s) => s.requierePrivacidad)
  const aceptarPrivacidad = useAuthStore((s) => s.aceptarPrivacidad)
  const rechazarPrivacidad = useAuthStore((s) => s.rechazarPrivacidad)
  const [procesando, setProcesando] = useState<'aceptar' | 'rechazar' | null>(null)
  const [error, setError] = useState(false)

  if (!requierePrivacidad) return null

  const aceptar = async () => {
    setProcesando('aceptar')
    setError(false)
    try {
      await aceptarPrivacidad()
    } catch {
      setError(true)
    } finally {
      setProcesando(null)
    }
  }

  const rechazar = async () => {
    setProcesando('rechazar')
    try {
      await rechazarPrivacidad()
    } finally {
      setProcesando(null)
    }
  }

  return (
    <DialogPrimitive.Root open modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="velo-dialogo z-[60] data-[state=open]:animate-fade" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby="privacidad-descripcion"
          className="flotante fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-[60] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md -translate-x-1/2 overflow-y-auto rounded-(--radius-modal) border p-6 data-[state=open]:animate-(--animate-dialog-in) sm:bottom-auto sm:top-1/2 sm:max-h-[85dvh] sm:w-[calc(100vw-2rem)] sm:-translate-y-1/2"
        >
          <div className="mb-3 flex items-center gap-2.5">
            <ShieldQuestion className="size-5 text-instrumento" aria-hidden />
            <DialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight text-foreground">
              {t('privacidad.titulo')}
            </DialogPrimitive.Title>
          </div>
          <DialogPrimitive.Description id="privacidad-descripcion" className="text-sm text-muted">
            {t('privacidad.descripcion')}
          </DialogPrimitive.Description>

          {error && (
            <p role="alert" className="mt-3 rounded-(--radius-field) bg-clay-100 px-3 py-2 text-[13px] text-clay-700">
              {t('privacidad.errorAceptar')}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => void rechazar()} disabled={procesando !== null}>
              {procesando === 'rechazar' ? t('privacidad.rechazando') : t('privacidad.rechazar')}
            </Button>
            <Button onClick={() => void aceptar()} disabled={procesando !== null}>
              {procesando === 'aceptar' ? t('privacidad.aceptando') : t('privacidad.aceptar')}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
