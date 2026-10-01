import type { ReactNode } from 'react'

/** A quiet, scoped working surface for records and review screens. */
export function CompactWorkspace({ children }: { children: ReactNode }) {
  return <div className="space-y-4 [&>div:first-child]:mb-4 [&>div:first-child]:border-0 [&>div:first-child]:pb-0 [&_h1]:text-2xl [&_h1]:leading-8 [&_.coldcare-table-region]:rounded-lg [&_thead]:bg-cream-100 [&_th]:text-xs [&_td]:py-2.5 [&_button]:shadow-none">{children}</div>
}
