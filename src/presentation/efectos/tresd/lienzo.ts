import * as THREE from 'three'

import { enMomentoLibre, observarVista } from '@/lib/cargaDiferida'
import { rendimiento, segunNivel, vigilarRendimiento } from '@/lib/rendimiento'

export interface Vista {
  /**
   * `t` en segundos desde que se creó la vista. Puede devolver cuántos milisegundos no hace falta
   * volver a llamarla: sin esa espera, el bucle pediría un cuadro a la pantalla 60 veces por segundo
   * aunque no dibuje nada.
   */
  dibujar: (t: number) => number | void
  medir: (ancho: number, alto: number) => void
  /** Prepara sin congelar (compilar los shaders en paralelo), antes del primer dibujo. */
  calentar?: () => Promise<unknown> | void
  limpiar?: () => void
}

/** Cede el hilo antes de seguir: armar una escena entera de golpe congela unos cientos de milisegundos. */
export type Ceder = () => Promise<void>

/* Si los shaders tardan más que esto, el bucle arranca igual: la cola no puede quedarse esperando. */
const ESPERA_COMPILAR_MS = 4000

const ceder: Ceder = () => new Promise((listo) => void enMomentoLibre(listo, 500))

/**
 * Lo que comparten todas las escenas: un renderizador con la densidad de píxeles limitada
 * (y que baja sola si el equipo no llega), y un bucle que solo corre mientras el lienzo
 * está en pantalla. Fuera de pantalla una escena 3D no cuesta nada.
 */
/* Crear una escena y compilar sus shaders congela el hilo unos cientos de milisegundos.
   Por eso se hace de una en una, en momentos libres y antes de que haga falta: así el
   scroll nunca se encuentra con ese trabajo pendiente. */
const cola: Array<() => Promise<void>> = []
let ocupada = false
function atender() {
  const siguiente = cola.shift()
  if (!siguiente) {
    ocupada = false
    return
  }
  ocupada = true
  enMomentoLibre(() => {
    void siguiente().finally(() => window.setTimeout(atender, 180))
  }, 1800)
}
function encolar(f: () => Promise<void>) {
  cola.push(f)
  if (!ocupada) atender()
}

