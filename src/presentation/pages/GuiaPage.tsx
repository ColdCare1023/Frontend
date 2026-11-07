import { useEffect, useId, useRef, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LayoutGroup, motion, useReducedMotion, type Transition } from 'motion/react'
import {
  ArrowRight,
  Bell,
  ChevronDown,
  FileText,
  History,
  Link2,
  ListChecks,
  Monitor,
  Pause,
  Play,
  ScrollText,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useAuthStore } from '@/application/stores/authStore'
import { tienePermiso, type Rol } from '@/domain/value-objects/Rol'
import { Detalles } from '../components/ui/detalles'
import { TituloPagina } from '../components/ui/titulo-pagina'
import { EscenaAviso, EscenaDia } from './guia/escenas'
import { EstadosVivos } from './guia/EstadosVivos'
import './guia/guia.css'

type GrupoId = 'vigilar' | 'consultar' | 'administrar'

const TODOS: Rol[] = ['farmaceutico', 'tecnico', 'auditor']

interface Seccion {
  ruta: string
  icono: LucideIcon
  tituloKey: string
  descripcionKey: string
  grupo: GrupoId
  roles: Rol[]
}

/** Todas las pantallas, para quien quiera el mapa completo: a un clic, bajo las preguntas. */
const SECCIONES: Seccion[] = [
  { ruta: '/dashboard', icono: Monitor, tituloKey: 'guia.pantallas.monitoreo.titulo', descripcionKey: 'guia.pantallas.monitoreo.descripcion', grupo: 'vigilar', roles: TODOS },
  { ruta: '/alertas', icono: Bell, tituloKey: 'guia.pantallas.alertas.titulo', descripcionKey: 'guia.pantallas.alertas.descripcion', grupo: 'vigilar', roles: TODOS },
  { ruta: '/historial', icono: History, tituloKey: 'guia.pantallas.historial.titulo', descripcionKey: 'guia.pantallas.historial.descripcion', grupo: 'consultar', roles: TODOS },
  { ruta: '/trazabilidad', icono: Link2, tituloKey: 'guia.pantallas.integridad.titulo', descripcionKey: 'guia.pantallas.integridad.descripcion', grupo: 'consultar', roles: TODOS },
  { ruta: '/reportes', icono: FileText, tituloKey: 'guia.pantallas.reportes.titulo', descripcionKey: 'guia.pantallas.reportes.descripcion', grupo: 'consultar', roles: ['farmaceutico', 'auditor'] },
  { ruta: '/metricas-ia', icono: ListChecks, tituloKey: 'guia.pantallas.metricas.titulo', descripcionKey: 'guia.pantallas.metricas.descripcion', grupo: 'consultar', roles: ['farmaceutico', 'auditor'] },
  { ruta: '/auditoria', icono: ScrollText, tituloKey: 'guia.pantallas.auditoria.titulo', descripcionKey: 'guia.pantallas.auditoria.descripcion', grupo: 'consultar', roles: ['auditor'] },
  { ruta: '/usuarios', icono: Users, tituloKey: 'guia.pantallas.usuarios.titulo', descripcionKey: 'guia.pantallas.usuarios.descripcion', grupo: 'administrar', roles: [] },
  { ruta: '/dispositivos', icono: SlidersHorizontal, tituloKey: 'guia.pantallas.dispositivos.titulo', descripcionKey: 'guia.pantallas.dispositivos.descripcion', grupo: 'administrar', roles: [] },
]

const GRUPOS: GrupoId[] = ['vigilar', 'consultar', 'administrar']

const CONCEPTOS = ['rango', 'preventivo', 'excursion', 'integridad', 'bpa'] as const

type ClavePregunta = 'alerta' | 'bien' | 'anoche' | 'constancia' | 'registros' | 'quien' | 'equipo' | 'persona'

interface Pregunta {
  clave: ClavePregunta
  /** La pantalla donde se resuelve, y su nombre en la navegación. */
  ruta: string
  pantalla: string
  roles: Rol[]
  /** Solo las animaciones que explican de verdad lo que dice la respuesta. */
  Escena?: ComponentType<{ pausado: boolean }>
}

