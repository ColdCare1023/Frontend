import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { codigoDesdeFragmento } from '@/domain/value-objects/codigoVerificacion'
import i18n from '@/infrastructure/i18n'
import { CopiarCodigoPage } from '@/presentation/pages/CopiarCodigoPage'
import { esperarAviso, esperarMicrotasks } from '../../ayudas'

/**
 * Destino del enlace «Copiar código» de los correos. El código llega en el
 * fragmento, se quita de la URL al montar y nunca se registra ni se guarda.
 */
function montar(fragmento: string) {
  window.history.replaceState(null, '', `/copiar-codigo${fragmento}`)
  return render(
    <MemoryRouter initialEntries={['/copiar-codigo']}>
      <Routes>
        <Route path="/copiar-codigo" element={<CopiarCodigoPage />} />
        <Route path="/login" element={<p>pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** jsdom no trae `navigator.clipboard`: cada prueba instala el suyo. */
function instalarPortapapeles(writeText: (texto: string) => Promise<void>) {
  const espia = vi.fn(writeText)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: espia }, configurable: true })
  return espia
}

const sinGesto = () => Promise.reject(new DOMException('Document is not focused.', 'NotAllowedError'))

const digitosVisibles = () => document.getElementById('copiar-codigo-digitos')?.textContent

beforeEach(async () => {
  await i18n.changeLanguage('es')
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
  window.getSelection()?.removeAllRanges()
  window.history.replaceState(null, '', '/')
})

describe('codigoDesdeFragmento', () => {
  it('acepta exactamente seis dígitos tras el #', () => {
    expect(codigoDesdeFragmento('#048213')).toBe('048213')
    for (const fragmento of ['', '#', '#12345', '#1234567', '#12a456', '#123 456', '#token=123456', '123456', '#１２３４５６']) {
      expect(codigoDesdeFragmento(fragmento), fragmento).toBeNull()
    }
  })
})

describe('Copiar código del correo', () => {
  it('muestra el código en grande, lo quita de la URL y ofrece copiarlo y volver', async () => {
    const writeText = instalarPortapapeles(sinGesto)
    montar('#048213')

    expect(screen.getByRole('heading', { name: 'Tu código de ColdCare' })).toBeInTheDocument()
    expect(digitosVisibles()).toBe('048213')
    // Los lectores de pantalla lo oyen dígito a dígito.
    expect(screen.getByText('Código: 0 4 8 2 1 3')).toBeInTheDocument()
    expect(screen.getByText('Vuelve a la pestaña de ColdCare y pégalo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a ColdCare' })).toHaveAttribute('href', '/login')

    // El fragmento sale de la barra de direcciones (y del historial) al montar.
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/copiar-codigo')

    // Sin gesto del usuario el navegador lo rechaza: no se avisa nada.
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('048213'))
    await esperarMicrotasks()
    expect(screen.getByRole('button', { name: 'Copiar código' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.getByRole('alert')).toHaveTextContent('')
  })

  it('si el navegador lo permite, lo copia al abrir y lo anuncia', async () => {
    const writeText = instalarPortapapeles(() => Promise.resolve())
    montar('#731905')

    expect(await screen.findByRole('button', { name: 'Código copiado' })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('731905')
    await esperarAviso('status', 'Código copiado')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('el botón lo copia cuando el intento automático falló', async () => {
    const writeText = instalarPortapapeles(sinGesto)
    montar('#550127')
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))

    writeText.mockImplementation(() => Promise.resolve())
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }))

    await esperarAviso('status', 'Código copiado')
    expect(screen.getByRole('button', { name: 'Código copiado' })).toBeInTheDocument()
    expect(writeText).toHaveBeenLastCalledWith('550127')
    expect(screen.getByRole('alert')).toHaveTextContent('')
  })

  it('si copiar falla, lo explica y deja el código seleccionado', async () => {
    const writeText = instalarPortapapeles(sinGesto)
    montar('#550127')
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }))

    await esperarAviso('alert', 'Tu navegador no permitió copiarlo')
    expect(window.getSelection()?.toString()).toBe('550127')
    expect(screen.getByRole('button', { name: 'Copiar código' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('sin API de portapapeles (contexto no seguro) también avisa', async () => {
    montar('#550127')

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }))

    await esperarAviso('alert', 'Selecciona el código')
  })

  it('no escribe el código en la consola ni en el almacenamiento', async () => {
    const consola = (['log', 'info', 'warn', 'error', 'debug'] as const).map((metodo) => vi.spyOn(console, metodo))
    instalarPortapapeles(() => Promise.resolve())
    montar('#904417')
    await screen.findByRole('button', { name: 'Código copiado' })
    fireEvent.click(screen.getByRole('button', { name: 'Código copiado' }))
    await esperarMicrotasks()

    const escrito = consola.flatMap((espia) => espia.mock.calls.flat().map(String)).join('\n')
    expect(escrito).not.toContain('904417')
    const almacenado = [...Object.values(localStorage), ...Object.values(sessionStorage)].join('\n')
    expect(almacenado).not.toContain('904417')
    expect(window.location.href).not.toContain('904417')
    expect(document.title).not.toContain('904417')
  })

  it.each(['', '#', '#12345', '#1234567', '#abc123', '#token=123456'])('fragmento «%s»: mensaje amable y enlace al login', async (fragmento) => {
    const writeText = instalarPortapapeles(() => Promise.resolve())
    montar(fragmento)

    expect(screen.getByRole('heading', { name: 'Este enlace no trae un código válido' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Copiar código/ })).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')
    await esperarMicrotasks()
    expect(writeText).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('link', { name: 'Volver a ColdCare' }))
    expect(await screen.findByText('pantalla de login')).toBeInTheDocument()
  })

  it('en inglés', async () => {
    await i18n.changeLanguage('en')
    instalarPortapapeles(sinGesto)
    montar('#048213')

    expect(screen.getByRole('heading', { name: 'Your ColdCare code' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument()
    expect(screen.getByText('Go back to the ColdCare tab and paste it')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to ColdCare' })).toBeInTheDocument()
  })
})
