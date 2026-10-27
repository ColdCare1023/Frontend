# Despliegue del frontend en Vercel (HU-55, A-1)

Vercel servía `npm run build:demo`: datos simulados en memoria. Con eso no se
puede verificar ninguna HU contra el sistema real (HU-19, 31, 32, 33, 34, 36…).

## Pasos

1. Desplegar el backend en Railway y anotar su URL HTTPS
   (ver `Backend/docs/operacion/HU-55_despliegue_railway.md`).
2. Regenerar `vercel.json` con esa URL y confirmarlo en el repositorio:

   ```bash
   node scripts/generar-vercel-json.mjs https://<servicio>.up.railway.app
   ```

   Esto cambia `buildCommand` a `npm run build && npm run verificar:bundle` y
   agrega el backend a `connect-src` de la CSP (sin ello el navegador bloquea la
   API y el SSE).
3. En Vercel → *Settings → Environment Variables* (Production):
   `VITE_API_BASE_URL=https://<servicio>.up.railway.app`. El build falla si
   falta o no es HTTPS (`vite.config.ts`).
4. En el backend, `CORS_ORIGINS=["https://<proyecto>.vercel.app"]`.

## Comprobaciones

- El build de Vercel termina con «Build de producción sin modo demo».
- En el navegador, *Login* no muestra las cuentas demo.
- El dashboard recibe lecturas por SSE del nodo real.
- El CI avisa (`vercel.json en modo producción`) mientras `vercel.json` siga en demo.
