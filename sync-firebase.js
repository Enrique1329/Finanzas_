// ===================================================================
// sync-firebase.js
// Sincronización en la nube (login + Firestore). Módulo aditivo:
// usa `state`, `guardarTransacciones()`, etc. de app.js sin tocarlo.
// Cárgalo AL FINAL de todo, después de firebase-*-compat.js y de
// app.js / pwa-extra.js / recordatorios.js / cuentas.js.
// ===================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDVg0fcpiZZfJTEdKY0stopzQg6ZJ3OOV4",
  authDomain: "mis-finanzas-20afd.firebaseapp.com",
  projectId: "mis-finanzas-20afd",
  storageBucket: "mis-finanzas-20afd.firebasestorage.app",
  messagingSenderId: "628700606602",
  appId: "1:628700606602:web:5b0ae2600eb36d4e01bd73"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const CLAVES_SYNC = [
  'gastos_app_transacciones', 'gastos_app_categorias', 'gastos_app_tema',
  'gastos_app_meta', 'gastos_app_config', 'gastos_app_cuentas',
  'gastos_app_presupuestos', 'gastos_app_recordatorios'
];

let usuarioActual = null;
let ultimoHashSubido = null;

function leerTodoLocalStorage() {
  const datos = {};
  CLAVES_SYNC.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) datos[k] = v;
  });
  return datos;
}

function escribirTodoLocalStorage(datos) {
  CLAVES_SYNC.forEach(k => {
    if (datos[k] !== undefined) localStorage.setItem(k, datos[k]);
  });
}

function marcarEstadoSync(texto) {
  const el = document.getElementById('sync-estado');
  if (el) el.textContent = texto;
}

async function subirDatos() {
  if (!usuarioActual) return;
  const datos = leerTodoLocalStorage();
  const hash = JSON.stringify(datos);
  if (hash === ultimoHashSubido) return; // nada cambió, no gastamos escritura
  try {
    await db.collection('usuarios').doc(usuarioActual.uid).set({
      datos,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    });
    ultimoHashSubido = hash;
    marcarEstadoSync('Sincronizado ✓');
  } catch (e) {
    console.error('Error subiendo a Firebase:', e);
    marcarEstadoSync('⚠️ Error al sincronizar');
  }
}

// SOLO adopta los datos de la nube automáticamente si este dispositivo
// está "vacío" (nunca usó la app). Si ya hay datos locales, NO los pisa
// solo ni recarga la página — evita cualquier loop de recargas.
// Para traer la nube a propósito (ej. cambiaste de celular) está el
// botón "Traer de la nube" en el menú de cuenta.
async function chequearPrimerIngreso() {
  const yaTieneDatosLocales = localStorage.getItem('gastos_app_transacciones') !== null;
  if (yaTieneDatosLocales) {
    ultimoHashSubido = null; // fuerza a comparar/subir en el próximo subirDatos()
    return;
  }
  const doc = await db.collection('usuarios').doc(usuarioActual.uid).get();
  if (doc.exists && doc.data().datos) {
    escribirTodoLocalStorage(doc.data().datos);
    location.reload(); // única vez: dispositivo nuevo adoptando datos existentes
  }
}

async function traerDeLaNubeManual() {
  if (!usuarioActual) return;
  const ok = confirm('Esto va a reemplazar los datos de este dispositivo con los que están guardados en la nube. ¿Continuar?');
  if (!ok) return;
  const doc = await db.collection('usuarios').doc(usuarioActual.uid).get();
  if (doc.exists && doc.data().datos) {
    escribirTodoLocalStorage(doc.data().datos);
    location.reload();
  } else {
    alert('Todavía no hay nada guardado en la nube para esta cuenta.');
  }
}

