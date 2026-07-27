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

async function validateAdmin(user) {
  const adminRef = doc(db, "admins", user.uid);
  const snapshot = await getDoc(adminRef);

  if (!snapshot.exists()) {
    throw new Error("ADMIN_NOT_FOUND");
  }

  const data = snapshot.data();

  if (
    data.active !== true ||
    !["owner", "admin", "editor"].includes(data.role)
  ) {
    throw new Error("ADMIN_INACTIVE");
  }

  try {
    await updateDoc(adminRef, {
      lastLoginAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("[ADMIN AUTH] Não foi possível atualizar lastLoginAt:", error);
  }

  return data;
}

function exposeAdminSession(user, adminData) {
  window.__IUNA_ADMIN__ = {
    user,
    admin: adminData
  };

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

    loading.hidden = true;
    app.hidden = false;

    exposeAdminSession(user, adminData);
  } catch (error) {
    console.error("[ADMIN AUTH] Acesso recusado:", error);

    await signOut(auth).catch(() => {});
    window.location.replace("./login.html?erro=sem-permissao");
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
