import { useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, KeyRound } from 'lucide-react'

import { Input, Label } from '../ui/input'

/**
 * FE-004: contraseña nueva + confirmación con la política del backend.
 * Compartido por el restablecimiento con enlace y el cambio de contraseña.
 */
export function CamposPasswordNueva({
  password,
  confirmacion,
  onPassword,
  onConfirmacion,
  passwordRef,
}: {
  password: string
  confirmacion: string
  onPassword: (valor: string) => void
  onConfirmacion: (valor: string) => void
  passwordRef?: RefObject<HTMLInputElement | null>
}) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="nueva-password">{t('restablecerContrasena.passwordNueva')}</Label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id="nueva-password"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            className="pr-12"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            aria-describedby="requisitos-password"
            required
          />
          <button
            type="button"
            className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
            aria-label={t(visible ? 'login.ocultarPassword' : 'login.mostrarPassword')}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmar-password">{t('restablecerContrasena.passwordConfirmacion')}</Label>
        <Input
          id="confirmar-password"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => onConfirmacion(e.target.value)}
          required
        />
      </div>
      <p id="requisitos-password" className="flex items-center gap-1.5 text-xs text-muted">
        <KeyRound className="size-3.5 shrink-0 text-faint" aria-hidden />
        <span>{t('restablecerContrasena.requisitos')}</span>
      </p>
    </>
  )
}
