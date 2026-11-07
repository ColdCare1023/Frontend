import * as THREE from 'three'

/*
 * Un vial de vacuna: medidas de un 2R (Ø 16 mm × 35 mm), pared y base gruesas de vidrio,
 * líquido con menisco, tapón de goma, casquillo de aluminio y tapa flip-off.
 *
 * Reacciona a la temperatura en tres estados que se funden entre sí:
 *   frío (en rango)   → escarcha sobre el vidrio y cristales que caen.
 *   cerca del límite  → la escarcha se derrite, el vidrio suda y las gotas escurren.
 *   fuera de rango    → el líquido se tiñe y el borde se enciende.
 *   sin datos         → apagado y quieto.
 * Es una señal de estado de la interfaz: un medicamento real no cambia así de aspecto.
 */
const v = (x: number, y: number) => new THREE.Vector2(x, y)
const suaveEntre = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const R = 0.74
const PERFIL_EXTERIOR = [
  v(0.001, -1.56), v(R - 0.2, -1.56), v(R - 0.09, -1.55), v(R - 0.03, -1.52), v(R, -1.46),
  v(R, 0.46), v(R - 0.012, 0.55), v(R - 0.06, 0.66), v(R - 0.16, 0.77), v(R - 0.28, 0.85), v(0.41, 0.91), v(0.385, 0.97), v(0.385, 1.06),
  v(0.44, 1.08), v(0.505, 1.11), v(0.515, 1.17), v(0.505, 1.24), v(0.45, 1.27), v(0.001, 1.27),
]
const P = R - 0.052
const PERFIL_INTERIOR = [
  v(0.001, -1.4), v(0.3, -1.41), v(P - 0.1, -1.43), v(P - 0.03, -1.4), v(P, -1.33),
  v(P, 0.44), v(P - 0.014, 0.53), v(P - 0.06, 0.63), v(P - 0.16, 0.74), v(P - 0.27, 0.82), v(0.355, 0.88), v(0.33, 0.95), v(0.33, 1.27),
]
const NIVEL = 0.08
const PERFIL_LIQUIDO = [
  v(0.001, -1.395), v(0.3, -1.405), v(P - 0.105, -1.425), v(P - 0.04, -1.395), v(P - 0.006, -1.33),
  v(P - 0.006, NIVEL + 0.035), v(P - 0.03, NIVEL + 0.012), v(P - 0.09, NIVEL + 0.002), v(0.001, NIVEL),
]
const PERFIL_GOMA = [v(0.001, 1.28), v(0.325, 1.28), v(0.325, 0.96), v(0.3, 0.9), v(0.001, 0.9)]
const PERFIL_CASQUILLO = [
  v(0.001, 1.36), v(0.47, 1.36), v(0.525, 1.345), v(0.545, 1.31), v(0.548, 1.12), v(0.54, 1.05), v(0.5, 1.01), v(0.44, 1.0), v(0.415, 1.03),
]
const PERFIL_TAPA = [
  v(0.001, 1.53), v(0.25, 1.535), v(0.42, 1.525), v(0.495, 1.5), v(0.515, 1.46), v(0.52, 1.37), v(0.49, 1.35), v(0.001, 1.35),
]

/*
 * Lo que se guarda en un refrigerador de botica no es una sola cosa. Cada variante cambia la forma
 * del envase, la tapa, el líquido y la etiqueta; todas reaccionan igual a la temperatura.
 */
export type VarianteVial = 'vacuna' | 'insulina' | 'biologico' | 'ampolla'
export const VARIANTES: VarianteVial[] = ['vacuna', 'insulina', 'biologico', 'ampolla']

interface Forma {
  exterior: THREE.Vector2[]
  interior: THREE.Vector2[]
  liquido: THREE.Vector2[]
  goma?: THREE.Vector2[]
  casquillo?: THREE.Vector2[]
  tapa?: THREE.Vector2[]
  /** Anillo de color en el cuello de la ampolla. */
  anillo?: { y: number; radio: number }
  radio: number
  arriba: number
  abajo: number
  altoEscarcha: number
  altoEtiqueta: number
  yEtiqueta: number
  colorTapa: number
  liquidoFrio: [number, number, number]
  densidad: number
  etiqueta: { color: string; nombre: string }
}

