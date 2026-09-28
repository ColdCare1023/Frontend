import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// i18next se inicializa una vez para todo el archivo de pruebas: los
// componentes se afirman por su texto traducido real, no por claves, así que
// una regresión en las traducciones también rompe la prueba.
import '@/infrastructure/i18n'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
})

// jsdom no implementa `matchMedia`; varios componentes de Radix lo consultan al
// montar y sin este doble lanzarían antes de renderizar nada.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})
