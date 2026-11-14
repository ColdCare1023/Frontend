import { useMemo } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronRight, Menu as MenuIcono } from 'lucide-react'

import { ColdCareBrand } from '../../components/ColdCareBrand'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { ThemeSwitcher } from '../../components/ThemeSwitcher'
import { PildoraEstado } from '../../components/estado-vivo/PildoraEstado'
import { ubicarRuta } from '../../navegacion'
import { AvisoDatosSimulados } from './AvisoDatosSimulados'
import { MenuUsuario } from './MenuUsuario'

/** Fecha de hoy, memorizada por día e idioma (sin reloj en la cabecera). */
function useFechaHoy(idioma: string) {
  const dia = new Date().toDateString()
  return useMemo(
    () => new Date(dia).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-PE', { weekday: 'long', day: 'numeric', month: 'long' }),
    [dia, idioma],
  )
}

/**
 * Cabecera de 56 px, sólida y sin desenfoque (DIRECTION §7–8). De izquierda a
 * derecha: menú (< 1024) o ruta «Sección › Página» con la fecha (≥ 1280),
 * la píldora en vivo (centrada en móvil), el chip de datos simulados, idioma
 * y tema (≥ 640) y, sin riel, el menú de usuario.
 *
 * Debe vivir dentro del `DialogPrimitive.Root` del cajón móvil.
 */
export function Cabecera({ conRiel, preferenciasEnMenu }: { conRiel: boolean; preferenciasEnMenu: boolean }) {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const ubicacion = ubicarRuta(pathname)
  const fechaHoy = useFechaHoy(i18n.language)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-6 lg:px-6 xl:px-8">
      <DialogPrimitive.Trigger
        aria-label={t('nav.abrirMenu')}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-field) text-muted transition-colors duration-(--duration-micro) hover:bg-surface-hover hover:text-foreground lg:hidden"
      >
        <MenuIcono className="size-5" aria-hidden />
      </DialogPrimitive.Trigger>
      <ColdCareBrand className="shrink-0 max-[359px]:hidden lg:hidden [&_svg]:size-8 [&>div]:hidden sm:[&>div]:block" />

      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <p className="flex min-w-0 items-center gap-1.5 text-body">
          {ubicacion && (
            <>
              <span className="truncate text-faint">{t(ubicacion.seccion.claveI18n)}</span>
              <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />
            </>
          )}
          <span className="truncate font-semibold text-foreground">{ubicacion ? t(ubicacion.item.claveI18n) : t('app.nombre')}</span>
        </p>
        <span aria-hidden className="hidden h-4 w-px bg-border xl:block" />
        <p className="hidden text-xs text-faint first-letter:uppercase xl:block">{fechaHoy}</p>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-end">
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