/** Cambia el cuerpo y deja el cuello y la tapa como están. */
function moldear(puntos: THREE.Vector2[], fx: number, fy: number) {
  return puntos.map((q) => {
    const t = suaveEntre(0.46, 1, q.y)
    return v(q.x * (fx + (1 - fx) * t), q.y < 0.46 ? 0.46 + (q.y - 0.46) * fy : q.y)
  })
}

function formaDe(variante: VarianteVial): Forma {
  const base = {
    goma: PERFIL_GOMA,
    casquillo: PERFIL_CASQUILLO,
    tapa: PERFIL_TAPA,
    arriba: 0.46,
    altoEscarcha: 1,
  }
  if (variante === 'insulina') {
    const fx = 0.84
    const fy = 1.26
    return {
      ...base,
      exterior: moldear(PERFIL_EXTERIOR, fx, fy),
      interior: moldear(PERFIL_INTERIOR, fx, fy),
      liquido: moldear(PERFIL_LIQUIDO, fx, fy),
      radio: R * fx,
      abajo: 0.46 + (-1.46 - 0.46) * fy,
      altoEtiqueta: 1.3,
      yEtiqueta: -0.86,
      colorTapa: 0xff7aa2,
      liquidoFrio: [0.9, 0.97, 1],
      densidad: 0.1,
      etiqueta: { color: '#ff5c8a', nombre: 'Insulina' },
    }
  }
  if (variante === 'biologico') {
    const fx = 1.14
    const fy = 0.78
    return {
      ...base,
      exterior: moldear(PERFIL_EXTERIOR, fx, fy),
      interior: moldear(PERFIL_INTERIOR, fx, fy),
      liquido: moldear(PERFIL_LIQUIDO, fx, fy),
      radio: R * fx,
      abajo: 0.46 + (-1.46 - 0.46) * fy,
      altoEtiqueta: 1,
      yEtiqueta: -0.46,
      colorTapa: 0x00d1ff,
      liquidoFrio: [0.8, 0.5, 0.2],
      densidad: 0.42,
      etiqueta: { color: '#008fb0', nombre: 'Biológico' },
    }
  }
  if (variante === 'ampolla') {
    const r = 0.56
    const i = r - 0.035
    return {
      exterior: [
        v(0.001, -1.46), v(0.3, -1.46), v(r - 0.07, -1.43), v(r - 0.01, -1.33), v(r, -1.26), v(r, 0.22), v(r - 0.03, 0.32), v(r - 0.13, 0.46), v(r - 0.28, 0.58),
        v(0.178, 0.68), v(0.17, 0.76), v(0.22, 0.88), v(0.27, 1.02), v(0.25, 1.18), v(0.17, 1.34), v(0.095, 1.46), v(0.045, 1.54), v(0.001, 1.56),
      ],
      interior: [
        v(0.001, -1.42), v(0.28, -1.42), v(i - 0.07, -1.39), v(i - 0.01, -1.3), v(i, -1.23), v(i, 0.2), v(i - 0.03, 0.3), v(i - 0.13, 0.44), v(i - 0.26, 0.56),
        v(0.145, 0.67), v(0.138, 0.76), v(0.19, 0.88), v(0.235, 1.02), v(0.215, 1.17), v(0.14, 1.32), v(0.07, 1.44), v(0.001, 1.52),
      ],
      liquido: [v(0.001, -1.415), v(0.28, -1.415), v(i - 0.075, -1.385), v(i - 0.012, -1.3), v(i - 0.006, -1.23), v(i - 0.006, 0.06), v(i - 0.05, 0.03), v(0.001, 0.02)],
      anillo: { y: 0.72, radio: 0.182 },
      radio: r,
      arriba: 0.22,
      abajo: -1.3,
      altoEscarcha: 0.62,
      altoEtiqueta: 0.86,
      yEtiqueta: -0.56,
      colorTapa: 0x0b5cff,
      liquidoFrio: [0.92, 0.97, 1],
      densidad: 0.1,
      etiqueta: { color: '#0b5cff', nombre: 'Oxitocina' },
    }
  }
  return {
    ...base,
    exterior: PERFIL_EXTERIOR,
    interior: PERFIL_INTERIOR,
    liquido: PERFIL_LIQUIDO,
    radio: R,
    abajo: -1.46,
    altoEtiqueta: 1.2,
    yEtiqueta: -0.58,
    colorTapa: 0x0b5cff,
    liquidoFrio: [0.86, 0.96, 1],
    densidad: 0.14,
    etiqueta: { color: '#0b5cff', nombre: 'Vacuna' },
  }
}