/** Las preguntas de botica, de la más urgente a la menos. Cada rol ve solo las que puede resolver. */
const PREGUNTAS: Pregunta[] = [
  { clave: 'alerta', ruta: '/alertas', pantalla: 'nav.alertas', roles: TODOS, Escena: EscenaAviso },
  { clave: 'bien', ruta: '/dashboard', pantalla: 'nav.dashboard', roles: TODOS, Escena: EstadosVivos },
  { clave: 'anoche', ruta: '/historial', pantalla: 'nav.historial', roles: TODOS, Escena: EscenaDia },
  { clave: 'constancia', ruta: '/reportes', pantalla: 'nav.reportes', roles: ['farmaceutico', 'auditor'] },
  { clave: 'registros', ruta: '/trazabilidad', pantalla: 'nav.trazabilidad', roles: TODOS },
  { clave: 'quien', ruta: '/auditoria', pantalla: 'nav.auditoria', roles: ['auditor'] },
  { clave: 'equipo', ruta: '/dispositivos', pantalla: 'nav.dispositivos', roles: [] },
  { clave: 'persona', ruta: '/usuarios', pantalla: 'nav.usuarios', roles: [] },
]

/** Las preguntas de abajo se corren con un resorte corto: solo `transform`. */
const MUELLE: Transition = { type: 'spring', stiffness: 480, damping: 42, mass: 0.85 }

function Duda({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details open className="group duda">
      <summary className="duda__pregunta">
        {titulo}
        <ChevronDown aria-hidden className="size-5 shrink-0 text-muted transition-transform duration-(--duration-ui) group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <p className="duda__respuesta">{children}</p>
    </details>
  )
}

/**
 * Una pregunta: al tocarla, la fila crece hasta mostrar su respuesta corta, el enlace directo a la
 * pantalla y, si ayuda, la animación que lo enseña. Las demás se corren, sin saltos.
 */
