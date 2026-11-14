import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import { useTranslation } from 'react-i18next'

import { ubicarRuta } from '../../navegacion'

let desdeMenu = false

/** El riel, el cajón o la píldora inician la navegación: al llegar, el foco va al contenido. */
export function marcarNavegacionDesdeMenu() {
  desdeMenu = true
}

/**
 * Lo que el shell hace en cada cambio de ruta (sin animarlo): título del
 * documento, volver arriba en PUSH/REPLACE (no en «atrás») y, si se navegó
 * desde el menú, mover el foco al `main` para que el lector de pantalla y el
 * teclado empiecen por el contenido. La primera carga no mueve el foco.
 */
export function useCambioDeRuta(main: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const tipo = useNavigationType()
  const { t, i18n } = useTranslation()
  const primera = useRef(true)

  useEffect(() => {
    const ubicacion = ubicarRuta(pathname)
    document.title = ubicacion ? t('app.tituloRuta', { pagina: t(ubicacion.item.claveI18n) }) : t('app.tituloDocumento')
  }, [pathname, t, i18n.language])

  useEffect(() => {
    if (primera.current) {
      primera.current = false
      desdeMenu = false
      return
    }
    if (tipo !== 'POP') window.scrollTo?.({ top: 0 })
    if (desdeMenu) main.current?.focus({ preventScroll: true })
    desdeMenu = false
  }, [pathname, tipo, main])
}
