import { useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { Input, Label } from '../ui/input'
import { CAMPO_ACCESO } from './clasesAcceso'
import { BotonVerClave } from './PiezasAcceso'

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
  errorId,
}: {
  password: string
  confirmacion: string
  onPassword: (valor: string) => void
  onConfirmacion: (valor: string) => void
  passwordRef?: RefObject<HTMLInputElement | null>
  /** Con un error de la contraseña nueva: id del aviso que lo explica. */
  errorId?: string
}) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  return (
    <>
      <div>
        <Label htmlFor="nueva-password">{t('restablecerContrasena.passwordNueva')}</Label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id="nueva-password"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            className={cn(CAMPO_ACCESO, 'pr-13 sm:pr-13')}
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            aria-invalid={Boolean(errorId)}
            aria-describedby={errorId ? `requisitos-password ${errorId}` : 'requisitos-password'}
            required
          />
          <BotonVerClave visible={visible} onAlternar={() => setVisible((v) => !v)} />
        </div>
        <p id="requisitos-password" className="mt-1.5 text-[13px] leading-5 text-faint">
          {t('restablecerContrasena.requisitos')}
        </p>
      </div>
      <div>
        <Label htmlFor="confirmar-password">{t('restablecerContrasena.passwordConfirmacion')}</Label>
        <Input
          id="confirmar-password"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          className={CAMPO_ACCESO}
          value={confirmacion}
          onChange={(e) => onConfirmacion(e.target.value)}
          aria-invalid={Boolean(errorId)}
          aria-describedby={errorId}
          required
        />
      </div>
    </>
  )
}
