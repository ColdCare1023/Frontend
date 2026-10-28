// Aplica el tema guardado antes del primer pintado: sin destello claro al
// cargar en oscuro. Archivo externo porque la CSP (script-src 'self') prohíbe
// scripts en línea. La lógica completa vive en src/infrastructure/tema/tema.ts.
;(function () {
  var guardado = null
  try {
    guardado = window.localStorage.getItem('coldcare-tema')
  } catch (e) {
    guardado = null
  }
  var preferencia = guardado === 'light' || guardado === 'dark' || guardado === 'system' ? guardado : 'dark'
  var oscuro =
    preferencia === 'dark' ||
    (preferencia === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  var raiz = document.documentElement
  raiz.setAttribute('data-theme', oscuro ? 'dark' : 'light')
  raiz.style.colorScheme = oscuro ? 'dark' : 'light'
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', oscuro ? '#0B1220' : '#F4F7FB')
})()
