// ===================================================================
// CONSTANTES Y ESTADO
// ===================================================================
const STORAGE_KEY_TXN = 'gastos_app_transacciones';
const STORAGE_KEY_CAT = 'gastos_app_categorias';
const STORAGE_KEY_TEMA = 'gastos_app_tema';
const STORAGE_KEY_META = 'gastos_app_meta';
const STORAGE_KEY_CONFIG = 'gastos_app_config';

const TEMAS = [
  { id: 'claro', nombre: 'Claro', swatch: '#FAFAF8' },
  { id: 'oscuro', nombre: 'Oscuro', swatch: '#1E1E20' },
  { id: 'medianoche', nombre: 'Medianoche', swatch: '#0B0F1A' },
  { id: 'bosque', nombre: 'Bosque', swatch: '#2F5D3A' },
  { id: 'arena', nombre: 'Arena', swatch: '#FAF6EF' }
];

// Grupos de la regla 50/30/20
const GRUPOS_50_30_20 = [
  { id: 'necesidad', nombre: 'Necesidad', porcentajeIdeal: 50, color: '#3B82F6', icono: '🏠' },
  { id: 'estilo_vida', nombre: 'Estilo de vida', porcentajeIdeal: 30, color: '#8B5CF6', icono: '🎉' },
  { id: 'ahorro', nombre: 'Ahorro', porcentajeIdeal: 20, color: '#10A37F', icono: '🐷' }
];

const CATEGORIAS_DEFAULT = [
  { id: 'cat_comida', nombre: 'Comida', color: '#F59E0B', icono: '🍔', bloqueada: false, grupo: 'necesidad' },
  { id: 'cat_transporte', nombre: 'Transporte', color: '#3B82F6', icono: '🚗', bloqueada: false, grupo: 'necesidad' },
  { id: 'cat_salario', nombre: 'Salario', color: '#10A37F', icono: '💼', bloqueada: false, grupo: 'estilo_vida' },
  { id: 'cat_entretenimiento', nombre: 'Entretenimiento', color: '#8B5CF6', icono: '🎮', bloqueada: false, grupo: 'estilo_vida' },
  { id: 'cat_otros', nombre: 'Otros', color: '#6B7280', icono: '📦', bloqueada: true, grupo: 'estilo_vida' }
];

const COLORES_DISPONIBLES = ['#F59E0B', '#3B82F6', '#10A37F', '#8B5CF6', '#EF4444', '#6B7280', '#EC4899', '#14B8A6'];
const ICONOS_DISPONIBLES = ['🍔', '🚗', '💼', '🎮', '📦', '🏠', '💊', '✈️', '📚', '🎁', '☕', '👕'];

let state = {
  transacciones: [],
  categorias: [],
  meta: null, // { nombre, montoObjetivo, fechaLimite, montoActual }
  config: { porcentajeAhorro: null }, // null = no configurado todavía
  vistaActual: 'dashboard',
  tipoSeleccionado: 'gasto',
  colorSeleccionado: COLORES_DISPONIBLES[0],
  iconoSeleccionado: ICONOS_DISPONIBLES[0],
  grupoSeleccionado: 'necesidad',
  pendienteEliminar: null, // { tipo: 'transaccion'|'categoria', id: string }
  ingresoPendienteAhorro: null // { monto, categoriaId, fecha, nota } a la espera de confirmar el modal de ahorro
};

// ===================================================================
// PERSISTENCIA (LocalStorage)
// ===================================================================
function cargarDatos() {
  try {
    const txnRaw = localStorage.getItem(STORAGE_KEY_TXN);
    const catRaw = localStorage.getItem(STORAGE_KEY_CAT);
    const metaRaw = localStorage.getItem(STORAGE_KEY_META);
    const configRaw = localStorage.getItem(STORAGE_KEY_CONFIG);

    state.transacciones = txnRaw ? JSON.parse(txnRaw) : [];
    state.categorias = catRaw ? JSON.parse(catRaw) : [...CATEGORIAS_DEFAULT];

    // Si por alguna razón categorias quedó vacío, restauramos defaults
    if (!Array.isArray(state.categorias) || state.categorias.length === 0) {
      state.categorias = [...CATEGORIAS_DEFAULT];
    }

    // Migración: categorías guardadas antes de la regla 50/30/20 no tienen "grupo"
    state.categorias.forEach(c => {
      if (!c.grupo || !GRUPOS_50_30_20.some(g => g.id === c.grupo)) {
        c.grupo = 'estilo_vida';
      }
    });

    state.meta = metaRaw ? JSON.parse(metaRaw) : null;
    state.config = configRaw ? JSON.parse(configRaw) : { porcentajeAhorro: null };
    if (!state.config || typeof state.config.porcentajeAhorro === 'undefined') {
      state.config = { porcentajeAhorro: null };
    }
  } catch (e) {
    console.error('Error leyendo LocalStorage, restaurando valores por defecto.', e);
    state.transacciones = [];
    state.categorias = [...CATEGORIAS_DEFAULT];
    state.meta = null;
    state.config = { porcentajeAhorro: null };
  }
  guardarCategorias();
  guardarTransacciones();
  guardarMeta();
  guardarConfig();
}

function guardarTransacciones() {
  try {
    localStorage.setItem(STORAGE_KEY_TXN, JSON.stringify(state.transacciones));
  } catch (e) {
    console.error('No se pudo guardar en LocalStorage (transacciones).', e);
    mostrarToast('⚠️ No se pudo guardar. ¿LocalStorage lleno o bloqueado?');
  }
}

function guardarCategorias() {
  try {
    localStorage.setItem(STORAGE_KEY_CAT, JSON.stringify(state.categorias));
  } catch (e) {
    console.error('No se pudo guardar en LocalStorage (categorías).', e);
    mostrarToast('⚠️ No se pudo guardar. ¿LocalStorage lleno o bloqueado?');
  }
}

function guardarMeta() {
  try {
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(state.meta));
  } catch (e) {
    console.error('No se pudo guardar la meta en LocalStorage.', e);
    mostrarToast('⚠️ No se pudo guardar la meta.');
  }
}

function guardarConfig() {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(state.config));
  } catch (e) {
    console.error('No se pudo guardar la configuración en LocalStorage.', e);
  }
}

// ===================================================================
// TEMA: aplicar, persistir y construir el selector
// ===================================================================
function obtenerColorCSS(variable) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

function colorIngreso() { return obtenerColorCSS('--accent-ingreso') || '#10A37F'; }
function colorGasto() { return obtenerColorCSS('--accent-gasto') || '#EF4444'; }
function colorBorde() { return obtenerColorCSS('--border') || '#E5E7EB'; }

function aplicarTema(temaId) {
  document.documentElement.setAttribute('data-theme', temaId);
  try {
    localStorage.setItem(STORAGE_KEY_TEMA, temaId);
  } catch (e) {
    console.error('No se pudo guardar el tema en LocalStorage.', e);
  }
  renderThemeSwitcher(temaId);
  // Si el dashboard está visible, repintamos donut y gráfico con los nuevos colores
  if (state.vistaActual === 'dashboard') renderDashboard();
}

function renderThemeSwitcher(temaActivo) {
  const html = TEMAS.map(t => `
    <button type="button"
      class="theme-swatch ${t.id === temaActivo ? 'active' : ''}"
      style="background:${t.swatch}"
      data-tema="${t.id}"
      title="${t.nombre}"
      aria-label="Tema ${t.nombre}"></button>
  `).join('');

  ['theme-switcher', 'theme-switcher-mobile'].forEach(contId => {
    const cont = document.getElementById(contId);
    if (!cont) return;
    cont.innerHTML = html;
    cont.querySelectorAll('.theme-swatch').forEach(btn => {
      btn.addEventListener('click', () => aplicarTema(btn.dataset.tema));
    });
  });
}

