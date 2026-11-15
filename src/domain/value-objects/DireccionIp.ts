/**
 * Proxy (HU-55, B-11): si la IP que el backend ve como cliente es pública.
 *
 * Detrás del proxy de la plataforma, con `X-Forwarded-For` y la lista de
 * proxies de confianza bien configuradas, el backend ve la IP pública del
 * navegador; si no, ve la IP interna del proxy (p. ej. 100.64.x.x en el CGNAT
 * de la plataforma). La pantalla solo dice «pública: sí/no»: la IP es la del
 * propio usuario y no se muestra.
 *
 * No públicas: 0/8, 10/8, 100.64/10 (CGNAT), 127/8, 169.254/16 (enlace local),
 * 172.16/12, 192.168/16; en IPv6, `::`, `::1`, fc00::/7 y fe80::/10. Una IPv4
 * mapeada en IPv6 (`::ffff:10.0.0.1`) se evalúa como IPv4. Devuelve `null` si
 * el valor no es una IP (sin dato o un nombre de host).
 */
export function esIpPublica(ip: unknown): boolean | null {
  if (typeof ip !== 'string') return null
  const valor = ip.trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '')
  const v4 = octetosIPv4(valor)
  if (v4) return ipv4Publica(v4)
  const v6 = gruposIPv6(valor)
  if (v6) return ipv6Publica(v6)
  return null
}

function octetosIPv4(valor: string): number[] | null {
  const partes = valor.split('.')
  if (partes.length !== 4) return null
  const octetos = partes.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  return octetos.every((o) => Number.isInteger(o) && o >= 0 && o <= 255) ? octetos : null
}

function ipv4Publica([a, b]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  return true
}

/** Ocho grupos de 16 bits, o `null` si no es IPv6. Admite `::` y el sufijo IPv4. */
function gruposIPv6(valor: string): number[] | null {
  if (!valor.includes(':') || !/^[0-9a-f:.]+$/i.test(valor)) return null
  const dobles = valor.split('::')
  if (dobles.length > 2) return null
  const lado = (texto: string): number[] | null => {
    if (texto === '') return []
    const grupos: number[] = []
    const piezas = texto.split(':')
    for (let i = 0; i < piezas.length; i++) {
      const pieza = piezas[i]
      if (i === piezas.length - 1 && pieza.includes('.')) {
        const v4 = octetosIPv4(pieza)
        if (!v4) return null
        grupos.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3])
      } else if (/^[0-9a-f]{1,4}$/i.test(pieza)) {
        grupos.push(parseInt(pieza, 16))
      } else {
        return null
      }
    }
    return grupos
  }
  const izquierda = lado(dobles[0])
  const derecha = dobles.length === 2 ? lado(dobles[1]) : []
  if (!izquierda || !derecha) return null
  if (dobles.length === 1) return izquierda.length === 8 ? izquierda : null
  const faltan = 8 - izquierda.length - derecha.length
  if (faltan < 1) return null
  return [...izquierda, ...new Array<number>(faltan).fill(0), ...derecha]
}

function ipv6Publica(grupos: number[]): boolean {
  const ceros = (n: number) => grupos.slice(0, n).every((g) => g === 0)
  // IPv4 mapeada (::ffff:a.b.c.d): manda la IPv4.
  if (ceros(5) && grupos[5] === 0xffff) {
    return ipv4Publica([grupos[6] >> 8, grupos[6] & 0xff, grupos[7] >> 8, grupos[7] & 0xff])
  }
  if (ceros(7) && (grupos[7] === 0 || grupos[7] === 1)) return false // :: y ::1
  if ((grupos[0] & 0xfe00) === 0xfc00) return false // fc00::/7
  if ((grupos[0] & 0xffc0) === 0xfe80) return false // fe80::/10
  return true
}
