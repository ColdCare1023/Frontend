import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { PATRON_DEVICE_ID, type CredencialRotada } from '@/domain/entities/Dispositivo'
import { Button } from '../../../components/ui/button'
import { Input, Label } from '../../../components/ui/input'
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '../../../components/ui/side-panel'
import { MensajeFormulario, RevelarToken, type Mensaje } from '../compartido'
import { useFlota } from '../contextoFlota'

const FORM_INICIAL = { id: '', nombre: '', ubicacion: '', mc38: false }

/**
 * HU-43: alta de un equipo en dos pasos dentro de un panel lateral. Paso 1,
 * los datos de siempre; paso 2, la credencial emitida, visible UNA vez
 * (FE-003). Cerrar el panel descarta el token.
 */
export function PanelRegistrarEquipo({ abierto, alCambiar }: { abierto: boolean; alCambiar: (abierto: boolean) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { registrarDispositivo } = useFlota()
  const [form, setForm] = useState(FORM_INICIAL)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const [alta, setAlta] = useState<{ id: string; credencial: CredencialRotada } | null>(null)

  const cerrar = (siguiente: boolean) => {
    if (!siguiente) {
      setForm(FORM_INICIAL)
      setMensaje(null)
      setAlta(null)
    }
    alCambiar(siguiente)
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const deviceId = form.id.trim().toUpperCase()
    if (!PATRON_DEVICE_ID.test(deviceId)) {
      setMensaje({ tipo: 'error', texto: t('dispositivos.codigoInvalido') })
      return
    }
    setEnviando(true)
    setMensaje(null)
    const resultado = await registrarDispositivo({
      device_id: deviceId,
      nombre: form.nombre.trim(),
      ubicacion: form.ubicacion.trim(),
      sensores: form.mc38 ? ['DS18B20', 'SHT31', 'MC-38'] : ['DS18B20', 'SHT31'],
    })
    setEnviando(false)
    if (resultado.resultado === 'ok') {
      setForm(FORM_INICIAL)
      setAlta({ id: deviceId, credencial: resultado.credencial })
    } else {
      setMensaje({ tipo: 'error', texto: t(resultado.resultado === 'duplicado' ? 'dispositivos.codigoDuplicado' : 'comunes.error') })
    }
  }

  const paso = alta ? 2 : 1

  return (
    <SidePanel open={abierto} onOpenChange={cerrar}>
      <SidePanelContent className="sm:max-w-120">
        <SidePanelHeader>
          <SidePanelTitle>{t('dispositivos.nuevoEquipo')}</SidePanelTitle>
          <SidePanelDescription>
            <span className="nums">{t('dispositivos.registro.paso', { n: paso })}</span>
            {' · '}
            {t(paso === 1 ? 'dispositivos.registro.pasoDatos' : 'dispositivos.registro.pasoCredencial')}
          </SidePanelDescription>
        </SidePanelHeader>
        {alta ? (
          <>
            <SidePanelBody key="credencial" className="space-y-4 animate-(--animate-pestana)">
              <p role="status" className="rounded-(--radius-field) bg-success-100 px-3 py-2 text-meta text-success-700">
                {t('dispositivos.equipoRegistrado')}
              </p>
              <RevelarToken credencial={alta.credencial} alTerminar={() => cerrar(false)} textoTerminar={t('comunes.cerrar')} />
            </SidePanelBody>
            <SidePanelFooter>
              <Button
                onClick={() => {
                  const id = alta.id
                  cerrar(false)
                  navigate(`/dispositivos/${encodeURIComponent(id)}?tab=seguridad`)
                }}
              >
                {t('dispositivos.registro.irAlEquipo')}
              </Button>
            </SidePanelFooter>
          </>
        ) : (
          <form onSubmit={(e) => void enviar(e)} className="flex min-h-0 flex-1 flex-col">
            <SidePanelBody className="space-y-4">
              <p className="text-meta text-muted">{t('dispositivos.registroAyuda')}</p>
              <div>
                <Label htmlFor="nuevo-device-id">{t('dispositivos.id')}</Label>
                <Input
                  id="nuevo-device-id"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })}
                  placeholder="FARM-03-CDL"
                  pattern="[A-Z0-9][A-Z0-9-]{2,39}"
                  aria-describedby="nuevo-device-id-ayuda"
                  className="codigo"
                  required
                />
                <p id="nuevo-device-id-ayuda" className="mt-1 text-meta text-muted">{t('dispositivos.codigoUnicoAyuda')}</p>
              </div>
              <div>
                <Label htmlFor="nuevo-device-nombre">{t('dispositivos.nombreEquipo')}</Label>
                <Input id="nuevo-device-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="nuevo-device-ubicacion">{t('dispositivos.ubicacion')}</Label>
                <Input id="nuevo-device-ubicacion" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} required />
              </div>
              <fieldset className="rounded-(--radius-field) border border-border p-3">
                <legend className="px-1 text-body font-medium">{t('dispositivos.sensores')}</legend>
                <p className="text-meta text-muted">DS18B20 · SHT31</p>
                <label className="mt-2 flex min-h-11 items-center gap-2 text-body">
                  <input type="checkbox" checked={form.mc38} onChange={(e) => setForm({ ...form, mc38: e.target.checked })} />
                  MC-38 · {t('dispositivos.opcional')}
                </label>
              </fieldset>
              <MensajeFormulario mensaje={mensaje} />
            </SidePanelBody>
            <SidePanelFooter>
              <Button variant="ghost" onClick={() => cerrar(false)} disabled={enviando}>{t('usuarios.cancelar')}</Button>
              <Button type="submit" disabled={enviando}>{enviando ? t('dispositivos.procesando') : t('dispositivos.registrarEquipo')}</Button>
            </SidePanelFooter>
          </form>
        )}
      </SidePanelContent>
    </SidePanel>
  )
}
