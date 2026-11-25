import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Menu as MenuIcono } from 'lucide-react'

import { ColdCareBrand } from '../../components/ColdCareBrand'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { ThemeSwitcher } from '../../components/ThemeSwitcher'
import { PildoraEstado } from '../../components/estado-vivo/PildoraEstado'
import { AvisoDatosSimulados } from './AvisoDatosSimulados'
import { MenuUsuario } from './MenuUsuario'

export function Cabecera({ conRiel, preferenciasEnMenu }: { conRiel: boolean; preferenciasEnMenu: boolean }) {
  const { t } = useTranslation()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-6 lg:px-6 xl:px-8">
      <DialogPrimitive.Trigger
        aria-label={t('nav.abrirMenu')}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-field) text-muted transition-colors duration-(--duration-micro) hover:bg-surface-hover hover:text-foreground lg:hidden"
      >
        <MenuIcono className="size-5" aria-hidden />
      </DialogPrimitive.Trigger>
      <ColdCareBrand className="shrink-0 max-[359px]:hidden lg:hidden [&_svg]:size-8 [&>div]:hidden sm:[&>div]:block" />

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-end lg:justify-start">
        <PildoraEstado />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <AvisoDatosSimulados />
        <div className="hidden items-center gap-0.5 sm:flex">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
        {!conRiel && <MenuUsuario variante="cabecera" conPreferencias={preferenciasEnMenu} />}
      </div>
    </header>
  )
}
