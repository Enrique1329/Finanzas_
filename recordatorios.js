// ===================================================================
// recordatorios.js
// Recordatorios de pagos recurrentes (Netflix, gimnasio, alquiler...).
// Módulo aditivo: no modifica app.js ni pwa-extra.js.
// Se carga después de ellos en index.html:
//   <script src="app.js"></script>
//   <script src="pwa-extra.js"></script>
//   <script src="recordatorios.js"></script>
// ===================================================================

const STORAGE_KEY_RECORDATORIOS = 'gastos_app_recordatorios';
// Cada recordatorio: { id, nombre, monto, diaDelMes, icono, ultimaVezAvisado }

function generarIdRecordatorio() {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cargarRecordatorios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDATORIOS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error leyendo recordatorios:', e);
    return [];
  }
}

function guardarRecordatorios(lista) {
  try {
    localStorage.setItem(STORAGE_KEY_RECORDATORIOS, JSON.stringify(lista));
  } catch (e) {
    console.error('Error guardando recordatorios:', e);
  }
}

function diasHastaProximoPago(diaDelMes) {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();

  let proximo = new Date(anio, mes, diaDelMes);
  if (proximo < hoy) {
    proximo = new Date(anio, mes + 1, diaDelMes);
  }
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.ceil((proximo - hoy) / msPorDia);
}

function renderRecordatorios() {
  const cont = document.getElementById('recordatorios-list');
  if (!cont) return;

  const recordatorios = cargarRecordatorios();

  if (recordatorios.length === 0) {
    cont.innerHTML = '<p class="t-text-faint text-xs">No tienes pagos recurrentes registrados todavía.</p>';
    return;
  }

  const ordenados = [...recordatorios].sort(
    (a, b) => diasHastaProximoPago(a.diaDelMes) - diasHastaProximoPago(b.diaDelMes)
  );

  cont.innerHTML = ordenados.map((r) => {
    const dias = diasHastaProximoPago(r.diaDelMes);
    let etiqueta = `en ${dias} días`;
    let colorEtiqueta = 't-text-faint';
    if (dias === 0) { etiqueta = 'hoy'; colorEtiqueta = 't-gasto font-semibold'; }
    else if (dias <= 3) { colorEtiqueta = 't-gasto'; }

    return `
      <div class="flex items-center justify-between t-card border rounded-xl px-4 py-3 mb-2">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center" style="background:var(--bg-hover)">${r.icono || '🔁'}</div>
          <div>
            <p class="font-medium text-sm">${r.nombre}</p>
            <p class="text-xs ${colorEtiqueta}">Día ${r.diaDelMes} · ${etiqueta}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-semibold text-sm">$${Number(r.monto).toFixed(2)}</span>
          <button class="btn-eliminar-recordatorio t-text-faint hover:opacity-70 text-sm" data-id="${r.id}">🗑️</button>
        </div>
      </div>`;
  }).join('');

  cont.querySelectorAll('.btn-eliminar-recordatorio').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const lista = cargarRecordatorios().filter((r) => r.id !== id);
      guardarRecordatorios(lista);
      renderRecordatorios();
    });
  });
}

function agregarRecordatorio(nombre, monto, diaDelMes, icono) {
  const lista = cargarRecordatorios();
  lista.push({
    id: generarIdRecordatorio(),
    nombre,
    monto: Number(monto),
    diaDelMes: Number(diaDelMes),
    icono: icono || '🔁',
    ultimaVezAvisado: null
  });
  guardarRecordatorios(lista);
  renderRecordatorios();
}

// Revisa si algún pago cae hoy o en los próximos 3 días y no fue avisado
// todavía en esta ejecución/mes. Usa la misma función notificar() de
// pwa-extra.js si está disponible; si no, cae a un toast simple.
function revisarRecordatorios() {
  const lista = cargarRecordatorios();
  const hoyISO = new Date().toISOString().slice(0, 10);
  let cambios = false;

  lista.forEach((r) => {
    const dias = diasHastaProximoPago(r.diaDelMes);
    const claveMes = `${new Date().getFullYear()}-${new Date().getMonth()}`;
    if (dias <= 3 && r.ultimaVezAvisado !== claveMes) {
      r.ultimaVezAvisado = claveMes;
      cambios = true;
      const mensaje = dias === 0
        ? `${r.nombre} se cobra hoy ($${Number(r.monto).toFixed(2)})`
        : `${r.nombre} se cobra en ${dias} días ($${Number(r.monto).toFixed(2)})`;

      if (typeof notificar === 'function') {
        notificar('🔁 Pago próximo', mensaje);
      }
      if (typeof mostrarToastExt === 'function') {
        mostrarToastExt(`🔁 ${mensaje}`);
      }
    }
  });

  if (cambios) guardarRecordatorios(lista);
}

// -------------------------------------------------------------
// Modal simple para agregar recordatorio (se inyecta con JS,
// no depende de que exista en el HTML)
// -------------------------------------------------------------
function abrirModalNuevoRecordatorio() {
  const nombre = prompt('Nombre del pago (ej: Netflix, Gimnasio, Alquiler):');
  if (!nombre) return;
  const monto = prompt('Monto que se cobra:');
  if (!monto || isNaN(parseFloat(monto))) return;
  const dia = prompt('¿Qué día del mes se cobra? (1-31):');
  if (!dia || isNaN(parseInt(dia)) || dia < 1 || dia > 31) return;

  agregarRecordatorio(nombre, parseFloat(monto), parseInt(dia), '🔁');
}

// -------------------------------------------------------------
// INICIALIZACIÓN
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  renderRecordatorios();
  revisarRecordatorios();

  const btnNuevo = document.getElementById('btn-nuevo-recordatorio');
  if (btnNuevo) btnNuevo.addEventListener('click', abrirModalNuevoRecordatorio);
});
