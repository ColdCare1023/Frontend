import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import '@fontsource/kalam/300.css'
import './index.css'
import './infrastructure/i18n'
import { App } from './App'
import { registrarErrorDeInterfaz } from './infrastructure/registroErrores'

// Una pestaña abierta antes de publicar pide fragmentos que ya no existen: se recarga para traer los nuevos.
// Como mucho una vez por minuto, para no entrar en bucle si el fallo es de la red.
window.addEventListener('vite:preloadError', (evento) => {
  const CLAVE = 'coldcare:recarga-fragmento'
  const ultima = Number(sessionStorage.getItem(CLAVE) ?? 0)
  if (Date.now() - ultima < 60_000) return
  sessionStorage.setItem(CLAVE, String(Date.now()))
  evento.preventDefault()
  window.location.reload()
})

// FE-011: sin trazas con datos en la consola de producción.
createRoot(document.getElementById('root')!, {
  onCaughtError: registrarErrorDeInterfaz,
  onUncaughtError: registrarErrorDeInterfaz,
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
