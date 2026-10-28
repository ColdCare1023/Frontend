import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { ThemeSwitcher } from '../ThemeSwitcher'

interface AuthShellProps {
  brandPanel: ReactNode
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
  return (
    <main className="min-h-dvh w-full bg-background">
      <div className={cn('grid min-h-dvh w-full grid-cols-1 content-start lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:content-normal', className)}>
        <div className="min-w-0 lg:sticky lg:top-0 lg:h-dvh lg:self-start">{brandPanel}</div>
        <section className="relative isolate flex min-w-0 flex-col">
          <div aria-hidden className="rejilla-puntos pointer-events-none absolute inset-0 -z-10" />
          <div className="flex items-center justify-end gap-1 px-3 pt-3 sm:px-6 lg:absolute lg:inset-x-0 lg:top-0 lg:px-8 lg:pt-5">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
          <div className="flex flex-1 items-center px-5 pb-10 pt-3 sm:px-9 lg:px-12 lg:py-16 xl:px-16">
            {/* El formulario va directo sobre la página, sin tarjeta. */}
            <div className="mx-auto w-full max-w-[424px] animate-(--animate-rise-lg) [animation-delay:90ms]">{children}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