// -------------------------------------------------------------
// UI de login — inyectada por JS, no requiere editar el HTML
// -------------------------------------------------------------
function traducirErrorAuth(codigo) {
  const map = {
    'auth/invalid-email': 'Email inválido',
    'auth/user-not-found': 'No existe una cuenta con ese email',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
    'auth/invalid-credential': 'Email o contraseña incorrectos'
  };
  return map[codigo] || 'Ocurrió un error, intenta de nuevo';
}

function crearOverlayLogin() {
  if (document.getElementById('auth-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg,#1E1E20);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;font-family:Inter,-apple-system,sans-serif;';
  overlay.innerHTML = `
    <div style="background:var(--bg-card,#2A2A2D);border-radius:16px;padding:24px;max-width:340px;width:100%;color:var(--text,#ECECEC);">
      <p style="font-size:18px;font-weight:800;margin-bottom:4px;">💰 Mis Finanzas</p>
      <p style="font-size:13px;color:var(--text-soft,#A3A3A6);margin-bottom:16px;">Iniciá sesión para sincronizar tus datos</p>
      <input id="auth-email" type="email" placeholder="Email" style="width:100%;padding:10px 12px;margin-bottom:8px;border-radius:8px;border:1px solid var(--border,#3A3A3D);background:var(--bg-card,#2A2A2D);color:inherit;box-sizing:border-box;">
      <input id="auth-pass" type="password" placeholder="Contraseña" style="width:100%;padding:10px 12px;margin-bottom:8px;border-radius:8px;border:1px solid var(--border,#3A3A3D);background:var(--bg-card,#2A2A2D);color:inherit;box-sizing:border-box;">
      <p id="auth-error" style="color:var(--accent-gasto,#F87171);font-size:12px;margin-bottom:8px;display:none;"></p>
      <button id="auth-btn-login" style="width:100%;padding:10px;border-radius:10px;border:none;background:var(--bg-active,#fff);color:var(--on-active,#1E1E20);font-weight:600;margin-bottom:8px;cursor:pointer;">Iniciar sesión</button>
      <button id="auth-btn-registro" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--border,#3A3A3D);background:transparent;color:inherit;font-weight:600;cursor:pointer;">Crear cuenta nueva</button>
    </div>`;
  document.body.appendChild(overlay);

  const email = () => document.getElementById('auth-email').value.trim();
  const pass = () => document.getElementById('auth-pass').value;
  const err = document.getElementById('auth-error');
  const mostrarError = (msg) => { err.textContent = msg; err.style.display = 'block'; };

  document.getElementById('auth-btn-login').addEventListener('click', () => {
    auth.signInWithEmailAndPassword(email(), pass()).catch(e => mostrarError(traducirErrorAuth(e.code)));
  });
  document.getElementById('auth-btn-registro').addEventListener('click', () => {
    auth.createUserWithEmailAndPassword(email(), pass()).catch(e => mostrarError(traducirErrorAuth(e.code)));
  });
}

function quitarOverlayLogin() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.remove();
}

// -------------------------------------------------------------
// Botón de cuenta ÚNICO — insertado junto a los íconos de
// exportar/importar (móvil Y escritorio), no flotante. El menú se
// posiciona solo, debajo de donde esté el botón.
// -------------------------------------------------------------
function posicionarMenu(btn, menu) {
  const r = btn.getBoundingClientRect();
  const ANCHO_MENU = 200;
  const ALTO_MENU_ESTIMADO = 170;

  // Vertical: abre hacia abajo si hay espacio, si no hacia arriba
  menu.style.top = '';
  menu.style.bottom = '';
  if (window.innerHeight - r.bottom < ALTO_MENU_ESTIMADO) {
    menu.style.bottom = `${Math.max(8, window.innerHeight - r.top + 6)}px`;
  } else {
    menu.style.top = `${r.bottom + 6}px`;
  }

  // Horizontal: abre hacia la derecha si hay espacio, si no hacia la izquierda
  menu.style.left = '';
  menu.style.right = '';
  if (r.left + ANCHO_MENU < window.innerWidth) {
    menu.style.left = `${r.left}px`;
  } else {
    menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  }
}

function crearBotonCuenta() {
  if (document.querySelector('.btn-cuenta-flotante')) return;

  const menu = document.createElement('div');
  menu.id = 'menu-cuenta-flotante';
  menu.style.cssText = 'position:fixed;z-index:9998;background:var(--bg-card,#2A2A2D);border:1px solid var(--border,#3A3A3D);border-radius:12px;padding:10px;min-width:190px;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-family:Inter,-apple-system,sans-serif;';
  menu.innerHTML = `
    <p id="sync-estado" style="font-size:12px;color:var(--text-soft,#A3A3A6);margin-bottom:8px;word-break:break-all;"></p>
    <button id="btn-sync-ahora" style="display:block;width:100%;text-align:left;font-size:12px;color:var(--text,#ECECEC);background:none;border:none;padding:6px 0;cursor:pointer;">🔄 Sincronizar ahora</button>
    <button id="btn-traer-nube" style="display:block;width:100%;text-align:left;font-size:12px;color:var(--text,#ECECEC);background:none;border:none;padding:6px 0;cursor:pointer;">⬇️ Traer de la nube</button>
    <button id="btn-cerrar-sesion" style="display:block;width:100%;text-align:left;font-size:12px;color:var(--accent-gasto,#F87171);background:none;border:none;padding:6px 0;cursor:pointer;">Cerrar sesión</button>`;
  document.body.appendChild(menu);

  function crearBoton() {
    const btn = document.createElement('button');
    btn.className = 'btn-cuenta-flotante text-xs t-text-soft t-hover px-2 py-1.5 rounded-lg border t-border';
    btn.textContent = '👤';
    btn.style.cssText += 'border-radius:9999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const abierto = menu.style.display === 'block';
      if (!abierto) posicionarMenu(btn, menu);
      menu.style.display = abierto ? 'none' : 'block';
    });
    return btn;
  }

  // Móvil: junto a los íconos de exportar/importar de la barra superior
  const contMobile = document.getElementById('btn-exportar-mobile')?.parentElement;
  if (contMobile) contMobile.insertBefore(crearBoton(), contMobile.firstChild);

  // Escritorio: al final del sidebar (solo si existe ese layout)
  const contDesktop = document.querySelector('aside .mt-auto');
  if (contDesktop) {
    const btnDesktop = crearBoton();
    btnDesktop.style.marginTop = '12px';
    contDesktop.appendChild(btnDesktop);
  }

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !e.target.classList.contains('btn-cuenta-flotante')) menu.style.display = 'none';
  });
  window.addEventListener('resize', () => { menu.style.display = 'none'; });

  document.getElementById('btn-sync-ahora').addEventListener('click', () => {
    ultimoHashSubido = null;
    subirDatos();
  });
  document.getElementById('btn-traer-nube').addEventListener('click', traerDeLaNubeManual);
  document.getElementById('btn-cerrar-sesion').addEventListener('click', () => auth.signOut());
}

function quitarBotonCuenta() {
  document.querySelectorAll('.btn-cuenta-flotante').forEach(el => el.remove());
  document.getElementById('menu-cuenta-flotante')?.remove();
}

// -------------------------------------------------------------
// FLUJO PRINCIPAL
// -------------------------------------------------------------
auth.onAuthStateChanged(async (user) => {
  quitarOverlayLogin();
  quitarBotonCuenta();
  if (user) {
    usuarioActual = user;
    await chequearPrimerIngreso();
    crearBotonCuenta();
    marcarEstadoSync(usuarioActual.email);
  } else {
    usuarioActual = null;
    crearOverlayLogin();
  }
});

// Autosync silencioso: cada 20s si hubo cambios, y al ocultar/cerrar
// la pestaña. Nunca recarga la página por su cuenta.
setInterval(subirDatos, 20000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') subirDatos();
});
