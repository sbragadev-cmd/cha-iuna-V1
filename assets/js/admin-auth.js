import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const loading = document.querySelector("#adminLoading");
const app = document.querySelector("#adminApp");
const logoutButton = document.querySelector("#logoutButton");


function getNormalizedField(data, expectedName) {
  if (!data || typeof data !== "object") return undefined;

  if (Object.prototype.hasOwnProperty.call(data, expectedName)) {
    return data[expectedName];
  }

  const normalizedExpected = expectedName.trim().toLowerCase();

  const matchingKey = Object.keys(data).find(
    (key) => String(key).trim().toLowerCase() === normalizedExpected
  );

  return matchingKey ? data[matchingKey] : undefined;
}

function normalizeRole(value = "") {
  return String(value).trim().toLowerCase();
}

function isAdminActive(value) {
  return value === true
    || value === 1
    || String(value).trim().toLowerCase() === "true"
    || String(value).trim().toLowerCase() === "ativo";
}


async function validateAdmin(user) {
  const adminRef = doc(db, "admins", user.uid);
  const snapshot = await getDoc(adminRef);

  if (!snapshot.exists()) {
    throw new Error("ADMIN_NOT_FOUND");
  }

  const data = snapshot.data();
  const rawActive = getNormalizedField(data, "active");
  const rawRole = getNormalizedField(data, "role");
  const active = isAdminActive(rawActive);
  const role = normalizeRole(rawRole);

  console.log("[ADMIN AUTH] Verificação administrativa", {
    uid: user.uid,
    projectId: db.app.options.projectId,
    chavesRecebidas: Object.keys(data),
    activeRecebido: rawActive,
    activeInterpretado: active,
    roleRecebida: rawRole,
    roleInterpretada: role
  });

  if (!active) throw new Error("ADMIN_INACTIVE");
  if (!["owner", "admin", "editor"].includes(role)) {
    throw new Error("ADMIN_ROLE_INVALID");
  }

  try {
    await updateDoc(adminRef, {
      lastLoginAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("[ADMIN AUTH] Não foi possível atualizar lastLoginAt:", error);
  }

  return { ...data, active: true, role };
}

function exposeAdminSession(user, adminData) {
  window.__IUNA_ADMIN__ = { user, admin: adminData };

  window.dispatchEvent(
    new CustomEvent("iuna-admin-ready", {
      detail: window.__IUNA_ADMIN__
    })
  );
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("./login.html?redirect=admin");
    return;
  }

  try {
    const adminData = await validateAdmin(user);

    if (loading) loading.hidden = true;
    if (app) app.hidden = false;

    exposeAdminSession(user, adminData);
  } catch (error) {
    console.error("[ADMIN AUTH] Acesso recusado:", error);

    await signOut(auth).catch(() => {});
    window.location.replace(`./login.html?erro=${encodeURIComponent(error.message)}`);
  }
});

logoutButton?.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await signOut(auth);
    window.location.replace("./login.html");
  } catch (error) {
    console.error("[ADMIN AUTH] Erro ao sair:", error);
    logoutButton.disabled = false;
  }
});
