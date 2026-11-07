import * as THREE from 'three'

import { rendimiento, ritmoQuieto } from '@/lib/rendimiento'
import { entornoEstudio, iniciarLienzo } from './lienzo'
import { crearVial, type VarianteVial } from './vial3d'

/* Lo que tarda el vial en llegar a su estado después de un cambio. */
const ASENTADO_S = 2.5
/* Con el cursor en movimiento: suficiente para que el vial lo siga, sin competir con la gráfica. */
const AL_MOVER_S = 1 / 30
/* Quieto y sin nada que dibujar: solo se mira de vez en cuando si llegó una lectura. */
const DESCANSO_MS = 250

interface OpcionesEscena {
  fase: number
  variante: VarianteVial
  /** Lectura actual en °C; `null` cuando no hay dato fiable. La lectura cambia, la escena no se rehace. */
  lectura: () => number | null
}

/**
 * La escena del vial del panel. Aquí, y no en `VialEquipo`, está todo lo que pesa: three se descarga
 * solo si este equipo va a dibujarlo.
 */
export function iniciarEscenaVial(canvas: HTMLCanvasElement, { fase, variante, lectura }: OpcionesEscena): () => void {
  return iniciarLienzo(canvas, async (render, ceder) => {
    const escena = new THREE.Scene()
    const entorno = entornoEstudio(render)
    escena.environment = entorno.texture
    await ceder()

    const camara = new THREE.PerspectiveCamera(24, 1, 0.1, 40)
    // En equipos modestos, menos polígonos, menos capas de vidrio y menos gotas.
    const vial = crearVial(render, { variante, detalle: rendimiento.nivel })
    vial.grupo.rotation.z = -0.14
    escena.add(vial.grupo)

    // En táctil no hay cursor que seguir: ni siquiera se escucha.
    const conCursor = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false
    let px = 0
    let py = 0
    const alPuntero = (e: PointerEvent) => {
      px = e.clientX / window.innerWidth - 0.5
      py = e.clientY / window.innerHeight - 0.5
    }
    if (conCursor) window.addEventListener('pointermove', alPuntero, { passive: true })

    let vaiven = fase
    let previo = 0
    let ultimoDibujo = -Infinity
    let lecturaDibujada: number | null | undefined
    let pxDibujado = 0
    let pyDibujado = 0
    let asentandoHasta = 0
    // Cambiar el tamaño vacía el lienzo: hay que volver a dibujar aunque nada se mueva.
    let sucio = true

    return {
      medir: (an, al) => {
        camara.aspect = an / al
        const tan = Math.tan((12 * Math.PI) / 180)
        camara.position.z = Math.max(1.72 / tan, 0.95 / (tan * camara.aspect))
        camara.updateProjectionMatrix()
        sucio = true
      },
      calentar: () => render.compileAsync(escena, camara),
      dibujar: (t) => {
        const dt = Math.min(0.25, t - previo)
        previo = t
        // Sin tarjeta gráfica que sobre no hay vaivén ni cursor: se dibuja solo cuando algo cambia.
        const bajo = rendimiento.nivel === 'bajo'
        // Cuanto más lejos del rango, más inquieto; sin datos, quieto.
        const inquietud = vial.inquietud()
        const sinVaiven = bajo || inquietud < 0.02
        if (!sinVaiven) vaiven += dt * 0.3 * inquietud

        const actual = lectura()
        const cursorMovido = !bajo && (Math.abs(px - pxDibujado) > 0.003 || Math.abs(py - pyDibujado) > 0.003)
        const seMueve = sucio || cursorMovido || actual !== lecturaDibujada
        if (seMueve) asentandoHasta = t + ASENTADO_S
        if (sinVaiven && !seMueve && t > asentandoHasta) return DESCANSO_MS

        const intervalo = sucio
          ? 0
          : cursorMovido
            ? AL_MOVER_S
            : Math.max(AL_MOVER_S, ritmoQuieto() / Math.max(1, inquietud))
        const falta = intervalo - (t - ultimoDibujo)
        if (falta > 0.004) return falta * 1000

        vial.estado(actual, t)
        const cursor = bajo ? 0 : 1
        vial.grupo.rotation.y = vial.giroFrente + Math.sin(vaiven) * 0.34 + px * 0.5 * cursor
        vial.grupo.rotation.x = py * 0.16 * cursor
        render.render(escena, camara)
        ultimoDibujo = t
        lecturaDibujada = actual
        pxDibujado = px
        pyDibujado = py
        sucio = false
        // Justo antes de que toque: despertar mucho antes gastaría un cuadro de pantalla sin dibujar nada.
        return intervalo * 1000 - 4
      },
      limpiar: () => {
        window.removeEventListener('pointermove', alPuntero)
        vial.limpiar()
        entorno.dispose()
      },
    }
  })
}
