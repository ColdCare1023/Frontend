import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import './index.css'
import { i18nListo } from './infrastructure/i18n'
import { App } from './App'
import { registrarErrorDeInterfaz } from './infrastructure/registroErrores'

// FE-011: sin trazas con datos en la consola de producción. El `MotionConfig`
// de movimiento reducido vive en AppLayout: motion no entra en el login.
// Se monta cuando el idioma inicial está listo: con español es inmediato; con
// inglés guardado espera su trozo para no pintar la interfaz en español.
function montar() {
  createRoot(document.getElementById('root')!, {
    onCaughtError: registrarErrorDeInterfaz,
    onUncaughtError: registrarErrorDeInterfaz,
  }).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void i18nListo.then(montar, montar)
