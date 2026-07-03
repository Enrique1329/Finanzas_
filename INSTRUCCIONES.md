# Cómo integrar la PWA en tu repo `misfinanzas`

## 1. Estructura de archivos final
Subí estos archivos a la raíz del repo (junto a tu `index.html` y `app.js`):

```
misfinanzas/
├── index.html          (el que ya tenés, con los agregados de abajo)
├── app.js               (el que ya tenés, SIN TOCAR)
├── manifest.json         ← nuevo
├── service-worker.js     ← nuevo
├── pwa-extra.js           ← nuevo
└── icons/
    ├── icon-192.png        ← nuevo
    ├── icon-512.png         ← nuevo
    ├── icon-maskable-192.png ← nuevo
    └── icon-maskable-512.png ← nuevo
```

## 2. Agregar esto al `<head>` de tu `index.html`
Justo después de `<title>Mis Finanzas</title>`:

```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#1E1E20">
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

## 3. Agregar el script antes de `</body>`
Buscá donde ya tenés `<script src="app.js"></script>` y agregá justo debajo:

```html
<script src="app.js"></script>
<script src="pwa-extra.js"></script>
```

## 4. Botón "Instalar app" (opcional pero recomendado)
En el sidebar de escritorio, cerca del selector de tema, agregá:

```html
<button id="btn-instalar-app" class="hidden w-full mb-2 px-3 py-2 rounded-lg text-sm font-medium t-btn-primary">
  📲 Instalar app
</button>
```

Y en el bloque móvil (`theme-switcher-mobile` o cerca del nav), lo mismo con otro id:

```html
<button id="btn-instalar-app-mobile" class="hidden text-xs px-2 py-1.5 rounded-lg t-btn-primary">
  📲 Instalar
</button>
```

Empiezan ocultos (`hidden`) y `pwa-extra.js` los muestra automáticamente
cuando el navegador detecta que la app se puede instalar.

## 5. Sección de Presupuestos (dentro de la vista Categorías)
Dentro de `<section id="view-categorias">`, después del listado de categorías,
agregá:

```html
<section class="t-card border rounded-2xl p-6 mb-8">
  <h2 class="text-sm font-semibold t-text-soft mb-1">Presupuestos mensuales</h2>
  <p class="text-xs t-text-faint mb-4">Ponle un límite a cada categoría. Te avisamos si te acercás o te pasás.</p>
  <div id="presupuestos-list"></div>
</section>

<section class="t-card border rounded-2xl p-4 mb-8 flex items-center justify-between">
  <div>
    <p class="text-sm font-medium">Notificaciones</p>
    <p class="text-xs t-text-faint">Avisos cuando te acercás al límite de un presupuesto (solo con la app abierta).</p>
  </div>
  <button id="btn-activar-notificaciones" class="px-3 py-1.5 rounded-lg t-btn-primary text-xs font-medium">
    Activar
  </button>
</section>
```

## 6. Botón exportar CSV
Cerca de donde ya tenés "Exportar backup" (JSON), agregá:

```html
<button id="btn-exportar-csv" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium t-hover t-text-soft">
  <span>📄</span> Exportar CSV
</button>
```

## 7. Recordatorios de pagos recurrentes
Subí también `recordatorios.js` a la raíz, y agregalo después de `pwa-extra.js`:

```html
<script src="pwa-extra.js"></script>
<script src="recordatorios.js"></script>
```

Dentro de `<section id="view-categorias">` (o donde prefieras, ej. en el
dashboard), agregá:

```html
<section class="t-card border rounded-2xl p-6 mb-8">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-sm font-semibold t-text-soft">Pagos recurrentes</h2>
    <button id="btn-nuevo-recordatorio" class="text-xs px-3 py-1.5 rounded-lg t-btn-primary font-medium">+ Nuevo</button>
  </div>
  <div id="recordatorios-list"></div>
</section>
```

Por ahora el botón "+ Nuevo" usa 3 `prompt()` simples del navegador
(nombre, monto, día del mes) — es la forma más rápida y sin dependencias
de agregar uno. Si después querés un modal más lindo como el de
transacciones, se puede armar, pero esto ya es 100% funcional.

## 8. Multi-cuenta (Efectivo / Banco / Tarjeta)
Subí `cuentas.js` a la raíz y agregalo al final, después de los demás:

```html
<script src="pwa-extra.js"></script>
<script src="recordatorios.js"></script>
<script src="cuentas.js"></script>
```

**a) Selector de cuenta dentro del modal de transacción.** Dentro de
`<div id="modal-transaccion">`, justo después del bloque de "Categoría"
(el `<select id="txn-categoria">` y su `<p id="error-categoria">`), agregá:

```html
<label class="block text-sm font-medium mb-1">Cuenta</label>
<select id="txn-cuenta" class="w-full px-3 py-2.5 rounded-lg border t-input text-sm mb-4 focus:ring-2 focus:ring-gray-900"></select>
```

**b) Sección de cuentas.** En el dashboard o en categorías, donde prefieras,
agregá:

```html
<section class="t-card border rounded-2xl p-6 mb-8">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-sm font-semibold t-text-soft">Cuentas</h2>
    <button id="btn-nueva-cuenta" class="text-xs px-3 py-1.5 rounded-lg t-btn-primary font-medium">+ Nueva</button>
  </div>
  <div id="cuentas-list"></div>
</section>
```

**Cómo funciona:** todas tus transacciones ya existentes se migran
automáticamente a una cuenta "General" la primera vez que cargues la
página con este script. El "Saldo total" de arriba no cambia (sigue
sumando todo), pero ahora además vas a ver el desglose por cuenta.
Al crear/editar una cuenta te pide el nombre y el saldo inicial con
2 `prompt()` simples — igual que los recordatorios, rápido y sin
dependencias. Si más adelante querés modales más lindos para esto,
se puede armar.

## 9. Subir todo a GitHub y probar
1. Arrastrá los archivos nuevos al repo en GitHub (o `git add . && git commit && git push`)
2. Esperá 1-2 minutos a que GitHub Pages actualice
3. Entrá desde el celu a `https://enrique1329.github.io/misfinanzas/`
4. En Android/Chrome: debería aparecer el botón "Instalar app" o el ícono en la barra de direcciones
5. En iPhone/Safari: Compartir → Agregar a pantalla de inicio

## Importante — límites reales (no son bugs)
- **Notificaciones**: solo funcionan mientras la app está abierta en una pestaña/ventana.
  Sin un servidor de "push" no hay forma gratuita de mandar notificaciones con el
  celular bloqueado o la app cerrada. Si más adelante querés eso de verdad,
  se necesita backend (ej. Firebase Cloud Messaging, gratis pero requiere más setup).
- **Offline**: el service worker cachea los archivos, así que la app *abre* sin
  internet, pero los datos siguen viviendo en `localStorage` de ese navegador
  puntual — no se sincronizan entre dispositivos (eso también requeriría backend).
- Cada vez que subas un cambio grande al código, subí también la versión del
  `CACHE_NAME` en `service-worker.js` (`v1` → `v2`), si no, los usuarios pueden
  seguir viendo la versión vieja cacheada por un tiempo.
