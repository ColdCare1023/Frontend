import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FirmwareRelease } from '@/domain/entities/Firmware'

const useFirmware = vi.hoisted(() => vi.fn())
vi.mock('@/application/hooks/useFirmware', () => ({ useFirmware }))

import { FirmwarePage } from '@/presentation/pages/FirmwarePage'

function release(over: Partial<FirmwareRelease> = {}): FirmwareRelease {
  return {
    id: 'f-1',
    version: '1.2.0',
    hash_sha256: 'e'.repeat(64),
    descripcion: 'Corrige el drenaje del buffer offline',
    fecha_compilacion: '2026-07-25T08:00:00Z',
    ...over,
  }
}

function montar(releases: FirmwareRelease[]) {
  useFirmware.mockReturnValue({
    releases,
    cargando: false,
    consultar: vi.fn(),
    prepararRelease: vi.fn(),
    programarDespliegue: vi.fn(),
    ejecutarDespliegue: vi.fn(),
  })
  render(<FirmwarePage />)
}

describe('FirmwarePage (HU-46)', () => {
  beforeEach(() => useFirmware.mockReset())

  it('lista las releases con su versión y descripción', () => {
    montar([release()])

    expect(screen.getByText('1.2.0')).toBeInTheDocument()
    expect(screen.getByText(/buffer offline/i)).toBeInTheDocument()
  })

  it('expone el hash SHA-256 de la release', () => {
    // Sin el hash a la vista no hay forma de comprobar que el binario
    // desplegado es el que se aprobó: es el control anti-manipulación de HU-46.
    montar([release()])

    // La celda muestra el prefijo truncado y, además, el hash completo como
    // texto para lector de pantalla: cotejar un binario exige los 64
    // caracteres, no los 12 primeros.
    expect(screen.getAllByText(new RegExp('e'.repeat(8))).length).toBeGreaterThan(0)
    expect(screen.getByText('e'.repeat(64))).toBeInTheDocument()
  })

  it('avisa cuando no hay releases preparadas', () => {
    montar([])
    expect(screen.getByText(/no hay releases/i)).toBeInTheDocument()
  })
})
