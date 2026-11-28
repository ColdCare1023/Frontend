# Verificación de interfaz · 25 de noviembre de 2026

Se revisaron las 18 rutas en Chrome con datos de demostración a 1440 × 900 y 390 × 844. Las 36 vistas cargaron sin errores de JavaScript ni desbordes horizontales. El recorrido farmacéutico cubre revisar el equipo, reconocer una alerta, registrar una acción y consultar después su historial sin salir de Monitoreo. [Vista general](Vista%20general.jpg)

## Equipo sin datos

El caso reproduce un ESP32 con una última lectura de 1,2 °C, cinco alertas críticas pendientes y 79 lecturas perdidas. El tablero identifica la medición como histórica, muestra la fecha, permite atender las cinco alertas y conserva el contador de pérdidas en la ficha del equipo. Las capturas se obtuvieron con datos sintéticos. [Escritorio](monitoreo-sin-datos-1366.png) · [Móvil](monitoreo-sin-datos-390.png) · [Mediciones del navegador](verificacion-monitoreo-sin-datos.json)

## Pruebas

| Comprobación | Resultado |
| --- | --- |
| Pruebas del frontend con Vitest | 1191 aprobadas |
| Recorridos y comparaciones visuales con Playwright en Chrome | 86 aprobados |
| ESLint y compilaciones de demostración y producción | Aprobados |
| Inspección del paquete de producción | Adaptador de demostración excluido |

Se comprobaron siete cuentas ficticias en ambos tamaños, incluido el cambio de contraseña temporal y el reingreso. La plantilla del correo se probó con un código sintético que comienza con cero. Los seis dígitos se pudieron seleccionar y copiar con la acción del navegador dentro del mismo documento.
