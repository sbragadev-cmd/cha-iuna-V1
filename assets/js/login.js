import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase-config.js";

const form = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const feedback = document.querySelector("#loginFeedback");
const togglePassword = document.querySelector("#togglePassword");
const forgotPassword = document.querySelector("#forgotPassword");
const rememberInput = document.querySelector("#remember");
const submitButton = form?.querySelector('button[type="submit"]');

let checkingSession = true;

function showFeedback(message, type = "error") {
  if (!feedback) return;

  feedback.textContent = message;
  feedback.dataset.type = type;

  feedback.style.color =
    type === "success"
      ? "#51765c"
      : type === "info"
        ? "#76549b"
        : "#b33a3a";
}

function setLoading(loading) {
  if (!submitButton) return;

  submitButton.disabled = loading;

  const label = submitButton.querySelector("span");

  if (label) {
    label.textContent = loading
      ? "Verificando acesso..."
      : "Entrar no painel";
  }
}

async function getAdminProfile(uid) {
  const adminReference = doc(db, "admins", uid);
  const adminSnapshot = await getDoc(adminReference);

  if (!adminSnapshot.exists()) {
    return null;
  }

  return {
    id: adminSnapshot.id,
    ...adminSnapshot.data()
  };
}

async function validateAdmin(user) {
  const admin = await getAdminProfile(user.uid);

  if (!admin) {
    throw new Error("auth/not-admin");
  }

  if (admin.active !== true) {
    throw new Error("auth/admin-disabled");
  }

  const allowedRoles = ["owner", "admin", "editor"];

  if (!allowedRoles.includes(admin.role)) {
    throw new Error("auth/invalid-role");
  }

  return admin;
}

function getFriendlyError(error) {
  const code = error?.code || error?.message || "";

  const errors = {
    "auth/invalid-credential":
      "E-mail ou senha incorretos.",

    "auth/user-not-found":
      "Nenhum usuário foi encontrado com este e-mail.",

    "auth/wrong-password":
      "E-mail ou senha incorretos.",

    "auth/invalid-email":
      "Digite um endereço de e-mail válido.",

    "auth/user-disabled":
      "Este usuário foi desativado.",

    "auth/too-many-requests":
      "Muitas tentativas foram realizadas. Tente novamente mais tarde.",

    "auth/network-request-failed":
      "Não foi possível conectar ao Firebase. Verifique sua internet.",

    "auth/missing-password":
      "Digite sua senha.",

    "auth/not-admin":
      "Este usuário não possui autorização administrativa.",

    "auth/admin-disabled":
      "O acesso deste administrador está desativado.",

    "auth/invalid-role":
      "O usuário não possui uma função administrativa válida."
  };

  return errors[code] || "Não foi possível realizar o acesso.";
}

togglePassword?.addEventListener("click", () => {
  const showPassword = passwordInput.type === "password";

  passwordInput.type = showPassword
    ? "text"
    : "password";

  togglePassword.textContent = showPassword
    ? "Ocultar"
    : "Mostrar";

  togglePassword.setAttribute(
    "aria-label",
    showPassword
      ? "Ocultar senha"
      : "Mostrar senha"
  );
});

forgotPassword?.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    showFeedback(
      "Digite seu e-mail para receber o link de redefinição."
    );

    emailInput.focus();
    return;
  }

  try {
    forgotPassword.disabled = true;

    await sendPasswordResetEmail(auth, email);

    showFeedback(
      "Enviamos um link para redefinir sua senha.",
      "success"
    );
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    showFeedback(getFriendlyError(error));
  } finally {
    forgotPassword.disabled = false;
  }
});

form?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    showFeedback("Preencha o e-mail e a senha.");
    return;
  }

  try {
    setLoading(true);
    showFeedback("Verificando suas credenciais...", "info");

    const persistence = rememberInput.checked
      ? browserLocalPersistence
      : browserSessionPersistence;

    await setPersistence(auth, persistence);

    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    await validateAdmin(credential.user);

    showFeedback(
      "Acesso autorizado. Abrindo o painel...",
      "success"
    );

    window.location.replace("./admin.html");
  } catch (error) {
    console.error("Erro no login:", error);

    if (auth.currentUser) {
      await signOut(auth);
    }

    showFeedback(getFriendlyError(error));
    setLoading(false);
  }
});

onAuthStateChanged(auth, async user => {
  if (!checkingSession) return;

  checkingSession = false;

  if (!user) {
    return;
  }

  try {
    await validateAdmin(user);
    window.location.replace("./admin.html");
  } catch (error) {
    console.error("Sessão sem autorização:", error);
    await signOut(auth);
  }
});