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
    marcarEstadoSync('☁️ Sincronizado');
  } catch (e) {
    console.error('Error subiendo a Firebase:', e);
    marcarEstadoSync('⚠️ Error al sincronizar');
  }
}

// Compara la nube contra lo local; si hay diferencias, adopta la nube
// y recarga UNA vez (después de recargar ya van a coincidir, así que
// no se genera un loop).
async function descargarYSincronizar() {
  const doc = await db.collection('usuarios').doc(usuarioActual.uid).get();
  if (!doc.exists || !doc.data().datos) {
    await subirDatos(); // primera vez: la nube no tiene nada, subimos lo local
    return;
  }
  const datosNube = doc.data().datos;
  const datosLocales = leerTodoLocalStorage();
  if (JSON.stringify(datosNube) !== JSON.stringify(datosLocales)) {
    escribirTodoLocalStorage(datosNube);
    ultimoHashSubido = JSON.stringify(datosNube);
    location.reload();
  } else {
    ultimoHashSubido = JSON.stringify(datosLocales);
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

// Botón de cuenta/cerrar sesión, visible en escritorio (sidebar) Y en
// móvil normal (barra superior), sin depender de "Sitio de escritorio".
function inicializarUISync() {
  // Desktop: dentro del sidebar
  if (!document.getElementById('sync-estado')) {
    const cont = document.querySelector('aside .mt-auto');
    if (cont) {
      const bloque = document.createElement('div');
      bloque.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid var(--border)';
      bloque.innerHTML = `
        <p id="sync-estado" class="text-xs t-text-faint mb-2">☁️ Conectado</p>
        <button id="btn-sync-ahora" class="text-xs t-text-faint hover:opacity-70 mr-3">🔄 Sincronizar</button>
        <button id="btn-cerrar-sesion" class="text-xs t-text-faint hover:opacity-70">Cerrar sesión</button>`;
      cont.appendChild(bloque);
      document.getElementById('btn-cerrar-sesion').addEventListener('click', () => auth.signOut());
      document.getElementById('btn-sync-ahora').addEventListener('click', () => {
        ultimoHashSubido = null;
        subirDatos();
      });
    }
  }

  // Móvil: un botón compacto en la barra superior (junto a exportar/importar)
  if (!document.getElementById('btn-cuenta-mobile')) {
    const contMobile = document.getElementById('btn-exportar-mobile')?.parentElement;
    if (contMobile) {
      const btn = document.createElement('button');
      btn.id = 'btn-cuenta-mobile';
      btn.className = 'text-xs t-text-soft t-hover px-2 py-1.5 rounded-lg border t-border';
      btn.textContent = '☁️';
      btn.addEventListener('click', () => {
        const salir = confirm(`Conectado como ${usuarioActual.email}\n\n¿Cerrar sesión?`);
        if (salir) auth.signOut();
      });
      contMobile.appendChild(btn);
    }
  }
}

// -------------------------------------------------------------
// FLUJO PRINCIPAL
// -------------------------------------------------------------
auth.onAuthStateChanged(async (user) => {
  if (user) {
    usuarioActual = user;
    quitarOverlayLogin();
    await descargarYSincronizar();
    inicializarUISync();
  } else {
    usuarioActual = null;
    crearOverlayLogin();
  }
});

// Autosync: cada 20s si hubo cambios, y al ocultar/cerrar la pestaña
setInterval(subirDatos, 20000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') subirDatos();
});
