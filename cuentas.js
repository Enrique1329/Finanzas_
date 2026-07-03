// ===================================================================
// cuentas.js
// Multi-cuenta: separa tu plata en Efectivo / Banco / Tarjeta, etc.
// Usa el `state` global y las funciones de app.js directamente
// (comparten scope porque son <script> normales, no módulos).
// Cárgalo DESPUÉS de app.js:
//   <script src="app.js"></script>
//   <script src="cuentas.js"></script>
// ===================================================================

const STORAGE_KEY_CUENTAS = 'gastos_app_cuentas';
const CUENTA_DEFAULT_ID = 'cuenta_general';

const CUENTA_GENERAL = { id: CUENTA_DEFAULT_ID, nombre: 'General', icono: '💰', saldoInicial: 0, bloqueada: true };

// -------------------------------------------------------------
// PERSISTENCIA
// -------------------------------------------------------------
function cargarCuentas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUENTAS);
    let cuentas = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(cuentas) || cuentas.length === 0) cuentas = [];
    if (!cuentas.some(c => c.id === CUENTA_DEFAULT_ID)) cuentas.unshift(CUENTA_GENERAL);
    return cuentas;
  } catch (e) {
    console.error('Error leyendo cuentas:', e);
    return [CUENTA_GENERAL];
  }
}

function guardarCuentas(cuentas) {
  try {
    localStorage.setItem(STORAGE_KEY_CUENTAS, JSON.stringify(cuentas));
  } catch (e) {
    console.error('Error guardando cuentas:', e);
  }
}

let cuentasState = cargarCuentas();

// Migración: transacciones viejas sin cuentaId pasan a "General"
function migrarTransaccionesSinCuenta() {
  let huboMigracion = false;
  state.transacciones.forEach(t => {
    if (!t.cuentaId) {
      t.cuentaId = CUENTA_DEFAULT_ID;
      huboMigracion = true;
    }
  });
  if (huboMigracion) guardarTransacciones(); // función global de app.js
}

// -------------------------------------------------------------
// CÁLCULOS
// -------------------------------------------------------------
function saldoDeCuenta(cuentaId) {
  const cuenta = cuentasState.find(c => c.id === cuentaId);
  const inicial = cuenta ? (cuenta.saldoInicial || 0) : 0;
  let total = inicial;
  state.transacciones.forEach(t => {
    if ((t.cuentaId || CUENTA_DEFAULT_ID) !== cuentaId) return;
    total += t.tipo === 'ingreso' ? t.monto : -t.monto;
  });
  return Math.round(total * 100) / 100;
}

// -------------------------------------------------------------
// RENDER: lista de cuentas con su saldo
// -------------------------------------------------------------
function renderCuentas() {
  const cont = document.getElementById('cuentas-list');
  if (!cont) return;

  cont.innerHTML = cuentasState.map(c => {
    const saldo = saldoDeCuenta(c.id);
    const acciones = c.bloqueada ? '' : `
      <button class="t-text-faint hover:opacity-70 text-sm px-1 btn-editar-cuenta" data-id="${c.id}">✏️</button>
      <button class="t-text-faint hover:text-red-500 text-sm px-1 btn-eliminar-cuenta" data-id="${c.id}">🗑️</button>
    `;
    return `
      <div class="flex items-center justify-between t-card border rounded-xl px-4 py-3 mb-2">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center" style="background:var(--bg-hover)">${c.icono}</div>
          <p class="font-medium text-sm">${c.nombre}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm">$${saldo.toFixed(2)}</span>
          ${acciones}
        </div>
      </div>`;
  }).join('');

  cont.querySelectorAll('.btn-editar-cuenta').forEach(btn => {
    btn.addEventListener('click', () => abrirFormCuenta(btn.dataset.id));
  });
  cont.querySelectorAll('.btn-eliminar-cuenta').forEach(btn => {
    btn.addEventListener('click', () => eliminarCuenta(btn.dataset.id));
  });
}

