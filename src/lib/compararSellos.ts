/** Índice del primer carácter distinto entre dos sellos, o −1 si son iguales. */
export function primerCaracterDistinto(a: string, b: string): number {
  const largo = Math.max(a.length, b.length)
  for (let i = 0; i < largo; i++) {
    if (a[i] !== b[i]) return i
  }
  return -1
}
