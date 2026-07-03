// ===================================================================
// pwa-extra.js
// Módulo adicional que se suma a app.js SIN modificarlo.
// Se carga después de app.js en index.html:
//   <script src="app.js"></script>
//   <script src="pwa-extra.js"></script>
//
// Agrega: Service Worker, botón instalar, presupuestos por categoría
// con alertas, notificaciones del navegador, y exportar a CSV.
// Todo gratis, todo local (sin servidor, sin cuentas externas).
// ===================================================================

const STORAGE_KEY_TXN_EXT = 'gastos_app_transacciones';
const STORAGE_KEY_CAT_EXT = 'gastos_app_categorias';
const STORAGE_KEY_PRESUPUESTOS = 'gastos_app_presupuestos'; // { catId: montoLimite }

// -------------------------------------------------------------
// 1) SERVICE WORKER: registro
// -------------------------------------------------------------
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('Service worker registrado:', reg.scope))
      .catch((err) => console.error('Error registrando service worker:', err));
  });
}

// -------------------------------------------------------------
// 2) BOTÓN "INSTALAR APP"
//    Chrome/Android disparan 'beforeinstallprompt'. iOS/Safari NO
//    lo soporta (ahí hay que usar "Compartir > Agregar a inicio").
// -------------------------------------------------------------
let eventoInstalacionDiferido = null;

function inicializarBotonInstalar() {
  const btnDesktop = document.getElementById('btn-instalar-app');
  const btnMobile = document.getElementById('btn-instalar-app-mobile');
  const botones = [btnDesktop, btnMobile].filter(Boolean);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacionDiferido = e;
    botones.forEach((b) => b.classList.remove('hidden'));
  });

  botones.forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!eventoInstalacionDiferido) {
        // iOS u otro navegador sin soporte: mostramos instrucciones manuales
        alert('Para instalar en iPhone/iPad: toca el ícono de Compartir en Safari y elige "Agregar a pantalla de inicio".');
        return;
      }
      eventoInstalacionDiferido.prompt();
      await eventoInstalacionDiferido.userChoice;
      eventoInstalacionDiferido = null;
      botones.forEach((b) => b.classList.add('hidden'));
    });
  });

  window.addEventListener('appinstalled', () => {
    botones.forEach((b) => b.classList.add('hidden'));
  });
}

// -------------------------------------------------------------
// 3) PRESUPUESTOS POR CATEGORÍA
// -------------------------------------------------------------
function cargarPresupuestos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESUPUESTOS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error leyendo presupuestos:', e);
    return {};
  }
}

function guardarPresupuestos(presupuestos) {
  try {
    localStorage.setItem(STORAGE_KEY_PRESUPUESTOS, JSON.stringify(presupuestos));
  } catch (e) {
    console.error('Error guardando presupuestos:', e);
  }
}

function obtenerCategoriasExt() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAT_EXT);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function gastosPorCategoriaDelMesExt() {
  const raw = localStorage.getItem(STORAGE_KEY_TXN_EXT);
  const transacciones = raw ? JSON.parse(raw) : [];
  const ahora = new Date();
  const totales = {};

  transacciones
    .filter((t) => t.tipo === 'gasto')
    .filter((t) => {
      const f = new Date(t.fecha + 'T00:00:00');
      return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
    })
    .forEach((t) => {
      totales[t.categoriaId] = (totales[t.categoriaId] || 0) + t.monto;
    });

  return totales;
}

function renderPresupuestos() {
  const cont = document.getElementById('presupuestos-list');
  if (!cont) return; // si todavía no agregaste el div en el HTML, no rompe nada

  const categorias = obtenerCategoriasExt();
  const presupuestos = cargarPresupuestos();
  const gastado = gastosPorCategoriaDelMesExt();

  if (categorias.length === 0) {
    cont.innerHTML = '<p class="t-text-faint text-xs">Crea categorías primero para poder asignarles un presupuesto.</p>';
    return;
  }

  cont.innerHTML = categorias.map((cat) => {
    const limite = presupuestos[cat.id] || 0;
    const usado = gastado[cat.id] || 0;
    const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
    const color = pct >= 100 ? 'var(--accent-gasto)' : (pct >= 80 ? '#F59E0B' : cat.color);

    return `
      <div class="mb-3 last:mb-0">
        <div class="flex items-center justify-between mb-1 text-sm">
          <span>${cat.icono} ${cat.nombre}</span>
          <input type="number" min="0" step="1"
            class="w-20 px-2 py-1 rounded-lg border t-input text-xs text-right presupuesto-input"
            data-cat-id="${cat.id}"
            value="${limite || ''}"
            placeholder="Sin límite" />
        </div>
        ${limite > 0 ? `
          <div class="w-full h-2 rounded-full" style="background:var(--bg-hover)">
            <div class="h-2 rounded-full" style="width:${pct}%; background:${color}"></div>
          </div>
          <p class="text-xs mt-0.5 t-text-faint">${usado.toFixed(2)} de ${limite.toFixed(2)} (${pct}%)</p>
        ` : ''}
      </div>`;
  }).join('');

  cont.querySelectorAll('.presupuesto-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const catId = e.target.dataset.catId;
      const valor = parseFloat(e.target.value) || 0;
      const presupuestos = cargarPresupuestos();
      if (valor > 0) presupuestos[catId] = valor;
      else delete presupuestos[catId];
      guardarPresupuestos(presupuestos);
      renderPresupuestos();
      revisarAlertasPresupuesto();
    });
  });
}

