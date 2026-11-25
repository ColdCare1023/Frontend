import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import { Info } from 'lucide-react'

export function PageHeader({
  titulo,
  descripcion,
  meta,
  children,
}: {
  eyebrow?: string
  titulo: string
  descripcion?: string
  meta?: ReactNode
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const etiquetaAyuda = t('comunes.ayudaPantalla', { pagina: titulo })

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:mb-5">
      <div className="flex min-w-0 flex-1 basis-56 flex-wrap items-center gap-x-3 gap-y-0.5">
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="font-display text-[21px] leading-7 font-semibold tracking-[-0.025em] text-foreground sm:text-page">{titulo}</h1>
          {descripcion && (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button type="button" aria-label={etiquetaAyuda} className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-faint hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:size-11">
                  <Info aria-hidden className="size-4" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content aria-label={etiquetaAyuda} side="bottom" align="start" sideOffset={4} collisionPadding={12} className="flotante z-50 max-w-[min(20rem,calc(100vw-1.5rem))] rounded-(--radius-field) px-4 py-3 text-body text-foreground">
                  {descripcion}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
        </div>
        {meta && <p className="nums text-meta text-faint">{meta}</p>}
      </div>
      {children && <div className="flex max-w-full flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
