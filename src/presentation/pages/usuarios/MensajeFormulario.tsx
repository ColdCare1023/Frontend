export type MensajeDialogo = { tipo: 'ok' | 'error'; texto: string } | null

/** Resultado de un formulario: `status` si salió bien, `alert` si falló. */
export function MensajeFormulario({ mensaje }: { mensaje: MensajeDialogo }) {
  if (!mensaje) return null
  return (
    <p
      role={mensaje.tipo === 'error' ? 'alert' : 'status'}
      className={
        mensaje.tipo === 'ok'
          ? 'rounded-(--radius-field) bg-success-100 px-3 py-2 text-meta text-success-700'
          : 'rounded-(--radius-field) bg-critical-tint px-3 py-2 text-meta text-critical'
      }
    >
      {mensaje.texto}
    </p>
  )
}