function cargarTemaInicial() {
  let tema = 'claro';
  try {
    const guardado = localStorage.getItem(STORAGE_KEY_TEMA);
    if (guardado && TEMAS.some(t => t.id === guardado)) tema = guardado;
  } catch (e) {
    console.error('No se pudo leer el tema de LocalStorage.', e);
  }
  document.documentElement.setAttribute('data-theme', tema);
  renderThemeSwitcher(tema);
}

// ===================================================================
// UTILIDADES
// ===================================================================
function generarId(prefijo) {
  return `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatoMoneda(valor) {
  const num = Number(valor) || 0;
  return `$${num.toFixed(2)}`;
}

function obtenerCategoria(id) {
  return state.categorias.find(c => c.id === id) || CATEGORIAS_DEFAULT[4];
}

function formatoFechaRelativa(fechaISO) {
  const hoy = new Date();
  const fecha = new Date(fechaISO + 'T00:00:00');
  const hoyStr = hoy.toISOString().slice(0, 10);
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = ayer.toISOString().slice(0, 10);

  if (fechaISO === hoyStr) return 'Hoy';
  if (fechaISO === ayerStr) return 'Ayer';

  const opciones = { day: 'numeric', month: 'short' };
  return fecha.toLocaleDateString('es-EC', opciones).replace('.', '');
}

function mostrarToast(mensaje) {
  const toast = document.getElementById('toast');
  toast.textContent = mensaje;
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
  }, 2200);
}

// ===================================================================
// CÁLCULOS FINANCIEROS
// ===================================================================
function calcularTotales(transacciones) {
  let ingresos = 0, gastos = 0;
  transacciones.forEach(t => {
    if (t.tipo === 'ingreso') ingresos += t.monto;
    else gastos += t.monto;
  });
  return { ingresos, gastos, saldo: ingresos - gastos };
}

function transaccionesDelMesActual() {
  const ahora = new Date();
  const mesActual = ahora.getMonth();
  const anioActual = ahora.getFullYear();
  return state.transacciones.filter(t => {
    const f = new Date(t.fecha + 'T00:00:00');
    return f.getMonth() === mesActual && f.getFullYear() === anioActual;
  });
}

function gastosPorCategoriaDelMes() {
  const delMes = transaccionesDelMesActual().filter(t => t.tipo === 'gasto');
  const totales = {};
  delMes.forEach(t => {
    totales[t.categoriaId] = (totales[t.categoriaId] || 0) + t.monto;
  });
  return totales; // { categoriaId: montoTotal }
}

function obtenerUltimosMeses(cantidad) {
  const ahora = new Date();
  const meses = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    meses.push({ anio: d.getFullYear(), mes: d.getMonth() });
  }
  return meses;
}

function calcularTendenciaMensual(cantidadMeses) {
  const meses = obtenerUltimosMeses(cantidadMeses);
  const etiquetas = meses.map(({ anio, mes }) => {
    const d = new Date(anio, mes, 1);
    return d.toLocaleDateString('es-EC', { month: 'short' }).replace('.', '');
  });

  const ingresosPorMes = meses.map(({ anio, mes }) =>
    state.transacciones
      .filter(t => t.tipo === 'ingreso')
      .filter(t => {
        const f = new Date(t.fecha + 'T00:00:00');
        return f.getFullYear() === anio && f.getMonth() === mes;
      })
      .reduce((acc, t) => acc + t.monto, 0)
  );

  const gastosPorMes = meses.map(({ anio, mes }) =>
    state.transacciones
      .filter(t => t.tipo === 'gasto')
      .filter(t => {
        const f = new Date(t.fecha + 'T00:00:00');
        return f.getFullYear() === anio && f.getMonth() === mes;
      })
      .reduce((acc, t) => acc + t.monto, 0)
  );

  return { etiquetas, ingresosPorMes, gastosPorMes };
}

// ===================================================================
// REGLA 50/30/20
// ===================================================================
function calcularDistribucion50_30_20() {
  const delMes = transaccionesDelMesActual();
  const ingresosDelMes = delMes.filter(t => t.tipo === 'ingreso').reduce((acc, t) => acc + t.monto, 0);
  const gastosDelMes = delMes.filter(t => t.tipo === 'gasto');

  // El monto ya separado a la meta de ahorro este mes también cuenta como "ahorro" real
  const ahorradoEsteMes = (state.meta && Array.isArray(state.meta.historial))
    ? state.meta.historial
        .filter(h => {
          const f = new Date(h.fecha + 'T00:00:00');
          const ahora = new Date();
          return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
        })
        .reduce((acc, h) => acc + h.monto, 0)
    : 0;

  const totales = { necesidad: 0, estilo_vida: 0, ahorro: ahorradoEsteMes };

  gastosDelMes.forEach(t => {
    const cat = obtenerCategoria(t.categoriaId);
    const grupo = cat.grupo || 'estilo_vida';
    totales[grupo] = (totales[grupo] || 0) + t.monto;
  });

  const base = ingresosDelMes > 0 ? ingresosDelMes : null;

  const resultado = GRUPOS_50_30_20.map(g => {
    const monto = totales[g.id] || 0;
    const porcentajeReal = base ? Math.round((monto / base) * 100) : null;
    return { ...g, monto, porcentajeReal };
  });

  return { resultado, base, ingresosDelMes };
}

// ===================================================================
// GASTOS HORMIGA (categorías con muchas transacciones pequeñas)
// ===================================================================
function detectarGastosHormiga() {
  const delMes = transaccionesDelMesActual().filter(t => t.tipo === 'gasto');
  const porCategoria = {};

  delMes.forEach(t => {
    if (!porCategoria[t.categoriaId]) porCategoria[t.categoriaId] = { total: 0, cantidad: 0 };
    porCategoria[t.categoriaId].total += t.monto;
    porCategoria[t.categoriaId].cantidad += 1;
  });

  const UMBRAL_CANTIDAD = 5; // mínimo de transacciones en el mes para considerarlo "hormiga"
  const UMBRAL_MONTO_PROMEDIO = 15; // monto promedio por transacción debe ser bajo

  const alertas = [];
  Object.entries(porCategoria).forEach(([catId, datos]) => {
    const promedio = datos.total / datos.cantidad;
    if (datos.cantidad >= UMBRAL_CANTIDAD && promedio <= UMBRAL_MONTO_PROMEDIO) {
      const cat = obtenerCategoria(catId);
      alertas.push({
        categoria: cat,
        total: datos.total,
        cantidad: datos.cantidad,
        proyeccionAnual: datos.total * 12
      });
    }
  });

  return alertas.sort((a, b) => b.total - a.total);
}

// ===================================================================
// META DE AHORRO
// ===================================================================
function progresoMeta() {
  if (!state.meta) return null;
  const objetivo = state.meta.montoObjetivo || 0;
  const actual = state.meta.montoActual || 0;
  const porcentaje = objetivo > 0 ? Math.min(100, Math.round((actual / objetivo) * 100)) : 0;
  return { ...state.meta, porcentaje };
}


// ===================================================================
// RENDER: DASHBOARD
// ===================================================================
function renderDashboard() {
  const todas = state.transacciones;
  const { ingresos, gastos, saldo } = calcularTotales(todas);

  document.getElementById('saldo-total').textContent = formatoMoneda(saldo);
  document.getElementById('total-ingresos').textContent = formatoMoneda(ingresos);
  document.getElementById('total-gastos').textContent = formatoMoneda(gastos);

  // Donut chart por categoría (solo gastos del mes actual)
  const porCategoria = gastosPorCategoriaDelMes();
  const entradas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  const totalMes = entradas.reduce((acc, [, monto]) => acc + monto, 0);

  const donut = document.getElementById('donut-chart');
  const legend = document.getElementById('donut-legend');
  document.getElementById('donut-total').textContent = formatoMoneda(totalMes);

  if (entradas.length === 0 || totalMes === 0) {
    donut.style.background = colorBorde();
    legend.innerHTML = '<p class="t-text-faint text-xs">Sin gastos este mes todavía.</p>';
  } else {
    let acumulado = 0;
    const segmentos = entradas.map(([catId, monto]) => {
      const cat = obtenerCategoria(catId);
      const inicio = (acumulado / totalMes) * 360;
      acumulado += monto;
      const fin = (acumulado / totalMes) * 360;
      return `${cat.color} ${inicio}deg ${fin}deg`;
    });
    donut.style.background = `conic-gradient(${segmentos.join(', ')})`;

    legend.innerHTML = entradas.map(([catId, monto]) => {
      const cat = obtenerCategoria(catId);
      return `
        <div class="flex justify-between">
          <span><span class="inline-block w-2 h-2 rounded-full mr-2" style="background:${cat.color}"></span>${cat.icono} ${cat.nombre}</span>
          <span class="font-medium">${formatoMoneda(monto)}</span>
        </div>`;
    }).join('');
  }

  // Transacciones recientes (últimas 5)
  const recientes = [...todas]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || b.creadoEn.localeCompare(a.creadoEn))
    .slice(0, 5);

  const recientesList = document.getElementById('recientes-list');
  if (recientes.length === 0) {
    recientesList.innerHTML = `
      <div class="text-center py-10">
        <p class="text-3xl mb-2">📭</p>
        <p class="text-sm t-text-faint">Aún no tienes transacciones. Toca "+" para agregar la primera.</p>
      </div>`;
  } else {
    recientesList.innerHTML = recientes.map(t => renderItemTransaccion(t, false)).join('');
  }

  try { renderMeta(); } catch (e) { console.error('Error pintando la meta de ahorro:', e); }
  try { renderDistribucion50_30_20(); } catch (e) { console.error('Error pintando la distribución 50/30/20:', e); }
  try { renderAlertasHormiga(); } catch (e) { console.error('Error pintando alertas de gastos hormiga:', e); }
  try { renderTendencia(); } catch (e) { console.error('Error pintando el gráfico de tendencia:', e); }
}

// ===================================================================
// RENDER: META DE AHORRO
// ===================================================================
function renderMeta() {
  const meta = progresoMeta();
  const vacia = document.getElementById('meta-vacia');
  const activa = document.getElementById('meta-activa');

  if (!meta) {
    vacia.classList.remove('hidden');
    activa.classList.add('hidden');
    return;
  }

  vacia.classList.add('hidden');
  activa.classList.remove('hidden');

  document.getElementById('meta-nombre').textContent = meta.nombre;
  document.getElementById('meta-actual').textContent = formatoMoneda(meta.montoActual || 0);
  document.getElementById('meta-objetivo').textContent = `de ${formatoMoneda(meta.montoObjetivo || 0)}`;
  document.getElementById('meta-barra').style.width = `${meta.porcentaje}%`;
  document.getElementById('meta-porcentaje').textContent = `${meta.porcentaje}%`;
  document.getElementById('meta-fecha').textContent = meta.fechaLimite
    ? `Meta: ${new Date(meta.fechaLimite + 'T00:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  // Si ya se alcanzó el 100%, celebramos con el color de ingreso en la barra (ya es el default) y un pequeño check
  const barra = document.getElementById('meta-barra');
  barra.style.background = meta.porcentaje >= 100 ? colorIngreso() : colorIngreso();
}

// ===================================================================
// RENDER: DISTRIBUCIÓN 50/30/20
// ===================================================================
function renderDistribucion50_30_20() {
  const cont = document.getElementById('distribucion-50-30-20');
  if (!cont) return;

  const { resultado, base } = calcularDistribucion50_30_20();

  if (!base) {
    cont.innerHTML = `<p class="t-text-faint text-xs text-center py-6">Registra un ingreso este mes para ver tu distribución 50/30/20.</p>`;
    return;
  }

  cont.innerHTML = resultado.map(g => {
    const realPct = g.porcentajeReal ?? 0;
    const diferencia = realPct - g.porcentajeIdeal;
    const signo = diferencia > 0 ? '+' : '';
    const colorDif = g.id === 'ahorro'
      ? (diferencia >= 0 ? colorIngreso() : colorGasto())
      : (diferencia <= 0 ? colorIngreso() : colorGasto());

    return `
      <div class="mb-3 last:mb-0">
        <div class="flex items-center justify-between mb-1 text-sm">
          <span>${g.icono} ${g.nombre} <span class="t-text-faint text-xs">(ideal ${g.porcentajeIdeal}%)</span></span>
          <span class="font-semibold">${formatoMoneda(g.monto)} · ${realPct}%</span>
        </div>
        <div class="w-full h-2 rounded-full" style="background:var(--bg-hover)">
          <div class="h-2 rounded-full" style="width:${Math.min(100, realPct)}%; background:${g.color}"></div>
        </div>
        <p class="text-xs mt-0.5" style="color:${colorDif}">${signo}${diferencia}% vs. lo ideal</p>
      </div>`;
  }).join('');
}

// ===================================================================
// RENDER: ALERTAS DE GASTOS HORMIGA
// ===================================================================
function renderAlertasHormiga() {
  const cont = document.getElementById('alertas-hormiga');
  if (!cont) return;

  const alertas = detectarGastosHormiga();

  if (alertas.length === 0) {
    cont.innerHTML = '';
    return;
  }

  cont.innerHTML = alertas.slice(0, 2).map(a => `
    <div class="border rounded-xl px-4 py-3 flex items-start gap-3" style="background:${a.categoria.color}15; border-color:${a.categoria.color}40">
      <span class="text-xl">🐜</span>
      <div class="flex-1 text-sm">
        <p class="font-medium">Gasto hormiga en ${a.categoria.icono} ${a.categoria.nombre}</p>
        <p class="t-text-soft text-xs mt-0.5">
          ${formatoMoneda(a.total)} en ${a.cantidad} compras este mes — a ese ritmo, son ${formatoMoneda(a.proyeccionAnual)} al año.
        </p>
      </div>
    </div>
  `).join('');
}

// ===================================================================
// RENDER: GRÁFICO DE TENDENCIA (Chart.js)
// ===================================================================
function renderTendencia() {
  const svg = document.getElementById('tendencia-chart');
  const vacio = document.getElementById('tendencia-empty');

  if (state.transacciones.length === 0) {
    svg.classList.add('hidden');
    vacio.classList.remove('hidden');
    vacio.textContent = 'Aún no hay suficientes datos para mostrar una tendencia.';
    svg.innerHTML = '';
    return;
  }
  svg.classList.remove('hidden');
  vacio.classList.add('hidden');

  const { etiquetas, ingresosPorMes, gastosPorMes } = calcularTendenciaMensual(6);
  const cIngreso = colorIngreso();
  const cGasto = colorGasto();
  const cBorde = colorBorde();

  // Lienzo SVG fijo (viewBox), con padding interno para los textos del eje
  const W = 600, H = 192;
  const padL = 38, padR = 8, padT = 10, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxValor = Math.max(1, ...ingresosPorMes, ...gastosPorMes);
  // Redondeamos el techo del eje Y a un número "limpio" para que los ticks se vean bien
  const techo = Math.ceil(maxValor / 5) * 5 || 5;

  const n = etiquetas.length;
  const xPara = (i) => padL + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const yPara = (valor) => padT + innerH - (innerH * valor) / techo;

  function construirPath(valores) {
    return valores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPara(i).toFixed(1)} ${yPara(v).toFixed(1)}`).join(' ');
  }

  function construirAreaPath(valores) {
    const linea = valores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPara(i).toFixed(1)} ${yPara(v).toFixed(1)}`).join(' ');
    const base = `L ${xPara(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xPara(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
    return linea + ' ' + base;
  }

  // Líneas de grilla horizontal (4 divisiones) + etiquetas del eje Y
  let gridSvg = '';
  const pasos = 4;
  for (let i = 0; i <= pasos; i++) {
    const valor = (techo / pasos) * i;
    const y = yPara(valor);
    gridSvg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${cBorde}" stroke-width="1" />`;
    gridSvg += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="${cBorde}" font-family="Inter, sans-serif">$${Math.round(valor)}</text>`;
  }

  // Etiquetas del eje X (un mes sí y otro según el espacio, para que no se amontonen en pantallas chicas)
  let etiquetasXSvg = '';
  etiquetas.forEach((etq, i) => {
    etiquetasXSvg += `<text x="${xPara(i).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="${cBorde}" font-family="Inter, sans-serif">${etq}</text>`;
  });

  const puntosIngresoSvg = ingresosPorMes.map((v, i) =>
    `<circle cx="${xPara(i).toFixed(1)}" cy="${yPara(v).toFixed(1)}" r="3" fill="${cIngreso}">
       <title>Ingresos ${etiquetas[i]}: ${formatoMoneda(v)}</title>
     </circle>`
  ).join('');

  const puntosGastoSvg = gastosPorMes.map((v, i) =>
    `<circle cx="${xPara(i).toFixed(1)}" cy="${yPara(v).toFixed(1)}" r="3" fill="${cGasto}">
       <title>Gastos ${etiquetas[i]}: ${formatoMoneda(v)}</title>
     </circle>`
  ).join('');

  svg.innerHTML = `
    ${gridSvg}
    ${etiquetasXSvg}
    <path d="${construirAreaPath(ingresosPorMes)}" fill="${cIngreso}22" stroke="none" />
    <path d="${construirAreaPath(gastosPorMes)}" fill="${cGasto}22" stroke="none" />
    <path d="${construirPath(ingresosPorMes)}" fill="none" stroke="${cIngreso}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    <path d="${construirPath(gastosPorMes)}" fill="none" stroke="${cGasto}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    ${puntosIngresoSvg}
    ${puntosGastoSvg}
  `;
}

