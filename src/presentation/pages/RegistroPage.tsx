import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Info } from 'lucide-react'
import { AuthShell } from '../components/auth/AuthShell'
import { ColdCareBrandPanel } from '../components/auth/ColdCareBrandPanel'
import { Input, Label, NativeSelect } from '../components/ui/input'

/** Frontend registration preview. It never persists credentials or calls an account API. */
export function RegistroPage() {
  const { i18n } = useTranslation()
  const en = i18n.language.startsWith('en')
  const copy = (es: string, english: string) => en ? english : es
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validado, setValidado] = useState(false)

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const campos = new FormData(form)
    const password = String(campos.get('password') ?? '')
    const confirmacion = String(campos.get('confirmacion') ?? '')
    setError(null)
    setValidado(false)
    if (password !== confirmacion) {
      setError(copy('Las contraseñas no coinciden. Revisa la confirmación.', 'Passwords do not match. Check the confirmation.'))
      form.querySelector<HTMLInputElement>('#registro-confirmacion')?.focus()
      return
    }
    for (const name of ['nombre', 'apellidos', 'establecimiento', 'direccion']) {
      if (!String(campos.get(name) ?? '').trim()) {
        setError(copy('Completa los campos con datos válidos.', 'Complete the fields with valid information.'))
        form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus()
        return
      }
    }
    setValidado(true)
    form.querySelector<HTMLInputElement>('#registro-password')!.value = ''
    form.querySelector<HTMLInputElement>('#registro-confirmacion')!.value = ''
  }

  return (
    <AuthShell brandPanel={<ColdCareBrandPanel />}>
      <Link to="/login" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />{copy('Volver al inicio de sesión', 'Back to sign in')}
      </Link>
      <h2 className="text-[28px] leading-[34px] font-bold tracking-tight text-foreground">{copy('Crear cuenta', 'Create account')}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{copy('Completa tus datos y los de tu establecimiento.', 'Enter your details and your establishment information.')}</p>
      <p className="my-5 flex items-start gap-2 rounded-(--radius-field) bg-primary-tint p-3 text-xs leading-5 text-ink-700">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {copy('Registro en demostración. Se valida el formulario; todavía no se crea una cuenta ni se envían datos al servidor.', 'Registration demo. The form is validated; no account is created and no data is sent to a server yet.')}
      </p>
      <form onSubmit={enviar} className="space-y-3.5" onChange={() => { setValidado(false); setError(null) }}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div><Label htmlFor="registro-nombre">{copy('Nombre', 'First name')}</Label><Input id="registro-nombre" name="nombre" autoComplete="given-name" required maxLength={80} /></div>
          <div><Label htmlFor="registro-apellidos">{copy('Apellidos', 'Last name')}</Label><Input id="registro-apellidos" name="apellidos" autoComplete="family-name" required maxLength={120} /></div>
        </div>
        <div><Label htmlFor="registro-email">{copy('Correo electrónico', 'Email address')}</Label><Input id="registro-email" name="email" type="email" autoComplete="email" required /></div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div><Label htmlFor="registro-telefono">{copy('Teléfono', 'Phone number')}</Label><Input id="registro-telefono" name="telefono" type="tel" autoComplete="tel" required minLength={6} maxLength={25} /></div>
          <div><Label htmlFor="registro-rol">{copy('Rol solicitado', 'Requested role')}</Label><NativeSelect id="registro-rol" name="rol" defaultValue="" required>
            <option value="" disabled>{copy('Seleccionar rol', 'Select a role')}</option>
            <option value="farmaceutico">{copy('Químico Farmacéutico', 'Pharmacist')}</option>
            <option value="tecnico">{copy('Técnico de Farmacia', 'Pharmacy technician')}</option>
            <option value="auditor">{copy('Cajero', 'Cashier')}</option>
            <option value="administrador">{copy('Administrador', 'Administrator')}</option>
          </NativeSelect></div>
        </div>
        <div><Label htmlFor="registro-establecimiento">{copy('Establecimiento', 'Establishment')}</Label><Input id="registro-establecimiento" name="establecimiento" autoComplete="organization" required maxLength={160} /></div>
        <div><Label htmlFor="registro-direccion">{copy('Dirección', 'Address')}</Label><Input id="registro-direccion" name="direccion" autoComplete="street-address" required maxLength={240} /></div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div><Label htmlFor="registro-password">{copy('Contraseña', 'Password')}</Label><div className="relative">
            <Input id="registro-password" name="password" type={mostrarPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required aria-describedby="registro-password-ayuda" className="pr-12" />
            <button type="button" onClick={() => setMostrarPassword(!mostrarPassword)} aria-label={mostrarPassword ? copy('Ocultar contraseñas', 'Hide passwords') : copy('Mostrar contraseñas', 'Show passwords')} className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-(--radius-field) text-muted hover:bg-background">{mostrarPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </div></div>
          <div><Label htmlFor="registro-confirmacion">{copy('Confirmar contraseña', 'Confirm password')}</Label><Input id="registro-confirmacion" name="confirmacion" type={mostrarPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required aria-invalid={Boolean(error)} /></div>
        </div>
        <p id="registro-password-ayuda" className="text-xs leading-5 text-muted">{copy('Mínimo 8 caracteres. El rol solicitado no concede permisos automáticamente.', 'At least 8 characters. Requesting a role does not automatically grant permissions.')}</p>
        {error && <p role="alert" className="rounded-(--radius-field) bg-critical-tint p-3 text-sm leading-5 text-critical">{error}</p>}
        {validado && <div role="status" className="flex items-start gap-2 rounded-(--radius-field) bg-secondary-tint p-3 text-sm leading-5 text-glacier-700"><CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /><p>{copy('Formulario validado en demostración. No se creó una cuenta ni se enviaron datos. Las contraseñas se borraron del formulario.', 'Form validated in demo mode. No account was created and no data was sent. Passwords were cleared from the form.')}</p></div>}
        <button type="submit" className="coldcare-primary-action flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-semibold">{copy('Crear cuenta (demo)', 'Create account (demo)')}<ArrowRight className="size-4" aria-hidden /></button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">{copy('¿Ya tienes una cuenta?', 'Already have an account?')} <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">{copy('Iniciar sesión', 'Sign in')}</Link></p>
    </AuthShell>
  )
}
