import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'

import { ColdCareBrand } from '../ColdCareBrand'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { ThemeSwitcher } from '../ThemeSwitcher'

interface AuthShellProps {
  brandPanel?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Composición compartida por los flujos públicos de cuenta: lienzo de marca a
 * la izquierda (oscuro en ambos temas) y formulario a la derecha. El formulario
 * entra con un desplazamiento mínimo, pero sus controles responden desde el
 * primer fotograma: la animación nunca bloquea el acceso.
 */
export function AuthShell({ brandPanel, children, className }: AuthShellProps) {
  const { t } = useTranslation()
  return (
    <main className="min-h-dvh w-full bg-background">
      <div className={cn('grid min-h-dvh w-full grid-cols-1 content-start lg:content-normal', brandPanel && 'lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]', className)}>
        {brandPanel && <div className="hidden min-w-0 lg:sticky lg:top-0 lg:block lg:h-dvh lg:self-start">{brandPanel}</div>}
        <section className="relative isolate flex min-h-dvh min-w-0 flex-col">
          <div className="flex items-center justify-end gap-1 px-3 pt-3 sm:px-6 lg:absolute lg:inset-x-0 lg:top-0 lg:px-8 lg:pt-5">
            {brandPanel ? (
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button type="button" aria-label={t('lectura.acerca')} className="mr-auto inline-flex min-h-11 items-center gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-ring lg:hidden">
                    <ColdCareBrand />
                    <ChevronDown aria-hidden className="size-3.5 text-faint" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content align="start" sideOffset={6} collisionPadding={12} aria-label={t('lectura.acerca')} className="flotante z-50 w-[min(20rem,calc(100vw-1.5rem))] space-y-3 rounded-(--radius-modal) p-4 text-body text-foreground lg:hidden">
                    <p>{t('login.descripcion')}</p>
                    <p className="text-meta text-muted">{t('login.rangoReferencia')} · 2–8 °C</p>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ) : <ColdCareBrand className="mr-auto" />}
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
          <div className="flex flex-1 items-center px-6 pt-3 pb-10 sm:px-9 lg:px-12 lg:py-16">
            {/* El formulario va directo sobre la página, sin tarjeta. */}
            <div className="mx-auto w-full max-w-[400px]">{children}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
