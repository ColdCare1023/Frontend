import type { ReactNode } from 'react'

/**
 * A quiet, scoped working surface for records and review screens. The page title keeps the size of
 * every other screen (PageHeader); only tables get a slightly denser row.
 */
export function CompactWorkspace({ children }: { children: ReactNode }) {
  return <div className="space-y-5 [&>div:first-child]:mb-6 [&>div:first-child]:border-0 [&>div:first-child]:pb-0 [&_td]:py-3 [&_button]:shadow-none">{children}</div>
}