/** Todas las variantes miden lo mismo en pantalla y quedan centradas. */
function medidaDe(forma: Forma) {
  const alturas = forma.exterior.map((q) => q.y).concat(forma.tapa ? forma.tapa.map((q) => q.y) : [])
  const yMin = Math.min(...alturas)
  const yMax = Math.max(...alturas)
  const ajuste = 3.09 / (yMax - yMin)
  return { ajuste, subida: -((yMin + yMax) / 2) * ajuste }
}

function azarDesde(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

/** Reparte el perfil a pasos iguales: la escarcha necesita una textura sin estirones. */
function perfilUniforme(puntos: THREE.Vector2[], desplazamiento: number, n: number) {
  const curvas = new THREE.Path(puntos)
  return curvas.getSpacedPoints(n).map((p) => v(p.x + (p.x > 0.01 ? desplazamiento : 0), p.y))
}

let lienzoEscarcha: HTMLCanvasElement | null = null

/** Se dibuja una sola vez: cada vial del panel usa el mismo lienzo. */
function texturaEscarcha() {
  if (lienzoEscarcha) {
    const copia = new THREE.CanvasTexture(lienzoEscarcha)
    copia.colorSpace = THREE.SRGBColorSpace
    copia.wrapS = THREE.RepeatWrapping
    return copia
  }
  const c = document.createElement('canvas')
  c.width = 1536
  c.height = 900
  const x = c.getContext('2d')!
  const r = azarDesde(29)
  const W = c.width
  const H = c.height

  // Hielo denso abajo y en el hombro; casi nada a la altura de la etiqueta.
  const base = x.createLinearGradient(0, H, 0, 0)
  base.addColorStop(0, 'rgba(255,255,255,0.92)')
  base.addColorStop(0.32, 'rgba(255,255,255,0.56)')
  base.addColorStop(0.46, 'rgba(255,255,255,0.12)')
  base.addColorStop(0.72, 'rgba(255,255,255,0.08)')
  base.addColorStop(0.86, 'rgba(255,255,255,0.46)')
  base.addColorStop(1, 'rgba(255,255,255,0.6)')
  x.fillStyle = base
  x.fillRect(0, 0, W, H)

  const rama = (x0: number, y0: number, a0: number, largo: number, nivel: number) => {
    let px = x0
    let py = y0
    let a = a0
    let hecho = 0
    let brote = 6 + r() * 8
    const paso = nivel === 0 ? 7 : 5
    x.lineWidth = nivel === 0 ? 2.6 : nivel === 1 ? 1.7 : 1
    while (hecho < largo) {
      a += (r() - 0.5) * 0.12
      const nx = px + Math.cos(a) * paso
      const ny = py + Math.sin(a) * paso
      x.beginPath()
      x.moveTo(px, py)
      x.lineTo(nx, ny)
      x.stroke()
      px = nx
      py = ny
      hecho += paso
      brote -= paso
      if (brote <= 0 && nivel < 2) {
        const resto = (1 - hecho / largo) * largo * 0.42
        if (resto > 12) {
          rama(px, py, a + 1.05, resto, nivel + 1)
          rama(px, py, a - 1.05, resto * 0.85, nivel + 1)
          x.lineWidth = nivel === 0 ? 2.6 : 1.7
        }
        brote = 10 + r() * 14
      }
    }
  }
  x.strokeStyle = 'rgba(255,255,255,0.96)'
  x.lineCap = 'round'
  for (let i = 0; i < 26; i += 1) rama(r() * W, H * (0.72 + r() * 0.06), -Math.PI / 2 + (r() - 0.5) * 0.9, 90 + r() * 170, 0)
  for (let i = 0; i < 18; i += 1) rama(r() * W, H * (0.14 + r() * 0.06), Math.PI / 2 + (r() - 0.5) * 0.9, 60 + r() * 110, 0)

  // Grano de hielo.
  for (let i = 0; i < 2600; i += 1) {
    x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`
    x.beginPath()
    x.arc(r() * W, r() * H, 0.6 + r() * 1.5, 0, Math.PI * 2)
    x.fill()
  }
  lienzoEscarcha = c
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return t
}

function texturaAura() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.42, 'rgba(255,255,255,0.42)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

function materialVidrio(lado: THREE.Side, fuerza: number, tinte: { uTinte: { value: THREE.Color }; uFuerzaTinte: { value: number } }, ligero: boolean) {
  const base = { color: 0xffffff, metalness: 0, roughness: 0.03, envMapIntensity: 1.25, transparent: true, side: lado, depthWrite: false }
  // Sin barniz, el material estándar refleja igual que el físico y cuesta menos.
  const m = ligero ? new THREE.MeshStandardMaterial(base) : new THREE.MeshPhysicalMaterial({ ...base, ior: 1.5 })
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, tinte)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uTinte;\nuniform float uFuerzaTinte;`)
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float borde = pow(1.0 - saturate(abs(dot(normalize(vViewPosition), normal))), 2.6);
        float brillo = smoothstep(1.1, 3.2, dot(outgoingLight, vec3(0.333)));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uTinte, borde * uFuerzaTinte);
        gl_FragColor.a = clamp(max(mix(0.012, ${fuerza.toFixed(2)} + uFuerzaTinte * 0.3, borde), brillo), 0.0, 1.0) * opacity;`,
      )
  }
  return m
}

function materialLiquido(densidad: { value: number }, ligero: boolean) {
  const Material = ligero ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial
  const m = new Material({ color: 0xf6fcff, roughness: 0.14, envMapIntensity: 0.55, transparent: true, depthWrite: false })
  m.onBeforeCompile = (s) => {
    s.uniforms.uDensidad = densidad
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uDensidad;`).replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float borde = pow(1.0 - saturate(abs(dot(normalize(vViewPosition), normal))), 1.8);
      gl_FragColor.a = mix(uDensidad, 0.62 + uDensidad * 0.4, borde) * opacity;`,
    )
  }
  return m
}

function texturaEtiqueta(render: THREE.WebGLRenderer, datos: Forma['etiqueta'], arco: number, maxAnisotropia: number) {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 860
  const x = c.getContext('2d')!
  const FUENTE = '"Inter Variable", ui-sans-serif, system-ui, sans-serif'
  x.fillStyle = '#fbfaf5'
  x.fillRect(0, 0, c.width, c.height)
  // El fleje arriba y su eco abajo enmarcan el nombre.
  x.fillStyle = datos.color
  x.fillRect(0, 0, c.width, 104)
  x.fillRect(0, c.height - 30, c.width, 30)

  // De frente se ve un cuarto de la textura hacia adentro (`giroFrente`): ahí va todo, centrado.
  const centro = c.width * 0.25
  const visible = Math.min((c.width * (Math.PI * 0.62)) / arco, centro * 2 - 90)
  x.textAlign = 'center'
  x.textBaseline = 'alphabetic'
  x.fillStyle = '#0f172a'
  let tam = 224
  x.font = `650 ${tam}px ${FUENTE}`
  x.letterSpacing = '-4px'
  const ancho = x.measureText(datos.nombre).width
  if (ancho > visible) {
    tam = Math.floor((tam * visible) / ancho)
    x.font = `650 ${tam}px ${FUENTE}`
  }
  x.fillText(datos.nombre, centro, 436)
  x.letterSpacing = '0px'
  x.fillStyle = datos.color
  x.fillRect(centro - 66, 496, 132, 8)
  x.fillStyle = '#334155'
  x.font = `600 104px ${FUENTE}`
  x.fillText('2 °C – 8 °C', centro, 660)

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = Math.min(maxAnisotropia, render.capabilities.getMaxAnisotropy())
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/** Rugosidad en anillos finos: el pulido torneado del aluminio. */
function texturaTorneado() {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 256
  const x = c.getContext('2d')!
  let semilla = 7
  for (let y = 0; y < 256; y += 1) {
    semilla = (semilla * 16807) % 2147483647
    const g = 110 + (semilla % 90)
    x.fillStyle = `rgb(${g} ${g} ${g})`
    x.fillRect(0, y, 8, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

const VERTICE_AMBIENTE = /* glsl */ `
  uniform float uT;
  uniform float uDir;
  uniform float uPixel;
  attribute float aVel;
  attribute float aFase;
  attribute float aTam;
  varying float vFundido;
  void main() {
    float rango = 4.0;
    float y = mod(position.y + uDir * uT * aVel + rango * 0.5, rango) - rango * 0.5;
    vec3 p = vec3(position.x + sin(uT * 0.7 + aFase) * 0.09, y, position.z + cos(uT * 0.5 + aFase) * 0.09);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aTam * uPixel * (11.0 / -mv.z);
    vFundido = 1.0 - smoothstep(1.3, 1.95, abs(y));
  }
