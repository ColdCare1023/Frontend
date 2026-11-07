import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { FlaskConical, KeyRound, LogOut } from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { MODO_DEMO } from '@/infrastructure/demo/modoDemo'
import { cambiarTema, type PreferenciaTema } from '@/infrastructure/tema/tema'
import type { Rol } from '@/domain/value-objects/Rol'
import { AvisosTiempoReal } from '@/presentation/components/AvisosTiempoReal'
import { AvisoExpiracionSesion } from '../components/AvisoExpiracionSesion'
import { ColdCareBrand } from '../components/ColdCareBrand'
import { OpcionesIdioma } from '../components/LanguageSwitcher'
import { IslaDinamica, LecturaActual } from '../components/notificaciones/IslaDinamica'
import { useResumenIsla } from '../components/notificaciones/useResumenIsla'
import { OpcionesTema } from '../components/ThemeSwitcher'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../components/ui/menu'
import { TooltipProvider } from '../components/ui/tooltip'
import { useCoincideMedia } from '../components/ui/useCoincideMedia'
import { puedeVerRuta } from './navegacion'
import { NavPrincipal } from './NavegacionCapsula'

/** Desde aquí toda la navegación cabe arriba; también en un teléfono apaisado, donde el alto no sobra. */
const CONSULTA_NAV_ARRIBA = '(min-width: 768px)'

/**
 * FE-002: aviso persistente en TODAS las pantallas y tamaños, sin tapar nada. En cadena
 * de frío, confundir datos simulados con reales puede ocultar una excursión verdadera.
 */
function AvisoDatosSimulados() {
  const { t } = useTranslation()
  if (!MODO_DEMO) return null
  return (
    <div role="status" title={t('demo.descripcionBadge')} className="aviso-simulado">
      <FlaskConical aria-hidden className="size-3.5 shrink-0" />
      <p>
        {t('demo.avisoTitulo')}
        <span className="sr-only">. {t('demo.avisoDetalle')}</span>
      </p>
    </div>
  )
}

function centroDe(elemento: HTMLElement | null) {
  const caja = elemento?.getBoundingClientRect()
  return caja ? { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 } : undefined
}

/** Cuenta del usuario: datos, cambio de contraseña (FE-004), tema, idioma y cierre de sesión. */
function MenuUsuario() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const boton = useRef<HTMLButtonElement>(null)
  const usuario = useAuthStore((s) => s.usuario)
  const logout = useAuthStore((s) => s.logout)
  if (!usuario) return null
  const inicial = usuario.email.charAt(0).toUpperCase()

  return (
    <Menu>
      <MenuTrigger asChild>
        <button ref={boton} type="button" aria-label={`${t('nav.menuUsuario')}: ${usuario.email}`} className="capsula__boton realce text-sm font-semibold">
          {inicial}
        </button>
      </MenuTrigger>
      <MenuContent tono="noche" className="w-64 max-h-[calc(100dvh-16px)] overflow-y-auto">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-semibold text-primary">{inicial}</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-medium text-foreground">{usuario.email}</p>
            <p className="mt-1 text-xs text-faint">{t(`roles.${usuario.rol}`)}</p>
          </div>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => void navigate('/cambiar-password')}>
          <KeyRound className="text-faint" aria-hidden />
          {t('cambiarPassword.menu')}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            logout()
            void navigate('/login', { replace: true })
          }}
        >
          <LogOut className="text-faint" aria-hidden />
          {t('nav.cerrarSesion')}
        </MenuItem>
        <MenuSeparator />
        <OpcionesTema alElegir={(valor: PreferenciaTema) => cambiarTema(valor, centroDe(boton.current))} />
        <MenuSeparator />
        <OpcionesIdioma />
      </MenuContent>
    </Menu>
  )
}

/**
 * La cabecera y la navegación. Lo que vive del tiempo real se queda aquí, no en AppLayout:
 * cada lectura repinta estas cápsulas y deja quieta la pantalla.
 */
function Cabecera({ rol }: { rol: Rol }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const arriba = useCoincideMedia(CONSULTA_NAV_ARRIBA)
  const verLecturas = puedeVerRuta(rol, '/dashboard')
  const verAlertas = puedeVerRuta(rol, '/alertas')
  const resumen = useResumenIsla({ verLecturas, verAlertas, refresco: pathname })
  const [masAbierto, setMasAbierto] = useState(false)
  const navegacion = <NavPrincipal posicion={arriba ? 'arriba' : 'abajo'} alertas={resumen.alertas} masAbierto={masAbierto} alCambiarMas={setMasAbierto} />

  return (
    <>
      <header>
        <Link to="/dashboard" aria-label={t('app.nombre')} className="capsula capsula-marca tema-capsula">
          <ColdCareBrand tone="light" className="[&_svg]:size-8 max-[559px]:[&>div]:hidden" />
        </Link>
        <IslaDinamica resumen={resumen} verAlertas={verAlertas} retenida={masAbierto}>
          {arriba ? navegacion : <LecturaActual resumen={resumen} verAlertas={verAlertas} />}
        </IslaDinamica>
        <div className="capsula capsula-acciones tema-capsula">
          {arriba && <LecturaActual resumen={resumen} verAlertas={verAlertas} align="end" />}
          <MenuUsuario />
        </div>
      </header>
      {!arriba && navegacion}
    </>
  )
}

/**
 * Marco de la aplicación: el mismo producto que la landing. Cápsulas negras flotantes con
 * la marca, la navegación con palabras, la lectura y la cuenta; en el teléfono, la navegación
 * baja al alcance del pulgar. El contenido usa todo el ancho y se desplaza con la página.
 */
export function AppLayout() {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const rol = useAuthStore((s) => s.usuario?.rol)
  const { pathname } = useLocation()
  // La primera pantalla aparece sin animación; las siguientes, con un fundido.
  const rutaInicial = useRef(pathname)
  const yaNavego = useRef(false)
  if (rutaInicial.current !== pathname) yaNavego.current = true
  // Cada pantalla empieza arriba.
  useEffect(() => {
    document.documentElement.scrollTop = 0
  }, [pathname])

  if (!rol) return null

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={150}>
      <div className="marco" data-simulado={MODO_DEMO}>
        {/* WCAG 2.4.1 (Evitar bloques): la navegación son varios enlaces repetidos en cada
            página. Sin este atajo, llegar al contenido con el teclado exigía atravesarlos
            uno a uno en todas las rutas. Se mantiene oculto hasta recibir el foco. */}
        <a
          href="#contenido-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-(--radius-field) focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary focus:shadow-(--shadow-raised)"
        >
          {t('nav.saltarAlContenido')}
        </a>

        <span aria-hidden className="marco__velo marco__velo--arriba" />
        <span aria-hidden className="marco__velo marco__velo--abajo" />

        <Cabecera rol={rol} />

        <AvisoDatosSimulados />
        {/* FS5: se ve en cualquier ruta. */}
        <AvisoExpiracionSesion />
        <AvisosTiempoReal />

        <main id="contenido-principal" tabIndex={-1} aria-label={t('nav.contenidoPrincipal')} className="marco__contenido focus:outline-none">
          {/* Tope de ancho: en monitores muy anchos el contenido no se estira sin fin. */}
          <div className="mx-auto flex w-full max-w-(--contenido-max) flex-1 flex-col">
            {/* Sin animación de entrada: solo un fundido corto al cambiar de pantalla. */}
            <motion.div
              key={pathname}
              className="flex flex-1 flex-col"
              initial={reducir || !yaNavego.current ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
