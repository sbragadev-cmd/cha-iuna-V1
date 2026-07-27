import { auth, db } from "./firebase-config.js";

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

const form = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const rememberInput = document.querySelector("#rememberMe");
const passwordToggle = document.querySelector("#passwordToggle");
const feedback = document.querySelector("#loginFeedback");

const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
const resetDialog = document.querySelector("#resetDialog");
const resetForm = document.querySelector("#resetForm");
const resetEmailInput = document.querySelector("#resetEmail");
const resetFeedback = document.querySelector("#resetFeedback");
const closeResetDialog = document.querySelector("#closeResetDialog");

let checkingInitialSession = true;

function normalizeText(value = "") {
  return String(value).trim();
}

function setFieldError(fieldId, message = "") {
  const field = document.querySelector(`#${fieldId}`);
  const error = document.querySelector(`#${fieldId}Error`);

  if (field) {
    field.setAttribute("aria-invalid", message ? "true" : "false");
  }

  if (error) {
    error.textContent = message;
  }
}

function clearLoginErrors() {
  setFieldError("email", "");
  setFieldError("password", "");
  feedback.textContent = "";
  feedback.className = "form-feedback";
}

function clearResetErrors() {
  setFieldError("resetEmail", "");
  resetFeedback.textContent = "";
  resetFeedback.className = "form-feedback";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");

  if (redirect === "admin") {
    return "./admin.html";
  }

  return "./admin.html";
}

function translateAuthError(error) {
  const messages = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Informe um endereço de e-mail válido.",
    "auth/user-disabled": "Este usuário está desativado.",
    "auth/too-many-requests":
      "Muitas tentativas foram realizadas. Aguarde alguns minutos.",
    "auth/network-request-failed":
      "Não foi possível conectar. Verifique sua internet.",
    "auth/missing-password": "Digite sua senha.",
    "auth/weak-password": "A senha informada é muito curta."
  };

  return (
    messages[error?.code] ||
    "Não foi possível entrar agora. Tente novamente em instantes."
  );
}

async function validateAdminUser(user) {
  const snapshot = await getDoc(doc(db, "admins", user.uid));

  if (!snapshot.exists()) {
    throw new Error("ADMIN_NOT_FOUND");
  }

  const adminData = snapshot.data();

  if (
    adminData.active !== true ||
    !["owner", "admin", "editor"].includes(adminData.role)
  ) {
    throw new Error("ADMIN_INACTIVE");
  }

  return adminData;
}

function validateLoginForm() {
  clearLoginErrors();

  const email = normalizeText(emailInput.value).toLowerCase();
  const password = passwordInput.value;

  let valid = true;

  if (!isValidEmail(email)) {
    setFieldError("email", "Informe um e-mail válido.");
    valid = false;
  }

  if (password.length < 6) {
    setFieldError("password", "Digite uma senha com pelo menos 6 caracteres.");
    valid = false;
  }

  return valid;
}

function setSubmitting(formElement, submitting) {
  const button = formElement.querySelector('button[type="submit"]');
  const text = button.querySelector(".button-text");
  const loading = button.querySelector(".button-loading");

  button.disabled = submitting;
  text.hidden = submitting;
  loading.hidden = !submitting;
}

async function handleLogin(event) {
  event.preventDefault();

  if (!validateLoginForm()) {
    feedback.textContent = "Revise os campos destacados.";
    feedback.classList.add("is-error");
    return;
  }

  setSubmitting(form, true);

  try {
    const persistence = rememberInput.checked
      ? browserLocalPersistence
      : browserSessionPersistence;

    await setPersistence(auth, persistence);

    const credential = await signInWithEmailAndPassword(
      auth,
      normalizeText(emailInput.value).toLowerCase(),
      passwordInput.value
    );

    feedback.textContent = "Login realizado. Verificando permissão...";
    feedback.classList.add("is-success");

    await validateAdminUser(credential.user);

    window.location.replace(getRedirectTarget());
  } catch (error) {
    console.error("[LOGIN] Erro ao autenticar:", error);

    if (
      error?.message === "ADMIN_NOT_FOUND" ||
      error?.message === "ADMIN_INACTIVE"
    ) {
      await signOut(auth).catch(() => {});

      feedback.textContent =
        "Sua conta não possui permissão ativa para acessar a Área dos Pais.";
      feedback.classList.add("is-error");
    } else {
      feedback.textContent = translateAuthError(error);
      feedback.classList.add("is-error");
    }
  } finally {
    setSubmitting(form, false);
  }
}

function togglePasswordVisibility() {
  const isVisible = passwordInput.type === "text";

  passwordInput.type = isVisible ? "password" : "text";
  passwordToggle.setAttribute("aria-pressed", String(!isVisible));
  passwordToggle.setAttribute(
    "aria-label",
    isVisible ? "Mostrar senha" : "Ocultar senha"
  );

  passwordToggle.querySelector(".eye-open").hidden = !isVisible;
  passwordToggle.querySelector(".eye-closed").hidden = isVisible;
}

function openResetDialog() {
  clearResetErrors();

  const currentEmail = normalizeText(emailInput.value);
  resetEmailInput.value = currentEmail;

  resetDialog.showModal();
  document.body.classList.add("modal-open");

  window.setTimeout(() => resetEmailInput.focus(), 50);
}

function closeReset() {
  if (resetDialog.open) resetDialog.close();
  document.body.classList.remove("modal-open");
}

async function handleResetPassword(event) {
  event.preventDefault();
  clearResetErrors();

  const email = normalizeText(resetEmailInput.value).toLowerCase();

  if (!isValidEmail(email)) {
    setFieldError("resetEmail", "Informe um e-mail válido.");
    return;
  }

  setSubmitting(resetForm, true);

  try {
    await sendPasswordResetEmail(auth, email);

    resetFeedback.textContent =
      "Enviamos o link de recuperação. Verifique também a pasta de spam.";
    resetFeedback.classList.add("is-success");
  } catch (error) {
    console.error("[LOGIN] Erro ao enviar recuperação:", error);

    if (error?.code === "auth/user-not-found") {
      resetFeedback.textContent =
        "Caso o e-mail esteja cadastrado, você receberá o link de recuperação.";
      resetFeedback.classList.add("is-success");
    } else {
      resetFeedback.textContent = translateAuthError(error);
      resetFeedback.classList.add("is-error");
    }
  } finally {
    setSubmitting(resetForm, false);
  }
}

function showQueryMessage() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("erro");

  if (error === "sem-permissao") {
    feedback.textContent =
      "Sua conta não possui permissão ativa para acessar a Área dos Pais.";
    feedback.classList.add("is-error");
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!checkingInitialSession) return;
  checkingInitialSession = false;

  if (!user) {
    showQueryMessage();
    return;
  }

  try {
    await validateAdminUser(user);
    window.location.replace(getRedirectTarget());
  } catch (error) {
    console.warn("[LOGIN] Sessão sem acesso administrativo:", error);
    await signOut(auth).catch(() => {});
    showQueryMessage();
  }
});

form?.addEventListener("submit", handleLogin);
passwordToggle?.addEventListener("click", togglePasswordVisibility);
forgotPasswordButton?.addEventListener("click", openResetDialog);
closeResetDialog?.addEventListener("click", closeReset);
resetForm?.addEventListener("submit", handleResetPassword);

resetDialog?.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
});