`
const FRAGMENTO_AMBIENTE = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlfa;
  varying float vFundido;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, uAlfa * vFundido * smoothstep(0.5, 0.14, d));
  }
`

export interface Vial {
  grupo: THREE.Group
  /** 0 = invisible, 1 = entero. Para disolverlo en partículas. */
  opacidad: (o: number) => void
  /** Temperatura actual (null = sin datos) y tiempo en segundos. Llamar en cada cuadro. */
  estado: (temperatura: number | null, t: number, deGolpe?: boolean) => void
  /** Qué tan inquieto debe moverse: 1 en calma, más alto fuera de rango, 0 sin datos. */
  inquietud: () => number
  /** Giro con el que el nombre de la etiqueta queda de frente. */
  giroFrente: number
  limpiar: () => void
}

export function crearVial(
  render: THREE.WebGLRenderer,
  { aura: conAura = false, variante = 'vacuna', detalle = 'alto' }: { aura?: boolean; variante?: VarianteVial; detalle?: 'alto' | 'medio' | 'bajo' } = {},
): Vial {
  const forma = formaDe(variante)
  const grupo = new THREE.Group()
  const { ajuste, subida } = medidaDe(forma)
  const cuerpo = new THREE.Group()
  cuerpo.scale.setScalar(ajuste)
  cuerpo.position.y = subida
  grupo.add(cuerpo)
  const SEG = detalle === 'alto' ? 128 : detalle === 'medio' ? 64 : 40
  /* En equipos modestos el vidrio pinta menos capas una encima de otra: es lo que más cuesta. */
  const ligero = detalle !== 'alto'
  const geometrias: THREE.BufferGeometry[] = []
  const materiales: THREE.Material[] = []
  const texturas: THREE.Texture[] = []
  const malla = (g: THREE.BufferGeometry, m: THREE.Material, orden: number) => {
    geometrias.push(g)
    materiales.push(m)
    const o = new THREE.Mesh(g, m)
    o.renderOrder = orden
    cuerpo.add(o)
    return o
  }

  // El resplandor del estado, detrás de todo.
  const texAura = texturaAura()
  texturas.push(texAura)
  const matAura = new THREE.SpriteMaterial({ map: texAura, transparent: true, depthWrite: false, depthTest: false, opacity: 0, blending: THREE.AdditiveBlending })
  materiales.push(matAura)
  const aura = new THREE.Sprite(matAura)
  aura.scale.setScalar(5.2)
  aura.renderOrder = 0
  // Sobre una foto, el resplandor deja ver los bordes del lienzo.
  if (conAura) grupo.add(aura)

  const tinte = { uTinte: { value: new THREE.Color(1, 1, 1) }, uFuerzaTinte: { value: 0 } }
  const densidad = { value: forma.densidad }

  const exterior = new THREE.LatheGeometry(forma.exterior, SEG)
  const interior = new THREE.LatheGeometry(forma.interior, SEG)
  if (!ligero) {
    malla(exterior, materialVidrio(THREE.BackSide, 0.34, tinte, ligero), 1)
    malla(interior, materialVidrio(THREE.BackSide, 0.22, tinte, ligero), 2)
  }

  const goma = new THREE.MeshStandardMaterial({ color: 0x39424c, roughness: 0.78, envMapIntensity: 0.45, transparent: true })
  if (forma.goma) malla(new THREE.LatheGeometry(forma.goma, 48), goma, 3)
  const matLiquido = materialLiquido(densidad, ligero)
  malla(new THREE.LatheGeometry(forma.liquido, SEG), matLiquido, 4)
  malla(interior, materialVidrio(THREE.FrontSide, 0.16, tinte, ligero), 5)

  // La etiqueta conserva sus proporciones: en un envase angosto da más vuelta.
  const arco = Math.min(Math.PI * 1.7, (forma.altoEtiqueta * 2.38) / forma.radio)
  const texturaPapel = texturaEtiqueta(render, forma.etiqueta, arco, detalle === 'alto' ? 16 : detalle === 'medio' ? 8 : 2)
  texturas.push(texturaPapel)
  const basePapel = { map: texturaPapel, envMapIntensity: 0.62, side: THREE.FrontSide, transparent: true }
  const papel = ligero
    ? new THREE.MeshStandardMaterial({ ...basePapel, roughness: 0.46 })
    : new THREE.MeshPhysicalMaterial({ ...basePapel, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.42 })
  const reverso = new THREE.MeshStandardMaterial({ color: 0xe9e8e0, roughness: 0.85, envMapIntensity: 0.4, side: THREE.BackSide, transparent: true })
  const geoEtiqueta = new THREE.CylinderGeometry(forma.radio + 0.004, forma.radio + 0.004, forma.altoEtiqueta, SEG, 1, true, -arco / 2, arco)
  const etiqueta = malla(geoEtiqueta, papel, 6)
  etiqueta.position.y = forma.yEtiqueta
  const etiquetaAtras = malla(geoEtiqueta, reverso, 3)
  etiquetaAtras.position.y = forma.yEtiqueta

  malla(exterior, materialVidrio(THREE.FrontSide, 0.72, tinte, ligero), 7)

  // La piel de escarcha: está en frío y se derrite al subir la temperatura.
  const texEscarcha = texturaEscarcha()
  texturas.push(texEscarcha)
  const matEscarcha = new THREE.MeshStandardMaterial({
    map: texEscarcha,
    transparent: true,
    depthWrite: false,
    roughness: 0.82,
    envMapIntensity: 0.7,
    emissive: 0xffffff,
    emissiveMap: texEscarcha,
    emissiveIntensity: 0.34,
    opacity: 0,
  })
  const pielEscarcha = malla(new THREE.LatheGeometry(perfilUniforme(forma.exterior.filter((q) => q.y < forma.altoEscarcha), 0.008, 70), SEG), matEscarcha, 7)

  const torneado = texturaTorneado()
  texturas.push(torneado)
  const aluminio = new THREE.MeshStandardMaterial({
    color: 0xe6ebf0,
    metalness: 0.92,
    roughness: 0.62,
    roughnessMap: torneado,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
    transparent: true,
  })
  if (forma.casquillo) malla(new THREE.LatheGeometry(forma.casquillo, SEG), aluminio, 8)
  const basePlastico = { color: forma.colorTapa, envMapIntensity: 0.9, side: THREE.DoubleSide, transparent: true }
  const plastico = ligero
    ? new THREE.MeshStandardMaterial({ ...basePlastico, roughness: 0.28 })
    : new THREE.MeshPhysicalMaterial({ ...basePlastico, roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.28 })
  if (forma.tapa) malla(new THREE.LatheGeometry(forma.tapa, SEG), plastico, 9)
  if (forma.anillo) {
    const banda = malla(new THREE.CylinderGeometry(forma.anillo.radio, forma.anillo.radio, 0.05, 48, 1, true), plastico, 9)
    banda.position.y = forma.anillo.y
  }

  // Condensación: gotas sobre el vidrio. Una parte escurre cuando el vial suda.
  const CANTIDAD = detalle === 'alto' ? 260 : detalle === 'medio' ? 150 : 70
  const CORREDORAS = Math.round(CANTIDAD * 0.3)
  const geoGota = ligero ? new THREE.SphereGeometry(1, 8, 6) : new THREE.SphereGeometry(1, 12, 8)
  const matGota = materialVidrio(THREE.FrontSide, 0.95, tinte, ligero)
  matGota.envMapIntensity = 1.8
  const gotas = new THREE.InstancedMesh(geoGota, matGota, CANTIDAD)
  gotas.renderOrder = 10
  geometrias.push(geoGota)
  materiales.push(matGota)
  const azar = azarDesde(41)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const esc = new THREE.Vector3()
  const eje = new THREE.Vector3(0, 0, 1)
  const normal = new THREE.Vector3()
  const datosGota = Array.from({ length: CANTIDAD }, () => {
    const hondo = forma.abajo + 0.04
    const techo = forma.arriba + 0.02
    const etiquetaArriba = forma.yEtiqueta + forma.altoEtiqueta / 2
    const etiquetaAbajo = forma.yEtiqueta - forma.altoEtiqueta / 2
    let y = hondo + azar() * (techo - hondo)
    // Dentro de la zona de la etiqueta solo sobreviven unas pocas.
    if (y > etiquetaAbajo && y < etiquetaArriba && azar() < 0.72) y = azar() < 0.55 ? etiquetaArriba + azar() * Math.max(0.02, techo - etiquetaArriba) : hondo + azar() * Math.max(0.02, etiquetaAbajo - hondo)
    return { a: azar() * Math.PI * 2, y, tam: 0.006 + azar() * azar() * 0.03, largo: 1.05 + azar() * 0.4, vel: 0.12 + azar() * 0.5 }
  })
  const colocar = (i: number, escala: number, estirar: number) => {
    const d = datosGota[i]
    normal.set(Math.sin(d.a), 0, Math.cos(d.a))
    pos.copy(normal).multiplyScalar(forma.radio + 0.002)
    pos.y = d.y
    const tam = d.tam * escala
    esc.set(tam, tam * d.largo * estirar, tam * 0.42)
    q.setFromUnitVectors(eje, normal)
    m.compose(pos, q, esc)
    gotas.setMatrixAt(i, m)
  }
  for (let i = 0; i < CANTIDAD; i += 1) colocar(i, 0.7, 1)
  gotas.instanceMatrix.needsUpdate = true
  cuerpo.add(gotas)

  // Cristales que caen en frío.
  const NP = detalle === 'alto' ? 90 : detalle === 'medio' ? 50 : 24
  const geoAmb = new THREE.BufferGeometry()
  const posAmb = new Float32Array(NP * 3)
  const vel = new Float32Array(NP)
  const fase = new Float32Array(NP)
  const tamAmb = new Float32Array(NP)
  for (let i = 0; i < NP; i += 1) {
    const a = azar() * Math.PI * 2
    const r = 0.9 + azar() * 0.75
    posAmb.set([Math.sin(a) * r, azar() * 4 - 2, Math.cos(a) * r], i * 3)
    vel[i] = 0.12 + azar() * 0.26
    fase[i] = azar() * 6.28
    tamAmb[i] = 1.6 + azar() * 3.4
  }
  geoAmb.setAttribute('position', new THREE.BufferAttribute(posAmb, 3))
  geoAmb.setAttribute('aVel', new THREE.BufferAttribute(vel, 1))
  geoAmb.setAttribute('aFase', new THREE.BufferAttribute(fase, 1))
  geoAmb.setAttribute('aTam', new THREE.BufferAttribute(tamAmb, 1))
  const matAmb = new THREE.ShaderMaterial({
    vertexShader: VERTICE_AMBIENTE,
    fragmentShader: FRAGMENTO_AMBIENTE,
    uniforms: {
      uT: { value: 0 },
      uDir: { value: -1 },
      uPixel: { value: render.getPixelRatio() },
      uColor: { value: new THREE.Color(1, 1, 1) },
      uAlfa: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
  })
  geometrias.push(geoAmb)
  materiales.push(matAmb)
  const ambiente = new THREE.Points(geoAmb, matAmb)
  ambiente.frustumCulled = false
  ambiente.renderOrder = 11
  grupo.add(ambiente)

  const transparentes = [papel, reverso, aluminio, plastico, goma]
  const vidrios = materiales.filter((mat) => mat !== matEscarcha && mat !== matAura && mat !== matAmb)
  let op = 1
  let frio = 0
  let sudor = 0
  let calor = 0
  let apagado = 0
  let ultimaEscala = 0.7
  let tiempoAmb = 0
  let previo = 0
  const cFrio = new THREE.Color(...forma.liquidoFrio)
  const cTibio = new THREE.Color(1, 0.88, 0.66)
  const cCaliente = new THREE.Color(1, 0.3, 0.2)
  const cApagado = new THREE.Color(0.72, 0.74, 0.77)
  const cLiquido = new THREE.Color()
  const cAura = new THREE.Color()
  const cAuraFrio = new THREE.Color(0.72, 0.94, 1)
  const cAuraCalor = new THREE.Color(1, 0.36, 0.2)

  return {
    grupo,
    opacidad: (o) => {
      op = o
      for (const mat of vidrios) mat.opacity = o
      for (const mat of transparentes) mat.opacity = o
      gotas.visible = o > 0.02
      pielEscarcha.visible = o > 0.02
      ambiente.visible = o > 0.02
      aura.visible = o > 0.02
    },
    estado: (temperatura, t, deGolpe = false) => {
      // Un vial quieto se dibuja a pocos cuadros por segundo: el tope deja que llegue igual a su estado.
      const dt = Math.min(0.12, t - previo)
      previo = t
      const k = deGolpe ? 1 : 1 - Math.exp(-dt * 2.4)
      const sinDato = temperatura == null || !Number.isFinite(temperatura)
      const f = sinDato ? 0 : suaveEntre(7, 5.5, temperatura)
      const s = sinDato ? 0 : suaveEntre(5.8, 7.6, temperatura) * (1 - suaveEntre(9.4, 10.4, temperatura) * 0.3)
      const c = sinDato ? 0 : suaveEntre(7.9, 9.7, temperatura)
      frio += (f - frio) * k
      sudor += (s - sudor) * k
      calor += (c - calor) * k
      apagado += ((sinDato ? 1 : 0) - apagado) * k

      matEscarcha.opacity = frio * op
      cLiquido.copy(cFrio).lerp(cTibio, sudor * (1 - calor)).lerp(cCaliente, calor).lerp(cApagado, apagado)
      matLiquido.color.copy(cLiquido)
      densidad.value = forma.densidad + sudor * 0.08 + calor * 0.3
      matLiquido.emissive.copy(cCaliente)
      matLiquido.emissiveIntensity = calor * 0.5

      // Borde: hielo en frío; en calor, un pulso lento (sin sacudidas).
      const pulso = 0.82 + Math.sin(t * 2.6) * 0.18
      tinte.uTinte.value.copy(cAuraFrio).lerp(cAuraCalor, calor)
      tinte.uFuerzaTinte.value = frio * 0.32 + calor * 0.78 * pulso

      cAura.copy(cAuraFrio).lerp(cAuraCalor, calor)
      matAura.color.copy(cAura)
      matAura.opacity = (frio * 0.26 + sudor * (1 - calor) * 0.05 + calor * 0.5 * pulso) * op

      // Gotas: crecen y escurren al sudar.
      const escala = 0.62 + sudor * 1.05 + calor * 0.25
      const cambio = Math.abs(escala - ultimaEscala) > 0.015
      const corre = Math.max(sudor, calor * 0.8)
      if (cambio || corre > 0.04) {
        for (let i = 0; i < CANTIDAD; i += 1) {
          const corredora = i < CORREDORAS
          if (!cambio && !corredora) continue
          if (corredora && corre > 0.04) {
            const d = datosGota[i]
            d.y -= d.vel * corre * dt
            if (d.y < forma.abajo) d.y = forma.arriba + 0.04
          }
          colocar(i, escala * (corredora ? 1.15 : 1), corredora ? 1 + corre * 0.9 : 1)
        }
        ultimaEscala = escala
        gotas.instanceMatrix.needsUpdate = true
      }

      // Ambiente: cristales solo cuando está frío.
      tiempoAmb += dt
      matAmb.uniforms.uT.value = tiempoAmb
      matAmb.uniforms.uAlfa.value = frio * 0.9 * op
    },
    // Sin lecturas no hay nada que contar: el vial se queda quieto.
    inquietud: () => (1 + sudor * 0.9 + calor * 2.6) * (1 - apagado),
    giroFrente: arco * 0.25,
    limpiar: () => {
      geometrias.forEach((g) => g.dispose())
      materiales.forEach((mat) => mat.dispose())
      texturas.forEach((t) => t.dispose())
      gotas.dispose()
    },
  }
}

/** Puntos sobre la superficie del vial, para que las partículas nazcan de su forma. */
export function muestrearVial(cantidad: number, variante: VarianteVial = 'vacuna') {
  const forma = formaDe(variante)
  const { ajuste, subida } = medidaDe(forma)
  const perfil = forma.exterior.slice(1, -1)
  const largos: number[] = []
  let total = 0
  for (let i = 0; i < perfil.length - 1; i += 1) {
    const d = perfil[i].distanceTo(perfil[i + 1]) * (perfil[i].x + perfil[i + 1].x)
    total += d
    largos.push(total)
  }
  const salida = new Float32Array(cantidad * 3)
  const azar = azarDesde(77)
  for (let k = 0; k < cantidad; k += 1) {
    const elegido = azar() * total
    let i = 0
    while (i < largos.length - 1 && largos[i] < elegido) i += 1
    const t = azar()
    const x = perfil[i].x + (perfil[i + 1].x - perfil[i].x) * t
    const y = perfil[i].y + (perfil[i + 1].y - perfil[i].y) * t
    const a = azar() * Math.PI * 2
    salida[k * 3] = Math.sin(a) * x * ajuste
    salida[k * 3 + 1] = y * ajuste + subida
    salida[k * 3 + 2] = Math.cos(a) * x * ajuste
  }
  return salida
}
