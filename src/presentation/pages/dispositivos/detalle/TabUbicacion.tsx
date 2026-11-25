import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, MapPin, Pencil, UserRound } from 'lucide-react'

import type { Dispositivo } from '@/domain/entities/Dispositivo'
import { fechaCorta } from '@/lib/formato'
import { Button } from '../../../components/ui/button'
import { Input, Label, Textarea } from '../../../components/ui/input'
import { SelectorFecha } from '../../../components/ui/selector-fecha'
import { Aviso, Dato, MensajeFormulario, PieFormulario, Tarjeta, type Mensaje } from '../compartido'
import { useFlota } from '../contextoFlota'
import { CAMPOS_RESPONSABLE, CAMPOS_UBICACION, nombreInstalador } from '../estadoEquipo'
import { useCambiosEquipo } from './datosEquipo'
import { LineaTiempoCambios } from './LineaTiempoCambios'

const CAMPOS_CAMBIOS = [...CAMPOS_UBICACION, ...CAMPOS_RESPONSABLE]

/** HU-51 (ubicación e instalación) y HU-52/53/54 (responsable de avisos). */
export function TabUbicacion({ dispositivo }: { dispositivo: Dispositivo }) {
  const { t } = useTranslation()
  const { actualizarInstalacion, actualizarResponsable } = useFlota()
  const { cambios, cargando, recargar } = useCambiosEquipo(dispositivo.id)
  const instalador = nombreInstalador(dispositivo.instalado_por, cambios)

  return (
    <div className="grid grid-cols-12 items-start gap-3 xl:gap-4">
      <EditableEnLinea
        id="ubicacion"
        titulo={t('dispositivos.editarInstalacion')}
        icono={MapPin}
        etiquetaEditar={t('dispositivos.ubicacionTab.editarUbicacionA', { id: dispositivo.id })}
        inicial={{
          ubicacion: dispositivo.ubicacion ?? '',
          fecha: dispositivo.fecha_instalacion ?? '',
          observaciones: dispositivo.observaciones_instalacion ?? '',
        }}
        guardar={async (f) => {
          const r = await actualizarInstalacion(dispositivo.id, f.ubicacion, f.fecha, f.observaciones)
          if (r === 'ok') void recargar()
          return r === 'ok' ? t('dispositivos.instalacionGuardada') : null
        }}
        lectura={
          <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <Dato etiqueta={t('dispositivos.ubicacion')}>{dispositivo.ubicacion || '—'}</Dato>
            <Dato etiqueta={t('dispositivos.fechaInstalacion')}>
              <span className="nums">{dispositivo.fecha_instalacion ? fechaCorta(dispositivo.fecha_instalacion) : '—'}</span>
            </Dato>
            {/* HU-51 esc. 2: responsable de la instalación registrada. */}
            <Dato etiqueta={t('dispositivos.ubicacionTab.instaladoPor')}>
              {!dispositivo.instalado_por ? (
                '—'
              ) : instalador ? (
                instalador
              ) : cargando ? (
                '…'
              ) : (
                <span className="codigo text-subtle" title={dispositivo.instalado_por}>
                  {t('dispositivos.ubicacionTab.instaladorSinNombre', { id: dispositivo.instalado_por.slice(0, 8) })}
                </span>
              )}
            </Dato>
            {dispositivo.observaciones_instalacion && <Dato etiqueta={t('dispositivos.observaciones')} className="sm:col-span-2">{dispositivo.observaciones_instalacion}</Dato>}
          </dl>
        }
        campos={(f, set) => (
          <>
            <div>
              <Label htmlFor="i-ubicacion">{t('dispositivos.ubicacion')}</Label>
              <Input id="i-ubicacion" value={f.ubicacion} onChange={(e) => set({ ...f, ubicacion: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="i-fecha">{t('dispositivos.fechaInstalacion')}</Label>
              <SelectorFecha id="i-fecha" valor={f.fecha} onCambiar={(fecha) => set({ ...f, fecha })} />
            </div>
            <div>
              <Label htmlFor="i-observaciones">{t('dispositivos.observaciones')}</Label>
              <Textarea id="i-observaciones" value={f.observaciones} onChange={(e) => set({ ...f, observaciones: e.target.value })} />
            </div>
            <p className="text-meta text-faint">{t('dispositivos.instalacionAviso')}</p>
          </>
        )}
      />

      <EditableEnLinea
        id="responsable"
        titulo={t('dispositivos.editarResponsable')}
        icono={UserRound}
        etiquetaEditar={t('dispositivos.ubicacionTab.editarResponsableA', { id: dispositivo.id })}
        inicial={{
          nombre: dispositivo.responsable_nombre ?? '',
          email: dispositivo.responsable_email ?? '',
          // HU-53 (SMS) está fuera del alcance: el teléfono ya no se pide ni se
          // muestra, pero el que exista se reenvía igual para no borrarlo al guardar.
          telefono: dispositivo.responsable_telefono ?? '',
        }}
        guardar={async (f) => {
          const r = await actualizarResponsable(dispositivo.id, f.nombre, f.email, f.telefono)
          if (r === 'ok') void recargar()
          return r === 'ok' ? t('dispositivos.responsableGuardado') : null
        }}
        lectura={
          <>
            {!dispositivo.responsable_nombre && !dispositivo.responsable_email && (
              <Aviso tono="warn" className="mb-2">{t('dispositivos.ubicacionTab.sinResponsable')}</Aviso>
            )}
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <Dato etiqueta={t('dispositivos.responsableNombre')}>{dispositivo.responsable_nombre || '—'}</Dato>
              <Dato etiqueta={t('dispositivos.responsableEmail')}>{dispositivo.responsable_email || '—'}</Dato>
            </dl>
          </>
        }
        campos={(f, set) => (
          <>
            <div>
              <Label htmlFor="r-nombre">{t('dispositivos.responsableNombre')}</Label>
              <Input id="r-nombre" value={f.nombre} onChange={(e) => set({ ...f, nombre: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="r-email">{t('dispositivos.responsableEmail')}</Label>
              <Input id="r-email" type="email" value={f.email} onChange={(e) => set({ ...f, email: e.target.value })} />
            </div>
            <p className="text-meta text-faint">{t('dispositivos.responsableAviso')}</p>
          </>
        )}
      />

      <Tarjeta id="ubicacion-cambios" titulo={t('dispositivos.ubicacionTab.cambios')} icono={History} className="col-span-12">
        <LineaTiempoCambios cambios={cambios} cargando={cargando} campos={CAMPOS_CAMBIOS} className="max-h-70 overflow-y-auto" />
      </Tarjeta>
    </div>
  )
}

/**
 * Tarjeta que se lee y, con «Editar», se convierte en su formulario en el
 * mismo sitio. Al guardar anuncia el resultado y vuelve el foco a «Editar».
 */
function EditableEnLinea<F extends Record<string, string>>({
  id,
  titulo,
  icono,
  etiquetaEditar,
  inicial,
  guardar,
  lectura,
  campos,
}: {
  id: string
  titulo: string
  icono: React.ComponentType<{ className?: string }>
  etiquetaEditar: string
  inicial: F
  guardar: (form: F) => Promise<string | null>
  lectura: React.ReactNode
  campos: (form: F, set: (form: F) => void) => React.ReactNode
}) {
  const { t } = useTranslation()
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(inicial)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const contenedor = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (editando) contenedor.current?.querySelector<HTMLElement>('input, textarea')?.focus()
  }, [editando])

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setEnviando(true)
    setMensaje(null)
    const texto = await guardar(form)
    setEnviando(false)
    if (texto) {
      setMensaje({ tipo: 'ok', texto })
      window.setTimeout(() => {
        setEditando(false)
        requestAnimationFrame(() => boton.current?.focus())
      }, 800)
    } else {
      setMensaje({ tipo: 'error', texto: t('comunes.error') })
    }
  }

  return (
    <Tarjeta
      id={`tarjeta-${id}`}
      titulo={titulo}
      icono={icono}
      className="col-span-12 lg:col-span-6"
      accion={
        !editando && (
          <Button
            ref={boton}
            variant="ghost"
            size="sm"
            aria-label={etiquetaEditar}
            onClick={() => {
              setForm(inicial)
              setMensaje(null)
              setEditando(true)
            }}
          >
            <Pencil />
            {t('dispositivos.ubicacionTab.editar')}
          </Button>
        )
      }
    >
      {editando ? (
        <form ref={contenedor} onSubmit={(e) => void enviar(e)} className="space-y-3 animate-(--animate-pop-in)">
          {campos(form, setForm)}
          <MensajeFormulario mensaje={mensaje} />
          <PieFormulario>
            <Button variant="ghost" onClick={() => setEditando(false)} disabled={enviando}>{t('usuarios.cancelar')}</Button>
            <Button type="submit" disabled={enviando}>{enviando ? t('dispositivos.procesando') : t('comunes.guardar')}</Button>
          </PieFormulario>
        </form>
      ) : (
        <>
          {lectura}
          {mensaje?.tipo === 'ok' && <MensajeFormulario className="mt-3" mensaje={mensaje} />}
        </>
      )}
    </Tarjeta>
  )
}
