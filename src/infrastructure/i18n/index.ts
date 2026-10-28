import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import es from './locales/es.json'
import en from './locales/en.json'

export const IDIOMAS = ['es', 'en'] as const
export type Idioma = (typeof IDIOMAS)[number]
const CLAVE_IDIOMA = 'coldcare-idioma'

/** El español es el idioma principal; el inglés se recuerda si se eligió. */
function idiomaGuardado(): Idioma {
  try {
    const guardado = typeof window === 'undefined' ? null : window.localStorage.getItem(CLAVE_IDIOMA)
    return guardado === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: idiomaGuardado(),
  fallbackLng: 'es',
  supportedLngs: ['es', 'en'],
  interpolation: {
    escapeValue: false,
  },
})

/**
 * WCAG 3.1.1 (Idioma de la página) y 3.1.2: `index.html` declara `lang="es"` de
 * forma estática, así que al pasar a inglés el lector de pantalla seguía
 * leyendo el interfaz con las reglas de pronunciación del español. El atributo
 * se sincroniza con el idioma resuelto en cada cambio.
 */
export function sincronizarIdiomaDocumento(idioma: string | undefined): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = idioma ?? 'es'
  document.title = i18n.t('app.tituloDocumento')
  document.querySelector('meta[name="description"]')?.setAttribute(
    'content',
    i18n.t('app.metaDescripcion'),
  )
}

sincronizarIdiomaDocumento(i18n.resolvedLanguage)
i18n.on('languageChanged', (idioma) => {
  sincronizarIdiomaDocumento(i18n.resolvedLanguage)
  try {
    window.localStorage.setItem(CLAVE_IDIOMA, idioma === 'en' ? 'en' : 'es')
  } catch {
    // Sin almacenamiento, el idioma vale solo para esta visita.
  }
})

export default i18n
