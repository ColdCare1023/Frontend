# ColdCare · Frontend

Panel web de monitoreo de cadena de frío farmacéutica (2–8 °C): React 19, Vite,
Tailwind CSS v4, Radix UI e i18next (español e inglés, tema claro y oscuro).

## Dos modos de datos

| Comando | Datos | Uso |
|---|---|---|
| `npm run dev` | **Backend real** y sensores IoT, por `/api` y SSE | Operación y pruebas integradas |
| `npm run dev:demo` | Simulados en memoria, con cuentas demo | Presentaciones sin backend |

El modo backend no incluye ningún dato ni cuenta de demostración: el build lo
verifica (`npm run verificar:bundle`).

## Conectar el IoT en local

El front queda listo para leer los sensores en cuanto el backend los recibe:
no hay que tocar código.

1. **Backend** ([ColdCare1023/Backend](https://github.com/ColdCare1023/Backend)):
   sigue su README (variables `DATABASE_URL`, `MQTT_*` del broker donde publica el
   ESP32, `alembic upgrade head`, `python -m scripts.seed_dev`) y arráncalo con
   `uvicorn src.interface.main:app --reload` en `http://localhost:8000`.
2. **Frontend**:

   ```bash
   npm install
   npm run dev
   ```

   Abre `http://localhost:5173`. Vite reenvía `/api` y el flujo SSE al backend,
   así que no hay CORS que configurar. Para usar otro backend (por ejemplo el de
   Railway), copia `.env.example` a `.env.local` y define `COLDCARE_BACKEND_URL`.
3. **Alta del equipo** (rol administrador): *Dispositivos → Registrar equipo* con
   el mismo `device_id` que tiene el firmware. Copia el token que aparece una
   sola vez, crea con él el usuario del nodo en el broker, grábalo en el ESP32
   (`nvs set mqtt_token`) y confirma la operación desde *Opciones* del equipo.
4. **Encender el nodo**: cada lectura llega por MQTT al backend y de ahí al
   *Monitoreo* por SSE, sin recargar. El rótulo «En vivo» indica el flujo activo;
   «Reconectando…» significa que el backend no responde y el cliente reintenta
   solo (1 s, 2 s, 4 s… hasta 30 s).

Notas:

- La sesión vive solo en memoria: recargar la página la cierra (control de
  seguridad, no un fallo).
- La primera vez cada cuenta acepta el aviso de privacidad (Ley N.° 29733); las
  pantallas cargan sus datos después de aceptarlo.
- Las horas se muestran en la zona del navegador. El backend trabaja en UTC; si
  omite la zona (SQLite en desarrollo), el cliente la asume UTC.

## Variables de entorno

Ver [`.env.example`](.env.example). Ninguna variable `VITE_*` puede contener
secretos: quedan dentro del JavaScript publicado.

## Calidad

```bash
npm run typecheck
npm run lint
npm run test:run
npm run test:e2e
```

## Despliegue

Vercel con backend en Railway: [DESPLIEGUE.md](DESPLIEGUE.md).
