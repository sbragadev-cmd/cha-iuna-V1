import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDocFromServer
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase-config.js";

const LOGIN_URL = "./login.html";
const ALLOWED_ROLES = new Set(["owner", "admin", "editor"]);

function redirectToLogin(reason = "") {
  const target = new URL(LOGIN_URL, window.location.href);

  if (reason) {
    target.searchParams.set("reason", reason);
  }

  window.location.replace(target.href);
}

function showFatalMessage(message) {
  let box = document.querySelector("#adminAuthMessage");

  if (!box) {
    box = document.createElement("div");
    box.id = "adminAuthMessage";
    box.className = "admin-auth-message";
    document.body.appendChild(box);
  }

  box.innerHTML = `
    <strong>Não foi possível abrir o painel.</strong>
    <span>${message}</span>
  `;
}

async function validateAdministrator(user) {
  const adminReference = doc(db, "admins", user.uid);
  const snapshot = await getDocFromServer(adminReference);

  if (!snapshot.exists()) {
    throw new Error(
      `Não existe o documento admins/${user.uid} no Firestore.`
    );
  }

  const admin = snapshot.data();
  const role = String(admin.role || "").toLowerCase();

  if (admin.active !== true) {
    throw new Error("O cadastro do administrador está inativo.");
  }

  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(
      "O administrador precisa ter role owner, admin ou editor."
    );
  }

  return {
    uid: user.uid,
    email: user.email || "",
    ...admin,
    role
  };
}

window.chaIunaAdminReady = new Promise((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(
    auth,
    async user => {
      unsubscribe();

      if (!user) {
        redirectToLogin("sessao");
        reject(new Error("Usuário não autenticado."));
        return;
      }

      try {
        const admin = await validateAdministrator(user);

        window.chaIunaAdmin = admin;

        window.dispatchEvent(
          new CustomEvent("cha-iuna:admin-ready", {
            detail: {
              user,
              admin
            }
          })
        );

        resolve({
          user,
          admin
        });

        console.log("[ADMIN AUTH] Acesso autorizado:", {
          uid: user.uid,
          email: user.email,
          role: admin.role
        });
      } catch (error) {
        console.error("[ADMIN AUTH] Falha na validação:", error);

        showFatalMessage(
          error?.message ||
          "Verifique sua conexão e as permissões do Firestore."
        );

        reject(error);
      }
    },
    error => {
      console.error("[ADMIN AUTH] Erro de autenticação:", error);
      showFatalMessage("O Firebase Authentication não respondeu.");
      reject(error);
    }
  );
});

document.querySelector("#logoutButton")?.addEventListener(
  "click",
  async () => {
    try {
      await signOut(auth);
    } finally {
      redirectToLogin("logout");
    }
  }
);
