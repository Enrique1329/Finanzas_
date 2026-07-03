// ===================== SYNC FIREBASE =====================
// Login / Registro / Logout + sincronización de datos con Firestore

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

// Claves de localStorage que se sincronizan con la nube
const SYNC_KEYS = [
  "gastos_app_transacciones",
  "gastos_app_categorias",
  "gastos_app_tema",
  "gastos_app_meta",
  "gastos_app_config",
  "gastos_app_cuentas",
  "gastos_app_presupuestos",
  "gastos_app_recordatorios"
];

let modoRegistro = false;
let sincronizando = false; // evita loops al escribir datos que vienen de la nube

// Todo lo que toca el DOM espera a que la página termine de cargar,
// así no importa en qué orden estén los <script> ni el modal en el HTML.
window.addEventListener("DOMContentLoaded", () => {

// ---------- Elementos ----------
const btnAbrirLogin = document.getElementById("btn-abrir-login");
const loginStatusText = document.getElementById("login-status-text");
const modalLogin = document.getElementById("modal-login");
const loginTitulo = document.getElementById("login-titulo");
const loginError = document.getElementById("login-error");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const btnLoginSubmit = document.getElementById("btn-login-submit");
const btnToggleRegistro = document.getElementById("btn-toggle-registro");
const btnLogout = document.getElementById("btn-logout");
const btnCerrarLogin = document.getElementById("btn-cerrar-login");

function mostrarError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}

function ocultarError() {
  loginError.classList.add("hidden");
}

function traducirErrorFirebase(code) {
  const mapa = {
    "auth/invalid-email": "Correo inválido.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/missing-password": "Escribe tu contraseña.",
    "auth/network-request-failed": "Error de conexión. Revisa tu internet."
  };
  return mapa[code] || "Ocurrió un error. Intenta de nuevo.";
}

// ---------- Vista del modal: login/registro vs cuenta (logueado) ----------
function mostrarVistaFormulario() {
  loginTitulo.textContent = modoRegistro ? "Crear cuenta" : "Iniciar sesión";
  loginEmail.classList.remove("hidden");
  loginPassword.classList.remove("hidden");
  loginEmail.previousElementSibling.classList.remove("hidden"); // label correo
  loginPassword.previousElementSibling.classList.remove("hidden"); // label contraseña
  btnLoginSubmit.textContent = modoRegistro ? "Crear cuenta" : "Iniciar sesión";
  btnLoginSubmit.classList.remove("hidden");
  btnToggleRegistro.parentElement.classList.remove("hidden");
  btnToggleRegistro.textContent = modoRegistro ? "Inicia sesión" : "Regístrate";
  btnToggleRegistro.previousSibling.textContent = modoRegistro
    ? "¿Ya tienes cuenta? "
    : "¿No tienes cuenta? ";
  btnLogout.classList.add("hidden");
  ocultarError();
}

function mostrarVistaCuenta(user) {
  loginTitulo.textContent = "Mi cuenta";
  loginEmail.classList.add("hidden");
  loginPassword.classList.add("hidden");
  loginEmail.previousElementSibling.classList.add("hidden");
  loginPassword.previousElementSibling.classList.add("hidden");
  btnLoginSubmit.classList.add("hidden");
  btnToggleRegistro.parentElement.classList.add("hidden");
  btnLogout.classList.remove("hidden");
  ocultarError();

  // Muestra el correo dentro del modal
  let infoEmail = document.getElementById("cuenta-email-info");
  if (!infoEmail) {
    infoEmail = document.createElement("p");
    infoEmail.id = "cuenta-email-info";
    infoEmail.className = "text-sm t-text-soft mb-5 text-center";
    btnLogout.parentElement.insertBefore(infoEmail, btnLogout);
  }
  infoEmail.textContent = user.email;
}

function abrirModal() {
  modalLogin.classList.add("active");
}

function cerrarModal() {
  modalLogin.classList.remove("active");
}

// ---------- Eventos del botón principal ----------
btnAbrirLogin.addEventListener("click", () => {
  const user = auth.currentUser;
  if (user) {
    mostrarVistaCuenta(user);
  } else {
    modoRegistro = false;
    mostrarVistaFormulario();
  }
  abrirModal();
});

btnCerrarLogin.addEventListener("click", cerrarModal);

btnToggleRegistro.addEventListener("click", () => {
  modoRegistro = !modoRegistro;
  mostrarVistaFormulario();
});

btnLoginSubmit.addEventListener("click", async () => {
  ocultarError();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    mostrarError("Completa correo y contraseña.");
    return;
  }

  btnLoginSubmit.disabled = true;
  try {
    if (modoRegistro) {
      await auth.createUserWithEmailAndPassword(email, password);
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
    loginEmail.value = "";
    loginPassword.value = "";
    cerrarModal();
  } catch (err) {
    mostrarError(traducirErrorFirebase(err.code));
  } finally {
    btnLoginSubmit.disabled = false;
  }
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  cerrarModal();
});

// ---------- Sincronización con Firestore ----------
async function descargarDatosDeNube(uid) {
  const doc = await db.collection("usuarios").doc(uid).get();
  if (doc.exists) {
    const datos = doc.data();
    sincronizando = true;
    SYNC_KEYS.forEach((key) => {
      if (datos[key] !== undefined) {
        localStorage.setItem(key, datos[key]);
      }
    });
    sincronizando = false;
    return true;
  }
  return false;
}

async function subirDatosANube(uid) {
  const datos = {};
  SYNC_KEYS.forEach((key) => {
    const val = localStorage.getItem(key);
    if (val !== null) datos[key] = val;
  });
  await db.collection("usuarios").doc(uid).set(datos, { merge: true });
}

// Envuelve localStorage.setItem para subir cambios automáticamente mientras hay sesión
const originalSetItem = localStorage.setItem.bind(localStorage);
let debounceTimer = null;
localStorage.setItem = function (key, value) {
  originalSetItem(key, value);
  const user = auth.currentUser;
  if (user && !sincronizando && SYNC_KEYS.includes(key)) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      subirDatosANube(user.uid).catch((e) => console.error("Error al sincronizar:", e));
    }, 800);
  }
};

// ---------- Estado de sesión ----------
auth.onAuthStateChanged(async (user) => {
  if (user) {
    loginStatusText.textContent = user.email;
    const teniaDatosRemotos = await descargarDatosDeNube(user.uid);
    if (!teniaDatosRemotos) {
      await subirDatosANube(user.uid);
    } else {
      // Recarga para que app.js, cuentas.js, etc. rendericen con los datos bajados
      location.reload();
    }
  } else {
    loginStatusText.textContent = "Iniciar sesión";
  }
});

}); // fin DOMContentLoaded