// ===================================================================
// RENDER: ITEM DE TRANSACCIÓN (reusado en Dashboard e Historial)
// ===================================================================
function renderItemTransaccion(t, conAcciones) {
  const cat = obtenerCategoria(t.categoriaId);
  const signo = t.tipo === 'ingreso' ? '+' : '-';
  const colorMonto = t.tipo === 'ingreso' ? colorIngreso() : colorGasto();
  const acciones = conAcciones ? `
    <div class="flex gap-1">
      <button class="t-text-faint hover:opacity-70 text-sm px-1 btn-editar-txn" data-id="${t.id}">✏️</button>
      <button class="t-text-faint hover:text-red-500 text-sm px-1 btn-eliminar-txn" data-id="${t.id}">🗑️</button>
    </div>` : '';

  return `
    <div class="group flex items-center justify-between t-card border rounded-xl px-4 py-3 transition">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style="background:${cat.color}22">${cat.icono}</div>
        <div class="min-w-0">
          <p class="font-medium text-sm truncate">${t.nota ? escapeHtml(t.nota) : cat.nombre}</p>
          <p class="text-xs t-text-faint">${cat.nombre} · ${formatoFechaRelativa(t.fecha)}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <span class="font-semibold text-sm" style="color:${colorMonto}">${signo}${formatoMoneda(t.monto).slice(1)}</span>
        ${acciones}
      </div>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===================================================================
// RENDER: HISTORIAL
// ===================================================================
function obtenerTransaccionesFiltradas() {
  const texto = document.getElementById('buscador').value.trim().toLowerCase();
  const tipo = document.getElementById('filtro-tipo').value;
  const catId = document.getElementById('filtro-categoria').value;
  const mes = document.getElementById('filtro-mes').value;
  const rangoDesde = document.getElementById('rango-desde').value;
  const rangoHasta = document.getElementById('rango-hasta').value;

  const ahora = new Date();
  let mesObjetivo = ahora.getMonth();
  let anioObjetivo = ahora.getFullYear();
  if (mes === 'anterior') {
    mesObjetivo = mesObjetivo - 1;
    if (mesObjetivo < 0) { mesObjetivo = 11; anioObjetivo -= 1; }
  }

  return state.transacciones.filter(t => {
    if (tipo !== 'todos' && t.tipo !== tipo) return false;
    if (catId !== 'todas' && t.categoriaId !== catId) return false;

    if (mes === 'personalizado') {
      if (rangoDesde && t.fecha < rangoDesde) return false;
      if (rangoHasta && t.fecha > rangoHasta) return false;
    } else if (mes !== 'todos') {
      const f = new Date(t.fecha + 'T00:00:00');
      if (f.getMonth() !== mesObjetivo || f.getFullYear() !== anioObjetivo) return false;
    }

    if (texto) {
      const cat = obtenerCategoria(t.categoriaId);
      const enNota = (t.nota || '').toLowerCase().includes(texto);
      const enCategoria = cat.nombre.toLowerCase().includes(texto);
      if (!enNota && !enCategoria) return false;
    }

    return true;
  });
}

function renderHistorial() {
  // Poblar select de categorías si está vacío
  const filtroCategoria = document.getElementById('filtro-categoria');
  const valorActual = filtroCategoria.value || 'todas';
  filtroCategoria.innerHTML = '<option value="todas">Todas las categorías</option>' +
    state.categorias.map(c => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join('');
  filtroCategoria.value = valorActual;

  const filtradas = obtenerTransaccionesFiltradas();
  document.getElementById('historial-count').textContent = state.transacciones.length;

  const { saldo } = calcularTotales(filtradas);
  document.getElementById('filtro-total').textContent = formatoMoneda(saldo);

  const lista = document.getElementById('historial-list');
  const vacio = document.getElementById('historial-empty');

  if (filtradas.length === 0) {
    lista.innerHTML = '';
    vacio.classList.remove('hidden');
    return;
  }
  vacio.classList.add('hidden');

  // Agrupar por fecha
  const ordenadas = [...filtradas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || b.creadoEn.localeCompare(a.creadoEn));
  const grupos = {};
  ordenadas.forEach(t => {
    if (!grupos[t.fecha]) grupos[t.fecha] = [];
    grupos[t.fecha].push(t);
  });

  lista.innerHTML = Object.keys(grupos).sort((a, b) => new Date(b) - new Date(a)).map(fecha => {
    const etiqueta = formatoFechaRelativa(fecha);
    const items = grupos[fecha].map(t => renderItemTransaccion(t, true)).join('');
    return `
      <div>
        <p class="text-xs font-semibold t-text-faint uppercase tracking-wide mb-2">${etiqueta}</p>
        <div class="space-y-2">${items}</div>
      </div>`;
  }).join('');
}

// ===================================================================
// RENDER: CATEGORÍAS
// ===================================================================
function contarTransaccionesPorCategoria(catId) {
  return state.transacciones.filter(t => t.categoriaId === catId).length;
}

function renderCategorias() {
  document.getElementById('categorias-count').textContent = state.categorias.length;

  const lista = document.getElementById('categorias-list');
  lista.innerHTML = state.categorias.map(c => {
    const count = contarTransaccionesPorCategoria(c.id);
    const grupo = GRUPOS_50_30_20.find(g => g.id === c.grupo) || GRUPOS_50_30_20[1];
    const acciones = c.bloqueada ? `
      <span class="text-xs t-text-faint px-1" title="Categoría por defecto, no se puede eliminar">🔒</span>
    ` : `
      <button class="t-text-faint hover:opacity-70 text-sm px-1 btn-editar-cat" data-id="${c.id}">✏️</button>
      <button class="t-text-faint hover:text-red-500 text-sm px-1 btn-eliminar-cat" data-id="${c.id}">🗑️</button>
    `;
    return `
      <div class="group flex items-center justify-between t-card border rounded-xl px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center" style="background:${c.color}22">${c.icono}</div>
          <div>
            <p class="font-medium text-sm">${escapeHtml(c.nombre)}</p>
            <p class="text-xs t-text-faint">${count} transacci${count === 1 ? 'ón' : 'ones'} · <span style="color:${grupo.color}">${grupo.nombre}</span></p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" style="background:${c.color}"></span>
          ${acciones}
        </div>
      </div>`;
  }).join('');
}

// ===================================================================
// NAVEGACIÓN ENTRE VISTAS
// ===================================================================
function cambiarVista(vista) {
  state.vistaActual = vista;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${vista}`).classList.add('active');

  document.querySelectorAll('.nav-link').forEach(link => {
    const activo = link.dataset.view === vista;
    link.classList.toggle('t-active', activo);
    link.classList.toggle('t-text-soft', !activo);
    link.classList.toggle('t-hover', !activo);
  });

  document.querySelectorAll('.nav-link-mobile').forEach(link => {
    const activo = link.dataset.view === vista;
    link.classList.toggle('t-text', activo);
    link.classList.toggle('font-medium', activo);
    link.classList.toggle('t-text-faint', !activo);
  });

  document.getElementById('btn-add-fab').classList.toggle('hidden', vista === 'categorias');

  renderVistaActual();
}

