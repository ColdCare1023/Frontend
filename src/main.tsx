import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import './index.css'
import './infrastructure/i18n'
import { App } from './App'
import { registrarErrorDeInterfaz } from './infrastructure/registroErrores'
import { instalarSpotlight } from './presentation/efectos/spotlight'

instalarSpotlight()

// FE-011: sin trazas con datos en la consola de producción.
createRoot(document.getElementById('root')!, {
  onCaughtError: registrarErrorDeInterfaz,
  onUncaughtError: registrarErrorDeInterfaz,
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
