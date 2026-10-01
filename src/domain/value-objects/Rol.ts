// HU-41: AUDITOR es de solo lectura — nunca aparece en la lista de
// `permitidos` de una acción que escribe (reconocer alerta, registrar
// acción correctiva, editar dispositivos, etc.), solo en las de consulta.
export type Rol = 'administrador' | 'farmaceutico' | 'tecnico' | 'auditor'

export const ROLES: Rol[] = ['administrador', 'farmaceutico', 'tecnico', 'auditor']

/** Traduce códigos del backlog/API al identificador estable de la interfaz. */
export function normalizarRol(valor: unknown): Rol | null {
  if (typeof valor !== 'string') return null
  const canonico: Record<string, Rol> = {
    administrador: 'administrador',
    ADMINISTRADOR: 'administrador',
    farmaceutico: 'farmaceutico',
    QUIMICO_FARMACEUTICO: 'farmaceutico',
    tecnico: 'tecnico',
    TECNICO_FARMACIA: 'tecnico',
    auditor: 'auditor',
    AUDITOR: 'auditor',
  }
  return canonico[valor] ?? null
}

/** RBAC jerárquico: el administrador accede a todo. */
export function tienePermiso(rol: Rol, permitidos: Rol[]): boolean {
  return rol === 'administrador' || permitidos.includes(rol)
}
