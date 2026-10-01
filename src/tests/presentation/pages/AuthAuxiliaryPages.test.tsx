import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { RecuperarContrasenaPage } from '@/presentation/pages/RecuperarContrasenaPage'
import { RestablecerContrasenaPage } from '@/presentation/pages/RestablecerContrasenaPage'
import { SolicitarAccesoPage } from '@/presentation/pages/SolicitarAccesoPage'

describe('Páginas complementarias de autenticación', () => {
  describe('RecuperarContrasenaPage', () => {
    it('muestra el formulario de recuperación y enlace al login', () => {
      render(
        <MemoryRouter initialEntries={['/recuperar-contrasena']}>
          <Routes>
            <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByRole('heading', { name: /Recuperar contraseña/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Enviar instrucciones/i })).toBeInTheDocument()
      expect(screen.getAllByRole('link', { name: /Volver a iniciar sesión/i })[0]).toHaveAttribute(
        'href',
        '/login',
      )
    })

    it('valida formato de correo y muestra confirmación anti-enumeración', async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter initialEntries={['/recuperar-contrasena']}>
          <Routes>
            <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
          </Routes>
        </MemoryRouter>,
      )

      await user.click(screen.getByRole('button', { name: /Enviar instrucciones/i }))
      expect(screen.getByRole('alert')).toHaveTextContent(/Ingresa tu correo electrónico/i)

      await user.type(screen.getByLabelText(/Correo electrónico/i), 'usuario@farmacia.pe')
      await user.click(screen.getByRole('button', { name: /Enviar instrucciones/i }))

      expect(
        await screen.findByRole('heading', { name: /Instrucciones enviadas/i }),
      ).toBeInTheDocument()
      expect(screen.getByText(/usuario@farmacia\.pe/i)).toBeInTheDocument()
    })
  })

  describe('RestablecerContrasenaPage', () => {
    it('valida coincidencia de contraseñas y permite restablecimiento con token demo', async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter initialEntries={['/restablecer-contrasena?token=demo-recovery-token']}>
          <Routes>
            <Route path="/restablecer-contrasena" element={<RestablecerContrasenaPage />} />
          </Routes>
        </MemoryRouter>,
      )

      // Esperar que termine la validación inicial del token
      expect(await screen.findByLabelText(/Nueva contraseña/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Confirmar contraseña/i)).toBeInTheDocument()

      // Prueba de no coincidencia
      await user.type(screen.getByLabelText(/Nueva contraseña/i), 'ClaveSegura-2026')
      await user.type(screen.getByLabelText(/Confirmar contraseña/i), 'Diferente-2026')
      await user.click(screen.getByRole('button', { name: /Actualizar contraseña/i }))

      expect(screen.getByRole('alert')).toHaveTextContent(/Las contraseñas no coinciden/i)

      // Corregir confirmación
      await user.clear(screen.getByLabelText(/Confirmar contraseña/i))
      await user.type(screen.getByLabelText(/Confirmar contraseña/i), 'ClaveSegura-2026')
      await user.click(screen.getByRole('button', { name: /Actualizar contraseña/i }))

      expect(
        await screen.findByRole('heading', { name: /Contraseña actualizada/i }),
      ).toBeInTheDocument()
    })
  })

  describe('SolicitarAccesoPage', () => {
    it('muestra formulario con campos RBAC HU-41 y procesa solicitud', async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter initialEntries={['/solicitar-acceso']}>
          <Routes>
            <Route path="/solicitar-acceso" element={<SolicitarAccesoPage />} />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByRole('heading', { name: /Solicitar acceso/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/Nombre completo/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Correo electrónico institucional/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Rol solicitado/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Establecimiento/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Justificación/i)).toBeInTheDocument()

      // Enviar con campos vacíos
      await user.click(screen.getByRole('button', { name: /Enviar solicitud/i }))
      expect(screen.getByRole('alert')).toHaveTextContent(/completa todos los campos/i)

      // Llenar formulario
      await user.type(screen.getByLabelText(/Nombre completo/i), 'Dr. Juan Pérez')
      await user.type(screen.getByLabelText(/Correo electrónico institucional/i), 'juan@hospital.pe')
      await user.type(screen.getByLabelText(/Establecimiento/i), 'Hospital Central')
      await user.type(screen.getByLabelText(/Justificación/i), 'Responsable del turno noche en farmacia')
      await user.click(screen.getByRole('button', { name: /Enviar solicitud/i }))

      expect(
        await screen.findByRole('heading', { name: /Solicitud enviada para revisión/i }),
      ).toBeInTheDocument()
      expect(screen.getByText(/Dr\. Juan Pérez/i)).toBeInTheDocument()
    })
  })
})