// -------------------------------------------------------------
// 4) NOTIFICACIONES (Web Notification API)
//    OJO: sin servidor push, esto solo avisa mientras la pestaña/app
//    está abierta. No llegan notificaciones con el celular bloqueado
//    o la app cerrada (para eso se necesitaría backend + push, que
//    ya no es 100% gratis/simple). Es una limitación real, no un bug.
// -------------------------------------------------------------
function pedirPermisoNotificaciones() {
  if (!('Notification' in window)) {
    alert('Este navegador no soporta notificaciones.');
    return;
  }
  Notification.requestPermission().then((permiso) => {
    if (permiso === 'granted') {
      mostrarToastExt('🔔 Notificaciones activadas');
    }
  });
}

function notificar(titulo, cuerpo) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(titulo, { body: cuerpo, icon: './icons/icon-192.png' });
}

function mostrarToastExt(mensaje) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = mensaje;
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');
  clearTimeout(toast._timeoutExt);
  toast._timeoutExt = setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
  }, 2500);
}

const alertasYaEnviadas = new Set(); // evita spamear la misma alerta varias veces por sesión

function revisarAlertasPresupuesto() {
  const categorias = obtenerCategoriasExt();
  const presupuestos = cargarPresupuestos();
  const gastado = gastosPorCategoriaDelMesExt();

  categorias.forEach((cat) => {
    const limite = presupuestos[cat.id];
    if (!limite) return;
    const usado = gastado[cat.id] || 0;
    const pct = (usado / limite) * 100;

    if (pct >= 100 && !alertasYaEnviadas.has(cat.id + '_100')) {
      alertasYaEnviadas.add(cat.id + '_100');
      notificar('⚠️ Presupuesto superado', `Ya pasaste el límite en ${cat.nombre} (${usado.toFixed(2)} de ${limite.toFixed(2)})`);
      mostrarToastExt(`⚠️ Superaste el presupuesto de ${cat.nombre}`);
    } else if (pct >= 80 && !alertasYaEnviadas.has(cat.id + '_80')) {
      alertasYaEnviadas.add(cat.id + '_80');
      notificar('🟡 Cerca del límite', `Ya usaste el ${Math.round(pct)}% de tu presupuesto en ${cat.nombre}`);
    }
  });
}

// -------------------------------------------------------------
// 5) EXPORTAR A CSV (además del backup JSON que ya tenés)
// -------------------------------------------------------------
function exportarCSV() {
  const raw = localStorage.getItem(STORAGE_KEY_TXN_EXT);
  const transacciones = raw ? JSON.parse(raw) : [];
  const categorias = obtenerCategoriasExt();

  if (transacciones.length === 0) {
    mostrarToastExt('No hay transacciones para exportar.');
    return;
  }

  const encabezado = ['Fecha', 'Tipo', 'Categoria', 'Monto', 'Nota'];
  const filas = transacciones
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .map((t) => {
      const cat = categorias.find((c) => c.id === t.categoriaId);
      const nombreCat = cat ? cat.nombre : 'Otros';
      const nota = (t.nota || '').replace(/"/g, '""');
      return [t.fecha, t.tipo, nombreCat, t.monto.toFixed(2), `"${nota}"`].join(',');
    });

  const csv = [encabezado.join(','), ...filas].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mis-finanzas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarToastExt('📄 CSV exportado');
}

// -------------------------------------------------------------
// INICIALIZACIÓN
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  registrarServiceWorker();
  inicializarBotonInstalar();
  renderPresupuestos();
  revisarAlertasPresupuesto();

  const btnCSV = document.getElementById('btn-exportar-csv');
  if (btnCSV) btnCSV.addEventListener('click', exportarCSV);

  const btnNotif = document.getElementById('btn-activar-notificaciones');
  if (btnNotif) btnNotif.addEventListener('click', pedirPermisoNotificaciones);

  // Vuelve a chequear presupuestos y repintarlos cada vez que cambia
  // el storage (por ejemplo al guardar una transacción nueva desde app.js)
  window.addEventListener('storage', () => {
    renderPresupuestos();
    revisarAlertasPresupuesto();
  });

  // Como 'storage' no se dispara en la misma pestaña que hizo el cambio,
  // revisamos también cada vez que la vista de categorías se muestra
  const navCategorias = document.querySelectorAll('[data-view="categorias"]');
  navCategorias.forEach((el) => {
    el.addEventListener('click', () => {
      setTimeout(() => {
        renderPresupuestos();
        revisarAlertasPresupuesto();
      }, 50);
    });
  });
});