function abrirFormCuenta(idEditar) {
  const cuenta = idEditar ? cuentasState.find(c => c.id === idEditar) : null;
  const nombre = prompt('Nombre de la cuenta (ej: Banco, Efectivo, Tarjeta):', cuenta ? cuenta.nombre : '');
  if (!nombre) return;
  const saldoInicialRaw = prompt('Saldo inicial (lo que ya tenías antes de usar la app):', cuenta ? cuenta.saldoInicial : '0');
  const saldoInicial = parseFloat(saldoInicialRaw);
  if (isNaN(saldoInicial)) return;

  if (cuenta) {
    cuenta.nombre = nombre;
    cuenta.saldoInicial = saldoInicial;
  } else {
    cuentasState.push({
      id: `cuenta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nombre,
      icono: '🏦',
      saldoInicial,
      bloqueada: false
    });
  }
  guardarCuentas(cuentasState);
  renderCuentas();
  renderSelectCuentas(); // refresca el select del modal de transacción por si estaba abierto
}

function eliminarCuenta(id) {
  const cuenta = cuentasState.find(c => c.id === id);
  if (!cuenta || cuenta.bloqueada) return;
  const confirmar = window.confirm(`¿Eliminar "${cuenta.nombre}"? Sus transacciones pasarán a "General".`);
  if (!confirmar) return;

  state.transacciones.forEach(t => {
    if (t.cuentaId === id) t.cuentaId = CUENTA_DEFAULT_ID;
  });
  guardarTransacciones();

  cuentasState = cuentasState.filter(c => c.id !== id);
  guardarCuentas(cuentasState);
  renderCuentas();
}

// -------------------------------------------------------------
// SELECT DE CUENTA dentro del modal de transacción
// (requiere el <select id="txn-cuenta"> agregado en el HTML)
// -------------------------------------------------------------
function renderSelectCuentas(cuentaIdSeleccionada) {
  const select = document.getElementById('txn-cuenta');
  if (!select) return;
  select.innerHTML = cuentasState.map(c => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join('');
  select.value = cuentaIdSeleccionada || CUENTA_DEFAULT_ID;
}

// -------------------------------------------------------------
// HOOKS: nos enganchamos al modal de transacción SIN tocar app.js
// -------------------------------------------------------------
function inicializarHooksCuentas() {
  // Al abrir para NUEVA transacción
  const btnFab = document.getElementById('btn-add-fab');
  if (btnFab) btnFab.addEventListener('click', () => renderSelectCuentas(CUENTA_DEFAULT_ID));

  // Al abrir para EDITAR (delegación, igual que hace app.js)
  document.addEventListener('click', (e) => {
    const btnEditarTxn = e.target.closest('.btn-editar-txn');
    if (!btnEditarTxn) return;
    const txn = state.transacciones.find(t => t.id === btnEditarTxn.dataset.id);
    renderSelectCuentas(txn ? txn.cuentaId : CUENTA_DEFAULT_ID);
  });

  // Al guardar: capturamos qué cuenta estaba seleccionada y se la
  // pegamos a la transacción recién creada/editada, después de que
  // app.js termine su propio guardado.
  const btnGuardar = document.getElementById('btn-guardar-transaccion');
  if (btnGuardar) {
    btnGuardar.addEventListener('click', () => {
      const selectCuenta = document.getElementById('txn-cuenta');
      const cuentaSeleccionada = selectCuenta ? selectCuenta.value : CUENTA_DEFAULT_ID;
      const txnIdEditado = document.getElementById('txn-id').value;
      const cantidadAntes = state.transacciones.length;

      setTimeout(() => {
        const modal = document.getElementById('modal-transaccion');
        if (modal.classList.contains('active')) return; // validación falló, no se guardó nada

        let txn = null;
        if (txnIdEditado) {
          txn = state.transacciones.find(t => t.id === txnIdEditado);
        } else if (state.transacciones.length > cantidadAntes) {
          txn = state.transacciones[state.transacciones.length - 1];
        }

        if (txn) {
          txn.cuentaId = cuentaSeleccionada;
          guardarTransacciones();
          renderCuentas();
        }
      }, 0);
    });
  }

  // Botón "+ Nueva cuenta"
  const btnNuevaCuenta = document.getElementById('btn-nueva-cuenta');
  if (btnNuevaCuenta) btnNuevaCuenta.addEventListener('click', () => abrirFormCuenta(null));
}

// -------------------------------------------------------------
// INICIALIZACIÓN
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Esperamos un tick para asegurarnos de que app.js ya corrió su propio
  // init() (cargarDatos) antes de leer/migrar state.transacciones.
  setTimeout(() => {
    migrarTransaccionesSinCuenta();
    renderCuentas();
    renderSelectCuentas();
    inicializarHooksCuentas();
  }, 0);
});
