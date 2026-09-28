// HU-41: AUDITOR es de solo lectura — nunca aparece en la lista de
// `permitidos` de una acción que escribe (reconocer alerta, registrar
// acción correctiva, editar dispositivos, etc.), solo en las de consulta.
export type Rol = 'administrador' | 'farmaceutico' | 'tecnico' | 'auditor'

export const ROLES: Rol[] = ['administrador', 'farmaceutico', 'tecnico', 'auditor']

/** RBAC jerárquico: el administrador accede a todo. */
export function tienePermiso(rol: Rol, permitidos: Rol[]): boolean {
  return rol === 'administrador' || permitidos.includes(rol)
}
