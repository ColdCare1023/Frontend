import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ActionMenu, ActionMenuLabel, ActionMenuSeparator } from '@/presentation/components/ActionMenu'
import { Button } from '@/presentation/components/ui/button'
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelDescription,
  SidePanelHeader,
  SidePanelTitle,
  SidePanelTrigger,
} from '@/presentation/components/ui/side-panel'

describe('ActionMenu con grupos', () => {
  it('muestra los grupos como etiquetas, no como acciones, y marca las peligrosas', async () => {
    const baja = vi.fn()
    render(
      <ActionMenu label="FARM-01">
        <ActionMenuLabel>Equipo</ActionMenuLabel>
        <Button variant="ghost" size="sm">Calibración</Button>
        <ActionMenuSeparator />
        <Button variant="ghost" size="sm" data-peligro onClick={baja}>Dar de baja</Button>
      </ActionMenu>,
    )

    await userEvent.click(screen.getByRole('button', { name: /FARM-01/ }))

    const items = screen.getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Calibración', 'Dar de baja'])
    expect(screen.getByText('Equipo')).not.toHaveAttribute('role', 'menuitem')
    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Dar de baja' })).toHaveAttribute('data-peligro')

    await userEvent.click(screen.getByRole('menuitem', { name: 'Dar de baja' }))
    expect(baja).toHaveBeenCalledOnce()
  })
})

describe('SidePanel', () => {
  it('abre como diálogo etiquetado y se cierra con Escape', async () => {
    render(
      <SidePanel>
        <SidePanelTrigger>Abrir panel</SidePanelTrigger>
        <SidePanelContent>
          <SidePanelHeader>
            <SidePanelTitle>Acción correctiva</SidePanelTitle>
            <SidePanelDescription>Registra lo que hiciste.</SidePanelDescription>
          </SidePanelHeader>
          <SidePanelBody>contenido</SidePanelBody>
        </SidePanelContent>
      </SidePanel>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Abrir panel' }))
    expect(screen.getByRole('dialog', { name: 'Acción correctiva' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
