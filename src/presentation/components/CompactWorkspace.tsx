import type { ReactNode } from 'react'

/** A quiet, scoped working surface for records and review screens. */
export function CompactWorkspace({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col space-y-3 [&>div:first-child]:mb-5 sm:[&>div:first-child]:mb-6">{children}</div>
}
