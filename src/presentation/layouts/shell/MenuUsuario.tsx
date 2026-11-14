import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronsUpDown, KeyRound, LogOut } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { cn } from '@/lib/utils'
import { OpcionesIdioma } from '../../components/LanguageSwitcher'
import { OpcionesTema } from '../../components/ThemeSwitcher'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../../components/ui/menu'
import { Tooltip } from '../../components/ui/tooltip'

/**
 * Cuenta del usuario: datos, cambio de contraseña (FE-004) y cierre de
 * sesión. Con riel (≥ 1024) vive al pie del riel con correo y rol; en
 * pantallas menores, en la cabecera como avatar. Bajo 640 px también lleva
 * idioma y tema, que salen de la cabecera. El nombre del disparador empieza
 * siempre por «Menú de usuario».
 */
export function MenuUsuario({
  variante,
  compacto = false,
  conPreferencias = false,
}: {
  variante: 'riel' | 'cabecera'
  compacto?: boolean
  /** Idioma y tema dentro del menú (bajo 640 px). */
  conPreferencias?: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const logout = useAuthStore((s) => s.logout)
  if (!usuario) return null
  const inicial = usuario.email.charAt(0).toUpperCase()
  const nombre = `${t('nav.menuUsuario')}: ${usuario.email}`

  const avatar = (grande = false) => (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary-tint font-semibold text-primary-text',
        grande ? 'size-9 text-body' : 'size-8 text-meta',
      )}
    >
      {inicial}
    </span>
  )

  const disparador =
    variante === 'riel' ? (
      <button
        type="button"
        aria-label={nombre}
        className={cn(
          'flex h-12 w-full cursor-pointer items-center gap-3 rounded-(--radius-field) px-2 text-left transition-colors duration-(--duration-micro) hover:bg-surface-hover data-[state=open]:bg-surface-hover',
          compacto && 'justify-center px-0',
        )}
      >
        {avatar()}
        <span className={cn('min-w-0 flex-1 leading-tight transition-opacity duration-(--duration-press)', compacto && 'sr-only')}>
          <span className="block truncate text-meta font-medium text-foreground">{usuario.email}</span>
          <span className="block truncate text-meta text-faint">{t(`roles.${usuario.rol}`)}</span>
        </span>
        {!compacto && <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-faint" />}
      </button>
    ) : (
      <button
        type="button"
        aria-label={nombre}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-(--duration-micro) hover:bg-surface-hover data-[state=open]:bg-surface-hover"
      >
        {avatar()}
      </button>
    )

  return (
    <Menu>
      {variante === 'riel' && compacto ? (
        <Tooltip contenido={usuario.email}>
          <MenuTrigger asChild>{disparador}</MenuTrigger>
        </Tooltip>
      ) : (
        <MenuTrigger asChild>{disparador}</MenuTrigger>
      )}
      <MenuContent className="w-64" side={variante === 'riel' ? (compacto ? 'right' : 'top') : 'bottom'} align="end">
        <div className="flex items-center gap-3 px-2.5 py-2">
          {avatar(true)}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-meta font-medium text-foreground">{usuario.email}</p>
            <p className="mt-1 text-meta text-faint">{t(`roles.${usuario.rol}`)}</p>
          </div>
        </div>
        <MenuSeparator />
        {conPreferencias && (
          <>
            <OpcionesIdioma />
            <MenuSeparator />
            <OpcionesTema />
            <MenuSeparator />
          </>
        )}
        <MenuItem onSelect={() => void navigate('/cambiar-password')}>
          <KeyRound className="text-faint" aria-hidden />
          {t('cambiarPassword.menu')}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            logout()
            void navigate('/login', { replace: true })
          }}
        >
          <LogOut className="text-faint" aria-hidden />
          {t('nav.cerrarSesion')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
