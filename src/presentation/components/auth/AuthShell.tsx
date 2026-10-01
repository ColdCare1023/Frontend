import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AuthShellProps {
  brandPanel: ReactNode
  children: ReactNode
  className?: string
}

/** Full-screen editorial split shared by every public account workflow. */
export function AuthShell({ brandPanel, children, className }: AuthShellProps) {
  return (
    <main className="min-h-dvh w-full bg-surface">
      <div className={cn('grid min-h-dvh w-full grid-cols-1 content-start lg:content-normal lg:grid-cols-[55%_45%]', className)}>
        <div className="min-w-0 lg:sticky lg:top-0 lg:h-dvh lg:self-start">{brandPanel}</div>
        <section className="flex min-w-0 items-center bg-surface px-5 py-7 sm:px-9 lg:min-h-dvh lg:px-10 lg:py-9 xl:px-14">
          <div className="mx-auto w-full max-w-[460px]">{children}</div>
        </section>
      </div>
    </main>
  )
}
