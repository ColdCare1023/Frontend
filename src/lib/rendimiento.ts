/*
 * Cuánto puede dibujar este equipo: la misma escala que usa la landing. Se estima la primera vez
 * que alguien pregunta (no al cargar: las pantallas sin 3D ni gráficas no pagan la prueba de WebGL)
 * y, si después los cuadros tardan de más, baja un escalón.
 */
export type Nivel = 'alto' | 'medio' | 'bajo'

/* Dibuja por CPU: sin tarjeta gráfica real, cada píxel cuesta mucho. */
const POR_CPU = /swiftshader|llvmpipe|softpipe|software|basic render/i
/* Integradas de Intel (las Arc son aparte) y Mali o Adreno antiguos: con menos píxeles van bien. */
const MODESTA = /intel(?!.*\barc\b)|mali-(?:t|4|g[357]\d\b)|adreno(?: \(tm\))? [2-6]\d\d\b/i

/** El nombre de la tarjeta gráfica, o `null` si no hay WebGL o el navegador avisa que iría muy lento. */
function leerGrafica(): string | null {
  if (typeof WebGLRenderingContext === 'undefined') return null
  try {
    const gl = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true })
    if (!gl) return null
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const nombre = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
    // El contexto de prueba se libera: los navegadores permiten pocos a la vez.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return nombre
  } catch {
    return null
  }
}

interface Deteccion {
  nivel: Nivel
  /** Sin WebGL o dibujando por CPU: el 3D no se descarga siquiera. */
  sinAceleracion: boolean
}

function detectar(): Deteccion {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return { nivel: 'alto', sinAceleracion: false }
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  const nucleos = n.hardwareConcurrency ?? 4
  const memoria = n.deviceMemory ?? 8
  const tactil = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const grafica = leerGrafica()
  if (grafica === null || POR_CPU.test(grafica)) return { nivel: 'bajo', sinAceleracion: true }
  if (n.connection?.saveData || nucleos <= 2 || memoria <= 2) return { nivel: 'bajo', sinAceleracion: false }
  if (tactil || window.innerWidth < 900 || nucleos <= 4 || memoria <= 4 || MODESTA.test(grafica)) return { nivel: 'medio', sinAceleracion: false }
  return { nivel: 'alto', sinAceleracion: false }
}

let deteccion: Deteccion | null = null
const leer = () => (deteccion ??= detectar())

export const rendimiento = {
  get nivel(): Nivel {
    return leer().nivel
  },
  set nivel(nivel: Nivel) {
    leer().nivel = nivel
  },
  get sinAceleracion(): boolean {
    return leer().sinAceleracion
  },
}

export function segunNivel<T>(alto: T, medio: T, bajo: T): T {
  const nivel = rendimiento.nivel
  return nivel === 'alto' ? alto : nivel === 'medio' ? medio : bajo
}

/**
 * Segundos entre cuadros de un vial que casi no se mueve: su vaivén es tan lento que no hace falta
 * dibujarlo en cada cuadro. El panel se queda abierto horas junto a una cifra, así que pide menos
 * que la landing (1/30, 1/24, 1/10).
 */
export const ritmoQuieto = () => segunNivel(1 / 24, 1 / 20, 1 / 10)

/* Media de milisegundos por cuadro a partir de la cual un equipo no alcanza. */
const LENTO = 22
const MUY_LENTO = 30
const CUADROS_POR_TRAMO = 75
/* Se vigila a ratos: un requestAnimationFrame continuo obligaría a la pantalla a despertar 60 veces
   por segundo, justo lo que el vial evita al dibujar pocos cuadros. */
const ESPERA_INICIAL_MS = 4000
const ESPERA_ENTRE_TRAMOS_MS = 15000

/** Devuelve `true` si pudo aliviar la carga por su cuenta (por ejemplo, con menos resolución). */
export type AlIrLento = () => boolean

const oyentes = new Set<AlIrLento>()
let detener: (() => void) | null = null

function empezarVigilancia() {
  let raf = 0
  let espera = 0
  let lentas = 0

  const tramo = () => {
    let previo = performance.now()
    let suma = 0
    let cuadros = 0
    const cuadro = (ahora: number) => {
      const dt = ahora - previo
      previo = ahora
      // Pausas largas (pestaña oculta, carga de una escena) no cuentan como lentitud.
      if (dt <= 250 && !document.hidden) {
        suma += dt
        cuadros += 1
      }
      if (cuadros < CUADROS_POR_TRAMO) {
        raf = requestAnimationFrame(cuadro)
        return
      }
      const media = suma / cuadros
      lentas = media > LENTO ? lentas + 1 : 0
      // Un tramo muy lento basta; uno apenas lento puede ser un tropiezo, así que se espera a otro.
      if (media > MUY_LENTO || lentas >= 2) {
        lentas = 0
        const aliviado = [...oyentes].some((oyente) => oyente())
        if (!aliviado && rendimiento.nivel !== 'bajo') rendimiento.nivel = rendimiento.nivel === 'alto' ? 'medio' : 'bajo'
      }
      espera = window.setTimeout(tramo, ESPERA_ENTRE_TRAMOS_MS)
    }
    raf = requestAnimationFrame(cuadro)
  }

  espera = window.setTimeout(tramo, ESPERA_INICIAL_MS)
  return () => {
    cancelAnimationFrame(raf)
    window.clearTimeout(espera)
  }
}

/** Vigila los cuadros reales y baja de nivel si el equipo no alcanza. Devuelve cómo detenerlo. */
export function vigilarRendimiento(alIrLento: AlIrLento = () => false) {
  oyentes.add(alIrLento)
  detener ??= empezarVigilancia()
  return () => {
    oyentes.delete(alIrLento)
    if (oyentes.size === 0) {
      detener?.()
      detener = null
    }
  }
}