export function iniciarLienzo(
  canvas: HTMLCanvasElement,
  crear: (render: THREE.WebGLRenderer, ceder: Ceder) => Vista | Promise<Vista>,
  { dprMax = segunNivel(1.6, 1.25, 1) }: { dprMax?: number } = {},
): () => void {
  let cerrado = false
  let arrancado = false
  let soltar: (() => void) | undefined

  const arrancar = async () => {
    if (cerrado || arrancado) return
    arrancado = true
    let render: THREE.WebGLRenderer
    try {
      // Sin 'high-performance': un vial pequeño no justifica encender la tarjeta dedicada de un portátil
      // en una pantalla que se queda abierta todo el turno.
      render = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: rendimiento.nivel !== 'bajo' })
    } catch {
      // Sin WebGL la página sigue funcionando: solo falta el objeto.
      return
    }
    const liberar = () => {
      render.dispose()
      // El lienzo se va con el componente: se devuelve el contexto en vez de esperar a que el navegador lo reclame.
      render.forceContextLoss()
    }
    let dpr = Math.min(window.devicePixelRatio || 1, dprMax)
    render.setPixelRatio(dpr)
    render.setClearColor(0x000000, 0)
    render.toneMapping = THREE.ACESFilmicToneMapping
    render.toneMappingExposure = 1

    let vista: Vista
    try {
      await ceder()
      if (cerrado) {
        liberar()
        return
      }
      vista = await crear(render, ceder)
    } catch {
      liberar()
      return
    }
    if (cerrado) {
      vista.limpiar?.()
      liberar()
      return
    }

    const medir = () => {
      const r = canvas.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return
      render.setSize(r.width, r.height, false)
      vista.medir(r.width, r.height)
    }
    medir()
    const observaTamano = new ResizeObserver(medir)
    observaTamano.observe(canvas)

    let raf = 0
    let temporizador = 0
    let enPantalla = false
    let dejarDeVigilar: (() => void) | undefined
    let primerCuadro = true
    const inicio = performance.now()

    const parar = () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(temporizador)
      raf = 0
      temporizador = 0
    }
    const cuadro = (ahora: number) => {
      raf = 0
      if (!enPantalla) return
      const espera = vista.dibujar((ahora - inicio) / 1000)
      if (primerCuadro) {
        primerCuadro = false
        canvas.style.opacity = '1'
      }
      if (typeof espera === 'number' && espera > 8) {
        temporizador = window.setTimeout(() => {
          temporizador = 0
          raf = requestAnimationFrame(cuadro)
        }, espera)
      } else {
        raf = requestAnimationFrame(cuadro)
      }
    }
    // Si el equipo no alcanza, primero menos resolución; luego decide el nivel.
    const alIrLento = () => {
      if (dpr <= 1) return false
      dpr = Math.max(1, dpr - 0.3)
      render.setPixelRatio(dpr)
      medir()
      return true
    }

    let dejarDeObservar = () => undefined as void
    const arrancarBucle = () => {
      dejarDeObservar = observarVista(
        canvas,
        (visible) => {
          enPantalla = visible
          if (visible) {
            dejarDeVigilar ??= vigilarRendimiento(alIrLento)
            if (!raf && !temporizador) raf = requestAnimationFrame(cuadro)
          } else {
            dejarDeVigilar?.()
            dejarDeVigilar = undefined
            parar()
          }
        },
        '10%',
      )
    }

    soltar = () => {
      parar()
      enPantalla = false
      dejarDeVigilar?.()
      dejarDeObservar()
      observaTamano.disconnect()
      vista.limpiar?.()
      liberar()
    }

    // Compilar los shaders en paralelo evita el mayor congelón: el del primer dibujo.
    try {
      await Promise.race([vista.calentar?.(), new Promise((listo) => window.setTimeout(listo, ESPERA_COMPILAR_MS))])
      await ceder()
    } catch {
      // Si no se pudo adelantar, se compilará en el primer dibujo.
    }
    if (!cerrado) arrancarBucle()
  }

  // Quien llama ya esperó a que el lienzo esté por verse. La cola evita que varias escenas se armen a la vez.
  encolar(arrancar)

  return () => {
    cerrado = true
    soltar?.()
  }
}

/** Luz de estudio de producto: paneles largos que dejan reflejos limpios en el vidrio. */
export function entornoEstudio(render: THREE.WebGLRenderer) {
  const escena = new THREE.Scene()
  escena.background = new THREE.Color(0x0c1220)
  const panel = (x: number, y: number, z: number, an: number, al: number, fuerza: number, tono = 0xffffff) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(tono).multiplyScalar(fuerza), side: THREE.DoubleSide })
    const m = new THREE.Mesh(new THREE.PlaneGeometry(an, al), material)
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    escena.add(m)
  }
  panel(-6, 1, 3.2, 2.6, 12, 10)
  panel(6, 0.5, 3.6, 0.8, 11, 16)
  panel(1.4, 7, 2, 7, 3, 6)
  panel(-4.6, 0, -6, 1.2, 12, 7, 0xbfe9ff)
  panel(4.6, 0, -6, 1.6, 12, 6, 0xbfe9ff)
  panel(0, -7, 1, 8, 4, 0.9)
  const pmrem = new THREE.PMREMGenerator(render)
  const destino = pmrem.fromScene(escena, 0.008, 0.1, 50, { size: segunNivel(512, 256, 128) } as never)
  pmrem.dispose()
  return destino
}

/** Tiende una vista 3D de cámara simple. */
export function camaraPara(fov: number, distancia: number) {
  const c = new THREE.PerspectiveCamera(fov, 1, 0.1, 60)
  c.position.set(0, 0, distancia)
  return c
}

export const suave = (t: number) => {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}