function FilaPregunta({
  pregunta,
  abierta,
  onAlternar,
  pausado,
  pausa,
  layout,
}: {
  pregunta: Pregunta
  abierta: boolean
  onAlternar: () => void
  pausado: boolean
  pausa: React.ReactNode
  layout: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const fila = useRef<HTMLLIElement>(null)
  const { Escena } = pregunta

  // Al abrirse una pregunta más abajo, la de arriba se pliega: esta no debe quedar fuera de la vista.
  // Solo cuando pasa a abierta: la que ya viene abierta al entrar no mueve la página.
  const estabaAbierta = useRef(abierta)
  useEffect(() => {
    const caja = fila.current?.getBoundingClientRect()
    // Solo si la pregunta quedó fuera de la vista; si se ve, la página no se mueve.
    if (abierta && !estabaAbierta.current && caja && (caja.top < 0 || caja.top > window.innerHeight - 96)) {
      fila.current?.scrollIntoView?.({ block: 'start' })
    }
    estabaAbierta.current = abierta
  }, [abierta])

  return (
    <motion.li ref={fila} layout={layout ? 'position' : false} transition={MUELLE} className="pregunta" data-abierta={abierta || undefined}>
      <h2 className="pregunta__titulo">
        <button type="button" aria-expanded={abierta} aria-controls={id} onClick={onAlternar} className="pregunta__boton">
          <span className="min-w-0">{t(`guia.preguntasRapidas.${pregunta.clave}.pregunta`)}</span>
          <ChevronDown aria-hidden className="pregunta__chevron" />
        </button>
      </h2>
      {abierta && (
        <div id={id} className="pregunta__cuerpo" data-con-escena={Escena ? '' : undefined}>
          <div className="pregunta__texto">
            <p className="pregunta__respuesta">{t(`guia.preguntasRapidas.${pregunta.clave}.respuesta`)}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link to={pregunta.ruta} className="pregunta__ir">
                {t('guia.irA', { pantalla: t(pregunta.pantalla) })}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              {Escena && pausa}
            </div>
          </div>
          {Escena && (
            <div className="pregunta__escena">
              <Escena pausado={pausado} />
            </div>
          )}
        </div>
      )}
    </motion.li>
  )
}

export function GuiaPage() {
  const { t } = useTranslation()
  const reducir = useReducedMotion()
  const usuario = useAuthStore((s) => s.usuario)
  const rol = usuario?.rol
  const preguntas = PREGUNTAS.filter((p) => (rol ? tienePermiso(rol, p.roles) : false))
  // La primera, la más urgente, ya viene abierta: hay contenido real desde el primer vistazo.
  const [abierta, setAbierta] = useState<ClavePregunta | null>('alerta')
  const [pausado, setPausado] = useState(false)
  const visibles = SECCIONES.filter((s) => (rol ? tienePermiso(rol, s.roles) : false))
  const grupos = GRUPOS.map((grupo) => ({
    grupo,
    secciones: visibles.filter((seccion) => seccion.grupo === grupo),
  })).filter(({ secciones }) => secciones.length > 0)

  // WCAG 2.2.2: lo que se mueve más de cinco segundos se puede pausar.
  const pausa = !reducir && (
    <button type="button" className="guia-pausa realce" aria-pressed={pausado} onClick={() => setPausado((actual) => !actual)}>
      {pausado ? <Play aria-hidden className="size-3.5" /> : <Pause aria-hidden className="size-3.5" />}
      <span>{t('guia.pausarAnimaciones')}</span>
    </button>
  )

  return (
    <div className="guia" data-pausado={pausado ? '' : undefined}>
      <TituloPagina antetitulo={t('guia.eyebrow')} titulo={t('guia.titulo')} descripcion={t('guia.descripcion')} className="mb-5 sm:mb-7" />

      <LayoutGroup>
        <ul className="preguntas">
          {preguntas.map((pregunta) => (
            <FilaPregunta
              key={pregunta.clave}
              pregunta={pregunta}
              abierta={abierta === pregunta.clave}
              onAlternar={() => setAbierta((actual) => (actual === pregunta.clave ? null : pregunta.clave))}
              pausado={pausado}
              pausa={pausa}
              layout={!reducir}
            />
          ))}
        </ul>

        {/* Lo demás no se borra: el mapa de pantallas, otras dudas y las palabras útiles, a un clic. */}
        <motion.div layout={reducir ? false : 'position'} transition={MUELLE} className="mt-8 sm:mt-10">
          <Detalles titulo={<span className="text-[15px] font-semibold text-foreground">{t('guia.verMas')}</span>} className="border-y border-border [&>button]:min-h-13">
            <div className="flex flex-col gap-12 pt-4 pb-10">
              <section aria-labelledby="guia-pantallas-titulo" className="min-w-0">
                <h2 id="guia-pantallas-titulo" className="dudas__titulo">{t('guia.pantallasTitulo')}</h2>
                {grupos.map(({ grupo, secciones }) => (
                  <div key={grupo} className="pantallas__grupo">
                    <h3 className="pantallas__nombre-grupo">{t(`guia.grupos.${grupo}`)}</h3>
                    <ul className="pantallas__lista min-w-0">
                      {secciones.map((item) => {
                        const Icono = item.icono
                        return (
                          <li key={item.ruta} className="min-w-0">
                            <Link to={item.ruta} className="pantalla focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                              <Icono aria-hidden className="pantalla__icono" />
                              <span className="pantalla__titulo">{t(item.tituloKey)}</span>
                              <ArrowRight aria-hidden className="pantalla__flecha" />
                              <span className="pantalla__descripcion">{t(item.descripcionKey)}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </section>

              <div className="dudas">
                <section id="guia-preguntas" aria-labelledby="guia-preguntas-titulo" className="min-w-0">
                  <h2 id="guia-preguntas-titulo" className="dudas__titulo">{t('guia.preguntasTitulo')}</h2>
                  <div className="dudas__lista">
                    {(['alerta', 'permisos', 'integridad', 'metricas'] as const).map((pregunta) => (
                      <Duda key={pregunta} titulo={t(`guia.preguntas.${pregunta}.titulo`)}>
                        {t(`guia.preguntas.${pregunta}.respuesta`)}
                      </Duda>
                    ))}
                  </div>
                </section>
                <section id="guia-conceptos" aria-labelledby="guia-conceptos-titulo" className="min-w-0">
                  <h2 id="guia-conceptos-titulo" className="dudas__titulo">{t('guia.conceptosTitulo')}</h2>
                  <div className="dudas__lista">
                    {CONCEPTOS.map((concepto) => (
                      <Duda key={concepto} titulo={t(`guia.conceptos.${concepto}.titulo`)}>
                        {t(`guia.conceptos.${concepto}.descripcion`)}
                      </Duda>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </Detalles>
        </motion.div>
      </LayoutGroup>

      <p className="sr-only">{t('guia.nota')}</p>
    </div>
  )
}
