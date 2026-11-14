import { useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Eye, EyeOff } from 'lucide-react'

import { PASSWORD_MIN_CARACTERES } from '@/domain/value-objects/politicaPassword'
import { cn } from '@/lib/utils'

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
            className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
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
      {/* Requisitos en vivo: los mismos que valida el backend (PasswordNueva). */}
      <ul id="requisitos-password" aria-label={t('restablecerContrasena.requisitos')} className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        <Requisito cumple={password.length >= PASSWORD_MIN_CARACTERES} texto={t('restablecerContrasena.reglas.longitud')} />
        <Requisito
          cumple={/\p{L}/u.test(password) && /\d/.test(password)}
          texto={t('restablecerContrasena.reglas.combinacion')}
        />
      </ul>
    </>
  )
}

function Requisito({ cumple, texto }: { cumple: boolean; texto: string }) {
  const { t } = useTranslation()
  return (
    <li className={cn('flex items-center gap-1.5', cumple ? 'text-success-700' : 'text-muted')}>
      <span
        aria-hidden
        className={cn(
          'relative flex size-4 items-center justify-center rounded-full ring-1 ring-inset',
          cumple ? 'bg-success-100 ring-success-600/40' : 'ring-border-strong',
        )}
      >
        <Check
          className={cn(
            'size-2.5 transition-[opacity,transform] duration-(--duration-ui) ease-(--ease-ui)',
            cumple ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
          strokeWidth={3}
        />
      </span>
      <span>{texto}</span>
      <span className="sr-only">{cumple ? t('restablecerContrasena.reglas.cumple') : t('restablecerContrasena.reglas.pendiente')}</span>
    </li>
  )
}
