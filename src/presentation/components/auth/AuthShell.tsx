import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { IdiomaDiferido, TemaDiferido } from './SelectoresDiferidos'
import './acceso.css'

interface AuthShellProps {
  brandPanel: ReactNode
  children: ReactNode
  className?: string
}

const CONTROL_EN_CAPSULA =
  'rounded-full text-white/85 hover:bg-white/12 hover:text-white focus-visible:outline-white data-[state=open]:bg-white/12 data-[state=open]:text-white'

/**
 * Composición de los flujos públicos de cuenta: la foto aprobada y, encima, una hoja con
 * el formulario, sin tarjeta. Idioma y tema flotan en una cápsula negra, como en la
 * landing. Sin animación de entrada: los controles responden desde el primer fotograma, aunque su
 * menú se descargue recién al abrirlo.
 */
export function AuthShell({ brandPanel, children, className }: AuthShellProps) {
  return (
    <main className={cn('acceso', className)}>
      {brandPanel}
      <div className="acceso-capsula acceso-controles">
        {/* El menú (Radix y Floating UI) se carga al abrirlo: el acceso pinta antes. */}
        <IdiomaDiferido className={cn(CONTROL_EN_CAPSULA, 'sm:h-10 sm:pointer-coarse:h-11')} />
        <TemaDiferido className={cn(CONTROL_EN_CAPSULA, 'sm:size-10 sm:pointer-coarse:size-11')} />
      </div>
      <section className="acceso-hoja">
        <div className="acceso-hoja__cuerpo">{children}</div>
      </section>
    </main>
  )
}