function renderVistaActual() {
  if (state.vistaActual === 'dashboard') renderDashboard();
  else if (state.vistaActual === 'historial') renderHistorial();
  else if (state.vistaActual === 'categorias') renderCategorias();
}

function renderTodo() {
  renderDashboard();
  renderCategorias();
  if (state.vistaActual === 'historial') renderHistorial();
}

// ===================================================================
// MODAL: TRANSACCIÓN
// ===================================================================
function abrirModalTransaccion(idEditar) {
  const modal = document.getElementById('modal-transaccion');
  const esEdicion = Boolean(idEditar);

  document.getElementById('modal-transaccion-titulo').textContent = esEdicion ? 'Editar transacción' : 'Nueva transacción';
  document.getElementById('txn-id').value = idEditar || '';
  limpiarErroresTransaccion();

  // Poblar categorías del select
  const select = document.getElementById('txn-categoria');
  select.innerHTML = '<option value="">Selecciona una categoría</option>' +
    state.categorias.map(c => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join('');

  if (esEdicion) {
    const t = state.transacciones.find(x => x.id === idEditar);
    if (!t) return;
    seleccionarTipo(t.tipo);
    document.getElementById('txn-monto').value = t.monto;
    select.value = t.categoriaId;
    document.getElementById('txn-fecha').value = t.fecha;
    document.getElementById('txn-nota').value = t.nota || '';
  } else {
    seleccionarTipo('gasto');
    document.getElementById('txn-monto').value = '';
    select.value = '';
    document.getElementById('txn-fecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('txn-nota').value = '';
  }

  modal.classList.add('active');
}

function cerrarModalTransaccion() {
  document.getElementById('modal-transaccion').classList.remove('active');
}

function seleccionarTipo(tipo) {
  state.tipoSeleccionado = tipo;
  const btnGasto = document.getElementById('btn-tipo-gasto');
  const btnIngreso = document.getElementById('btn-tipo-ingreso');

  if (tipo === 'gasto') {
    btnGasto.className = 'flex-1 py-2 rounded-lg shadow-sm text-sm font-semibold transition t-card';
    btnGasto.style.color = colorGasto();
    btnIngreso.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition t-text-soft';
    btnIngreso.style.color = '';
  } else {
    btnIngreso.className = 'flex-1 py-2 rounded-lg shadow-sm text-sm font-semibold transition t-card';
    btnIngreso.style.color = colorIngreso();
    btnGasto.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition t-text-soft';
    btnGasto.style.color = '';
  }
}

function limpiarErroresTransaccion() {
  ['error-monto', 'error-categoria', 'error-fecha'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  ['txn-monto', 'txn-categoria', 'txn-fecha'].forEach(id => {
    document.getElementById(id).classList.remove('border-red-400', 'ring-2', 'ring-red-400');
  });
}

function marcarError(inputId, errorId) {
  document.getElementById(inputId).classList.add('border-red-400');
  document.getElementById(errorId).classList.remove('hidden');
}

function validarYGuardarTransaccion() {
  limpiarErroresTransaccion();

  const montoRaw = document.getElementById('txn-monto').value;
  const monto = parseFloat(montoRaw);
  const categoriaId = document.getElementById('txn-categoria').value;
  const fecha = document.getElementById('txn-fecha').value;
  const nota = document.getElementById('txn-nota').value.trim().slice(0, 100);
  const id = document.getElementById('txn-id').value;

  let valido = true;

  if (montoRaw === '' || isNaN(monto) || monto <= 0) {
    marcarError('txn-monto', 'error-monto');
    valido = false;
  }
  if (!categoriaId) {
    marcarError('txn-categoria', 'error-categoria');
    valido = false;
  }
  if (!fecha) {
    marcarError('txn-fecha', 'error-fecha');
    valido = false;
  }

  if (!valido) return;

  let esIngresoNuevo = false;

  if (id) {
    // Edición
    const idx = state.transacciones.findIndex(t => t.id === id);
    if (idx !== -1) {
      state.transacciones[idx] = {
        ...state.transacciones[idx],
        tipo: state.tipoSeleccionado,
        monto: Math.round(monto * 100) / 100,
        categoriaId,
        fecha,
        nota
      };
    }
    mostrarToast('✅ Transacción actualizada');
  } else {
    // Nueva
    state.transacciones.push({
      id: generarId('txn'),
      tipo: state.tipoSeleccionado,
      monto: Math.round(monto * 100) / 100,
      categoriaId,
      fecha,
      nota,
      creadoEn: new Date().toISOString()
    });
    mostrarToast('✅ Transacción agregada');
    esIngresoNuevo = state.tipoSeleccionado === 'ingreso';
  }

  guardarTransacciones();
  cerrarModalTransaccion();

  try {
    renderTodo();
  } catch (e) {
    console.error('Hubo un problema pintando el Dashboard, pero tu transacción sí se guardó:', e);
  }

  // Si fue un ingreso nuevo, evaluamos si corresponde ofrecer ahorro automático
  // (esto se ejecuta SIEMPRE, incluso si el paso de arriba falló)
  if (esIngresoNuevo) {
    evaluarAhorroAutomatico(Math.round(monto * 100) / 100, fecha);
  }
}

// ===================================================================
// MODAL: CATEGORÍA
// ===================================================================
function abrirModalCategoria(idEditar) {
  const modal = document.getElementById('modal-categoria');
  const esEdicion = Boolean(idEditar);

  document.getElementById('modal-categoria-titulo').textContent = esEdicion ? 'Editar categoría' : 'Nueva categoría';
  document.getElementById('cat-id').value = idEditar || '';
  document.getElementById('error-cat-nombre').classList.add('hidden');
  document.getElementById('cat-nombre').classList.remove('border-red-400');

  if (esEdicion) {
    const c = state.categorias.find(x => x.id === idEditar);
    if (!c) return;
    document.getElementById('cat-nombre').value = c.nombre;
    state.colorSeleccionado = c.color;
    state.iconoSeleccionado = c.icono;
    state.grupoSeleccionado = c.grupo || 'necesidad';
  } else {
    document.getElementById('cat-nombre').value = '';
    state.colorSeleccionado = COLORES_DISPONIBLES[0];
    state.iconoSeleccionado = ICONOS_DISPONIBLES[0];
    state.grupoSeleccionado = 'necesidad';
  }

  renderColorPicker();
  renderIconoPicker();
  renderGrupoPicker();
  modal.classList.add('active');
}

function cerrarModalCategoria() {
  document.getElementById('modal-categoria').classList.remove('active');
}

function renderColorPicker() {
  const cont = document.getElementById('color-picker');
  cont.innerHTML = COLORES_DISPONIBLES.map(color => {
    const activo = color === state.colorSeleccionado;
    return `<button type="button" class="w-7 h-7 rounded-full btn-color ${activo ? 'ring-2 ring-gray-900 ring-offset-2' : ''}" style="background:${color}" data-color="${color}"></button>`;
  }).join('');

  cont.querySelectorAll('.btn-color').forEach(btn => {
    btn.addEventListener('click', () => {
      state.colorSeleccionado = btn.dataset.color;
      renderColorPicker();
    });
  });
}

function renderIconoPicker() {
  const cont = document.getElementById('icono-picker');
  cont.innerHTML = ICONOS_DISPONIBLES.map(icono => {
    const activo = icono === state.iconoSeleccionado;
    return `<button type="button" class="w-9 h-9 rounded-lg border t-border t-card flex items-center justify-center btn-icono ${activo ? 'ring-2 ring-gray-900' : ''}" data-icono="${icono}">${icono}</button>`;
  }).join('');

  cont.querySelectorAll('.btn-icono').forEach(btn => {
    btn.addEventListener('click', () => {
      state.iconoSeleccionado = btn.dataset.icono;
      renderIconoPicker();
    });
  });
}

function renderGrupoPicker() {
  const cont = document.getElementById('grupo-picker');
  cont.innerHTML = GRUPOS_50_30_20.map(g => {
    const activo = g.id === state.grupoSeleccionado;
    return `
      <button type="button"
        class="flex-1 px-2 py-2 rounded-lg border text-xs font-medium btn-grupo transition ${activo ? '' : 't-input'}"
        style="${activo ? `background:${g.color}22; border-color:${g.color}; color:${g.color}` : ''}"
        data-grupo="${g.id}">
        ${g.icono} ${g.nombre}
      </button>`;
  }).join('');

  cont.querySelectorAll('.btn-grupo').forEach(btn => {
    btn.addEventListener('click', () => {
      state.grupoSeleccionado = btn.dataset.grupo;
      renderGrupoPicker();
    });
  });
}

function validarYGuardarCategoria() {
  const nombre = document.getElementById('cat-nombre').value.trim();
  const id = document.getElementById('cat-id').value;

  document.getElementById('error-cat-nombre').classList.add('hidden');
  document.getElementById('cat-nombre').classList.remove('border-red-400');

  if (!nombre) {
    document.getElementById('error-cat-nombre').classList.remove('hidden');
    document.getElementById('cat-nombre').classList.add('border-red-400');
    return;
  }

  // Evitar nombres duplicados (case-insensitive), excluyendo la propia categoría si se edita
  const duplicado = state.categorias.some(c => c.nombre.toLowerCase() === nombre.toLowerCase() && c.id !== id);
  if (duplicado) {
    document.getElementById('error-cat-nombre').textContent = 'Ya existe una categoría con ese nombre';
    document.getElementById('error-cat-nombre').classList.remove('hidden');
    document.getElementById('cat-nombre').classList.add('border-red-400');
    return;
  }

  if (id) {
    const idx = state.categorias.findIndex(c => c.id === id);
    if (idx !== -1) {
      state.categorias[idx] = { ...state.categorias[idx], nombre, color: state.colorSeleccionado, icono: state.iconoSeleccionado, grupo: state.grupoSeleccionado };
    }
    mostrarToast('✅ Categoría actualizada');
  } else {
    state.categorias.push({
      id: generarId('cat'),
      nombre,
      color: state.colorSeleccionado,
      icono: state.iconoSeleccionado,
      grupo: state.grupoSeleccionado,
      bloqueada: false
    });
    mostrarToast('✅ Categoría creada');
  }

  guardarCategorias();
  cerrarModalCategoria();
  renderTodo();
}

// ===================================================================
// MODAL: META DE AHORRO
// ===================================================================
function abrirModalMeta() {
  const modal = document.getElementById('modal-meta');
  const titulo = document.getElementById('modal-meta-titulo');
  const btnBorrar = document.getElementById('btn-borrar-meta');
  const btnReiniciar = document.getElementById('btn-reiniciar-meta');
  const separador = document.getElementById('separador-acciones-meta');

  limpiarErroresMeta();

  if (state.meta) {
    titulo.textContent = 'Editar meta de ahorro';
    document.getElementById('meta-input-nombre').value = state.meta.nombre;
    document.getElementById('meta-input-objetivo').value = state.meta.montoObjetivo;
    document.getElementById('meta-input-actual').value = state.meta.montoActual || 0;
    document.getElementById('meta-input-fecha').value = state.meta.fechaLimite || '';
    btnBorrar.classList.remove('hidden');
    separador.classList.remove('hidden');
    // El botón de reiniciar solo tiene sentido si ya hay algo ahorrado
    btnReiniciar.classList.toggle('hidden', !(state.meta.montoActual > 0));
  } else {
    titulo.textContent = 'Nueva meta de ahorro';
    document.getElementById('meta-input-nombre').value = '';
    document.getElementById('meta-input-objetivo').value = '';
    document.getElementById('meta-input-actual').value = '';
    document.getElementById('meta-input-fecha').value = '';
    btnBorrar.classList.add('hidden');
    btnReiniciar.classList.add('hidden');
    separador.classList.add('hidden');
  }

  modal.classList.add('active');
}

function cerrarModalMeta() {
  document.getElementById('modal-meta').classList.remove('active');
}

function limpiarErroresMeta() {
  ['error-meta-nombre', 'error-meta-objetivo', 'error-meta-actual'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  ['meta-input-nombre', 'meta-input-objetivo', 'meta-input-actual'].forEach(id => {
    document.getElementById(id).classList.remove('border-red-400');
  });
}

function validarYGuardarMeta() {
  limpiarErroresMeta();

  const nombre = document.getElementById('meta-input-nombre').value.trim();
  const objetivoRaw = document.getElementById('meta-input-objetivo').value;
  const actualRaw = document.getElementById('meta-input-actual').value;
  const fechaLimite = document.getElementById('meta-input-fecha').value;

  const objetivo = parseFloat(objetivoRaw);
  const actual = actualRaw === '' ? 0 : parseFloat(actualRaw);

  let valido = true;

  if (!nombre) {
    document.getElementById('error-meta-nombre').classList.remove('hidden');
    document.getElementById('meta-input-nombre').classList.add('border-red-400');
    valido = false;
  }
  if (objetivoRaw === '' || isNaN(objetivo) || objetivo <= 0) {
    document.getElementById('error-meta-objetivo').classList.remove('hidden');
    document.getElementById('meta-input-objetivo').classList.add('border-red-400');
    valido = false;
  }
  if (isNaN(actual) || actual < 0) {
    document.getElementById('error-meta-actual').classList.remove('hidden');
    document.getElementById('meta-input-actual').classList.add('border-red-400');
    valido = false;
  }

  if (!valido) return;

  // Conservamos el historial de aportes si ya existía una meta
  const historialPrevio = (state.meta && Array.isArray(state.meta.historial)) ? state.meta.historial : [];

  state.meta = {
    nombre,
    montoObjetivo: Math.round(objetivo * 100) / 100,
    montoActual: Math.round(actual * 100) / 100,
    fechaLimite: fechaLimite || null,
    historial: historialPrevio
  };

  guardarMeta();
  cerrarModalMeta();
  mostrarToast('🎯 Meta guardada');
  renderTodo();
}

function agregarAporteAMeta(monto, fecha) {
  if (!state.meta) return;
  state.meta.montoActual = Math.round(((state.meta.montoActual || 0) + monto) * 100) / 100;
  if (!Array.isArray(state.meta.historial)) state.meta.historial = [];
  state.meta.historial.push({ monto, fecha });
  guardarMeta();
}

// ===================================================================
// AHORRO AUTOMÁTICO (modal de confirmación al registrar un ingreso)
// ===================================================================
function evaluarAhorroAutomatico(monto, fecha) {
  const porcentaje = state.config.porcentajeAhorro;

  // Solo se ofrece si hay un % configurado (>0) y una meta activa
  if (!porcentaje || porcentaje <= 0 || !state.meta) return false;

  const montoAhorro = Math.round((monto * (porcentaje / 100)) * 100) / 100;
  if (montoAhorro <= 0) return false;

  state.ingresoPendienteAhorro = { monto: montoAhorro, fecha, porcentaje };

  document.getElementById('ahorro-auto-monto').textContent = formatoMoneda(montoAhorro);
  document.getElementById('ahorro-auto-porcentaje').textContent = porcentaje;
  document.getElementById('modal-ahorro-auto').classList.add('active');
  return true;
}

function aceptarAhorroAutomatico() {
  if (!state.ingresoPendienteAhorro) return;
  const { monto, fecha } = state.ingresoPendienteAhorro;
  agregarAporteAMeta(monto, fecha);
  cerrarModalAhorroAuto();
  mostrarToast(`🐷 ${formatoMoneda(monto)} apartados para tu meta`);
  renderTodo();
}

function cerrarModalAhorroAuto() {
  document.getElementById('modal-ahorro-auto').classList.remove('active');
  state.ingresoPendienteAhorro = null;
}

function guardarPorcentajeAhorro(valorRaw) {
  const valor = parseFloat(valorRaw);
  state.config.porcentajeAhorro = (valorRaw === '' || isNaN(valor) || valor <= 0) ? null : Math.min(100, valor);
  guardarConfig();
}

// ===================================================================
// ELIMINACIÓN (con confirmación)
// ===================================================================
function pedirConfirmacionEliminar(tipo, id) {
  state.pendienteEliminar = { tipo, id };
  let texto = '¿Eliminar esta transacción? Esta acción no se puede deshacer.';
  if (tipo === 'categoria') texto = '¿Eliminar esta categoría? Las transacciones asociadas se reasignarán a "Otros".';
  if (tipo === 'meta') texto = '¿Eliminar esta meta? Se borrará el nombre, el objetivo y todo el ahorro acumulado.';
  if (tipo === 'reinicio_meta') texto = '¿Reiniciar el ahorro a $0.00? El nombre y el objetivo de la meta se mantienen.';
  document.getElementById('confirmar-texto').textContent = texto;
  document.getElementById('modal-confirmar').classList.add('active');
}

function cerrarModalConfirmar() {
  document.getElementById('modal-confirmar').classList.remove('active');
  state.pendienteEliminar = null;
}

function ejecutarEliminacion() {
  if (!state.pendienteEliminar) return;
  const { tipo, id } = state.pendienteEliminar;

  if (tipo === 'transaccion') {
    state.transacciones = state.transacciones.filter(t => t.id !== id);
    guardarTransacciones();
    mostrarToast('🗑️ Transacción eliminada');
  } else if (tipo === 'categoria') {
    // Reasignar transacciones a "Otros" antes de borrar
    const catOtros = state.categorias.find(c => c.id === 'cat_otros');
    state.transacciones.forEach(t => {
      if (t.categoriaId === id) t.categoriaId = catOtros ? catOtros.id : 'cat_otros';
    });
    state.categorias = state.categorias.filter(c => c.id !== id);
    guardarTransacciones();
    guardarCategorias();
    mostrarToast('🗑️ Categoría eliminada');
  } else if (tipo === 'meta') {
    state.meta = null;
    guardarMeta();
    cerrarModalMeta();
    mostrarToast('🗑️ Meta eliminada');
  } else if (tipo === 'reinicio_meta') {
    if (state.meta) {
      state.meta.montoActual = 0;
      state.meta.historial = [];
      guardarMeta();
    }
    cerrarModalMeta();
    mostrarToast('↺ Ahorro reiniciado a $0.00');
  }

  cerrarModalConfirmar();
  renderTodo();
}

// ===================================================================
// EXPORTAR / IMPORTAR BACKUP
// ===================================================================
function exportarDatos() {
  try {
    const backup = {
      version: 1,
      exportadoEn: new Date().toISOString(),
      transacciones: state.transacciones,
      categorias: state.categorias,
      meta: state.meta,
      config: state.config
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `mis-finanzas-backup-${fecha}.json`;
    a.style.display = 'none';

    // CLAVE: el <a> debe estar en el DOM para que .click() dispare la descarga
    // en todos los navegadores (Safari, iOS, algunos WebViews lo ignoran si no está insertado)
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Pequeño delay antes de revocar la URL para no cortar la descarga en navegadores lentos
    setTimeout(() => URL.revokeObjectURL(url), 100);

    mostrarToast('📤 Backup descargado correctamente');
  } catch (e) {
    console.error('Error al exportar el backup:', e);
    mostrarToast('❌ No se pudo generar el backup. Revisa la consola.');
  }
}

function importarDatos(archivo) {
  if (!archivo) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const datos = JSON.parse(e.target.result);

      // Validación básica
      if (!datos.transacciones || !datos.categorias) {
        mostrarToast('❌ Archivo inválido. ¿Es un backup de esta app?');
        return;
      }

      // Confirmación antes de sobrescribir
      const n = datos.transacciones.length;
      const confirmar = window.confirm(
        `¿Importar este backup?\n\n· ${n} transacciones\n· ${datos.categorias.length} categorías\n\nEsto reemplazará todos tus datos actuales.`
      );
      if (!confirmar) return;

      state.transacciones = datos.transacciones || [];
      state.categorias = datos.categorias || [...CATEGORIAS_DEFAULT];
      state.meta = datos.meta || null;
      state.config = datos.config || { porcentajeAhorro: null };

      // Migración por si el backup es de una versión anterior (sin grupo en categorías)
      state.categorias.forEach(c => {
        if (!c.grupo || !GRUPOS_50_30_20.some(g => g.id === c.grupo)) {
          c.grupo = 'estilo_vida';
        }
      });

      guardarTransacciones();
      guardarCategorias();
      guardarMeta();
      guardarConfig();

      // Actualizar el input de porcentaje con el valor importado
      const inputPct = document.getElementById('ahorro-porcentaje');
      if (inputPct) inputPct.value = state.config.porcentajeAhorro || '';

      mostrarToast(`✅ Backup importado — ${n} transacciones restauradas`);
      renderTodo();
    } catch (err) {
      console.error('Error al importar:', err);
      mostrarToast('❌ No se pudo leer el archivo. ¿Está dañado?');
    }
  };
  reader.readAsText(archivo);
}

// ===================================================================
// EVENT LISTENERS (delegación de eventos para elementos dinámicos)
// ===================================================================
function inicializarEventos() {
  // Navegación
  document.querySelectorAll('.nav-link, .nav-link-mobile').forEach(link => {
    link.addEventListener('click', () => cambiarVista(link.dataset.view));
  });

  // Botón flotante "+"
  document.getElementById('btn-add-fab').addEventListener('click', () => abrirModalTransaccion(null));

  // Modal transacción
  document.getElementById('btn-cerrar-modal-transaccion').addEventListener('click', cerrarModalTransaccion);
  document.getElementById('btn-cancelar-transaccion').addEventListener('click', cerrarModalTransaccion);
  document.getElementById('btn-guardar-transaccion').addEventListener('click', validarYGuardarTransaccion);
  document.getElementById('btn-tipo-gasto').addEventListener('click', () => seleccionarTipo('gasto'));
  document.getElementById('btn-tipo-ingreso').addEventListener('click', () => seleccionarTipo('ingreso'));
  document.getElementById('modal-transaccion').addEventListener('click', (e) => {
    if (e.target.id === 'modal-transaccion') cerrarModalTransaccion();
  });

  // Modal categoría
  document.getElementById('btn-nueva-categoria').addEventListener('click', () => abrirModalCategoria(null));
  document.getElementById('btn-cerrar-modal-categoria').addEventListener('click', cerrarModalCategoria);
  document.getElementById('btn-cancelar-categoria').addEventListener('click', cerrarModalCategoria);
  document.getElementById('btn-guardar-categoria').addEventListener('click', validarYGuardarCategoria);
  document.getElementById('modal-categoria').addEventListener('click', (e) => {
    if (e.target.id === 'modal-categoria') cerrarModalCategoria();
  });

  // Modal confirmar eliminación
  document.getElementById('btn-cancelar-confirmar').addEventListener('click', cerrarModalConfirmar);
  document.getElementById('btn-confirmar-eliminar').addEventListener('click', ejecutarEliminacion);
  document.getElementById('modal-confirmar').addEventListener('click', (e) => {
    if (e.target.id === 'modal-confirmar') cerrarModalConfirmar();
  });

  // Modal meta de ahorro
  document.getElementById('btn-crear-meta').addEventListener('click', () => abrirModalMeta());
  document.getElementById('btn-editar-meta').addEventListener('click', () => abrirModalMeta());
  document.getElementById('btn-cerrar-modal-meta').addEventListener('click', cerrarModalMeta);
  document.getElementById('btn-cancelar-meta').addEventListener('click', cerrarModalMeta);
  document.getElementById('btn-guardar-meta').addEventListener('click', validarYGuardarMeta);
  document.getElementById('btn-borrar-meta').addEventListener('click', () => pedirConfirmacionEliminar('meta'));
  document.getElementById('btn-reiniciar-meta').addEventListener('click', () => pedirConfirmacionEliminar('reinicio_meta'));
  document.getElementById('modal-meta').addEventListener('click', (e) => {
    if (e.target.id === 'modal-meta') cerrarModalMeta();
  });

  // Modal confirmación de ahorro automático
  document.getElementById('btn-aceptar-ahorro-auto').addEventListener('click', aceptarAhorroAutomatico);
  document.getElementById('btn-rechazar-ahorro-auto').addEventListener('click', cerrarModalAhorroAuto);
  document.getElementById('modal-ahorro-auto').addEventListener('click', (e) => {
    if (e.target.id === 'modal-ahorro-auto') cerrarModalAhorroAuto();
  });

  // Porcentaje de ahorro automático (configuración persistente)
  const inputPorcentaje = document.getElementById('ahorro-porcentaje');
  inputPorcentaje.value = state.config.porcentajeAhorro || '';
  inputPorcentaje.addEventListener('input', (e) => guardarPorcentajeAhorro(e.target.value));

  // Exportar / Importar (escritorio)
  document.getElementById('btn-exportar').addEventListener('click', exportarDatos);
  document.getElementById('input-importar').addEventListener('change', (e) => {
    importarDatos(e.target.files[0]);
    e.target.value = ''; // reset para poder importar el mismo archivo dos veces si hace falta
  });

  // Exportar / Importar (móvil)
  document.getElementById('btn-exportar-mobile').addEventListener('click', exportarDatos);
  document.getElementById('input-importar-mobile').addEventListener('change', (e) => {
    importarDatos(e.target.files[0]);
    e.target.value = '';
  });

  // Filtros del historial (delegados a inputs estáticos)
  ['buscador', 'filtro-tipo', 'filtro-categoria', 'filtro-mes', 'rango-desde', 'rango-hasta'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderHistorial);
  });

  document.getElementById('filtro-mes').addEventListener('change', () => {
    const esPersonalizado = document.getElementById('filtro-mes').value === 'personalizado';
    document.getElementById('rango-personalizado').classList.toggle('hidden', !esPersonalizado);
  });

  // Delegación de eventos para botones generados dinámicamente
  document.addEventListener('click', (e) => {
    const btnEditarTxn = e.target.closest('.btn-editar-txn');
    if (btnEditarTxn) return abrirModalTransaccion(btnEditarTxn.dataset.id);

    const btnEliminarTxn = e.target.closest('.btn-eliminar-txn');
    if (btnEliminarTxn) return pedirConfirmacionEliminar('transaccion', btnEliminarTxn.dataset.id);

    const btnEditarCat = e.target.closest('.btn-editar-cat');
    if (btnEditarCat) return abrirModalCategoria(btnEditarCat.dataset.id);

    const btnEliminarCat = e.target.closest('.btn-eliminar-cat');
    if (btnEliminarCat) return pedirConfirmacionEliminar('categoria', btnEliminarCat.dataset.id);
  });

  // Atajo: tecla Escape cierra cualquier modal abierto
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarModalTransaccion();
      cerrarModalCategoria();
      cerrarModalConfirmar();
      cerrarModalMeta();
      cerrarModalAhorroAuto();
    }
  });
}

// ===================================================================
// INICIALIZACIÓN
// ===================================================================
function init() {
  cargarTemaInicial();
  cargarDatos();
  inicializarEventos();
  cambiarVista('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
