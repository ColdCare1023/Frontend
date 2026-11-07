import { useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { BandaRango, CapasColor } from '../monitoreo/CapasColor'
import type { TonoCampo } from '../monitoreo/estadoEquipo'
import { useEnVista } from './useEnVista'

/*
 * Las escenas de la ayuda: solo quedan las que enseñan algo que el texto no alcanza a mostrar
 * (cómo se ve un aviso, cómo se lee la noche). Hechas solo con CSS (`transform` y `opacity`), se
 * pausan fuera de pantalla y, sin movimiento, se quedan en el cuadro que resume lo que enseñan. Los
 * valores son de ejemplo, y lo dicen.
 */

function Etiqueta() {
  const { t } = useTranslation()
  return <span className="escena__ejemplo">{t('guia.previa.ejemplo')}</span>
}

function Escena({
  nombre,
  tono,
  etiqueta = true,
  children,
  className,
}: {
  nombre: string
  tono?: TonoCampo
  /** Quien cambia de color por dentro pone la suya en cada capa, con la tinta que le toca. */
  etiqueta?: boolean
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const enVista = useEnVista(ref)
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('escena', `escena--${nombre}`, className)}
      data-tono={tono}
      data-corre={enVista ? '' : undefined}
    >
      {children}
      {etiqueta && <Etiqueta />}
    </div>
  )
}

/** Dígito que rueda: una tira de cifras que sube dentro de una ventana de un carácter. */
function Rueda({ cifras, clase }: { cifras: string; clase: string }) {
  return (
    <span className="rueda">
      <span className={cn('rueda__tira', clase)}>
        {[...cifras].map((cifra, indice) => (
          <span key={indice}>{cifra}</span>
        ))}
      </span>
    </span>
  )
}

function CifraAviso() {
  return (
    <p className="escena__cifra">
      <Rueda cifras="787" clase="rueda--aviso-entero" />
      <span>.</span>
      <Rueda cifras="69366" clase="rueda--aviso-decimal" />
      <span className="escena__unidad">°C</span>
    </p>
  )
}

/** Una alerta: la lectura cruza el límite, el campo se vuelve rojo y la isla baja a avisar. */
export function EscenaAviso() {
  const { t } = useTranslation()
  const contenido = (
    <>
      <div className="escena__arriba">
        <span>{t('guia.previa.lectura')}</span>
      </div>
      <div className="escena__abajo">
        <CifraAviso />
      </div>
    </>
  )
  return (
    <Escena nombre="aviso" etiqueta={false}>
      <div className="escena__capa escena__capa--antes" data-tono="rango">
        <CapasColor tono="rango" />
        <Etiqueta />
        {contenido}
        <BandaRango valor={7.6} />
      </div>
      <div className="escena__capa escena__capa--despues" data-tono="critico">
        <CapasColor tono="critico" />
        <Etiqueta />
        {contenido}
        <div className="escena__abajo escena__abajo--palabra">
          <p className="escena__palabra">{t('guia.previa.aviso')}</p>
        </div>
        <BandaRango valor={8.6} />
      </div>
      <p className="escena__isla">
        <span className="escena__isla-punto" />
        <span className="nums">8.6°</span>
        <span className="escena__isla-texto">{t('guia.previa.aviso')}</span>
      </p>
    </Escena>
  )
}

// La noche de ejemplo en coordenadas del dibujo: 8 °C cae en y=74 y 2 °C en y=220.
const CURVA =
  'M0 164c20-5 30 4 48 0s26-9 44-6 26 12 44 8 26-14 44-12c20 2 26 18 44 16 24-3 32-34 50-74 14-30 24-58 36-58 13 0 22 32 36 62 15 32 26 62 48 68 20 5 30-6 48-6s28 8 46 6 30-10 48-8 28 8 44 4 24-6 40-6'

/** La noche se dibuja de izquierda a derecha y lo que pasó queda anotado en su sitio. */
export function EscenaDia() {
  const { t } = useTranslation()
  const idRecorte = useId()
  return (
    <Escena nombre="dia" className="tema-capsula">
      <div className="escena__dia">
        <svg viewBox="0 0 640 280" preserveAspectRatio="none" fill="none" className="escena__dia-lienzo">
          <defs>
            <clipPath id={idRecorte}>
              <rect x="0" y="0" width="640" height="74" />
            </clipPath>
          </defs>
          <path d={CURVA} stroke="#00d1ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={CURVA} clipPath={`url(#${idRecorte})`} stroke="#ff5a4f" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <rect className="escena__dia-cortina" x="0" y="0" width="640" height="280" />
          <rect x="0" y="74" width="640" height="146" fill="#00d1ff" opacity="0.1" />
          <path d="M0 74h640M0 220h640" stroke="#00d1ff" strokeOpacity="0.4" vectorEffect="non-scaling-stroke" />
          <rect className="escena__dia-cabezal" x="-1" y="0" width="2" height="280" fill="#ffffff" />
        </svg>
        <p className="escena__dia-rotulo" style={{ top: '13.6%', left: '48.4%' }}>
          <span className="escena__dia-punto" />
          <span className="nums">8.6° · {t('guia.previa.ejemploHora')}</span>
        </p>
        <span className="escena__dia-cota nums" style={{ top: 'calc(26.4% - 8px)' }}>8°</span>
        <span className="escena__dia-cota nums" style={{ top: 'calc(78.6% - 8px)' }}>2°</span>
        <span className="escena__dia-hora nums" style={{ left: '31%' }}>00:00</span>
        <span className="escena__dia-hora nums" style={{ left: '64.3%' }}>04:00</span>
      </div>
    </Escena>
  )
}
