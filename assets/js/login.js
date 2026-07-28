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

function normalizeRole(value = "") {
  return String(value).trim().toLowerCase();
}

function isAdminActive(value) {
  return value === true
    || value === 1
    || String(value).trim().toLowerCase() === "true"
    || String(value).trim().toLowerCase() === "ativo";
}

function setFieldError(fieldId, message = "") {
  const field = document.querySelector(`#${fieldId}`);
  const error = document.querySelector(`#${fieldId}Error`);
  if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
  if (error) error.textContent = message;
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

function translateAuthError(error) {
  const messages = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Informe um endereço de e-mail válido.",
    "auth/user-disabled": "Este usuário está desativado.",
    "auth/too-many-requests": "Muitas tentativas foram realizadas. Aguarde alguns minutos.",
    "auth/network-request-failed": "Não foi possível conectar. Verifique sua internet.",
    "auth/missing-password": "Digite sua senha."
  };
  return messages[error?.code] || "Não foi possível entrar agora. Tente novamente em instantes.";
}

async function validateAdminUser(user) {
  const snapshot = await getDoc(doc(db, "admins", user.uid));

  if (!snapshot.exists()) {
    const error = new Error("ADMIN_NOT_FOUND");
    error.details = { uid: user.uid, email: user.email, projectId: db.app.options.projectId };
    throw error;
  }

  const adminData = snapshot.data();
  const role = normalizeRole(adminData.role);
  const active = isAdminActive(adminData.active);

  console.log("[LOGIN] Verificação administrativa", {
    uid: user.uid,
    projectId: db.app.options.projectId,
    documentPath: `admins/${user.uid}`,
    activeRecebido: adminData.active,
    activeInterpretado: active,
    roleRecebida: adminData.role,
    roleInterpretada: role
  });

  if (!["owner", "admin", "editor"].includes(role)) {
    const error = new Error("ADMIN_ROLE_INVALID");
    error.details = { role: adminData.role };
    throw error;
  }

  if (!active) {
    const error = new Error("ADMIN_INACTIVE");
    error.details = { active: adminData.active };
    throw error;
  }

  return { ...adminData, role, active: true };
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
  const text = button?.querySelector(".button-text");
  const loading = button?.querySelector(".button-loading");
  if (button) button.disabled = submitting;
  if (text) text.hidden = submitting;
  if (loading) loading.hidden = !submitting;
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
    await setPersistence(auth, rememberInput.checked ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(
      auth,
      normalizeText(emailInput.value).toLowerCase(),
      passwordInput.value
    );

    feedback.textContent = "Login realizado. Verificando permissão...";
    feedback.className = "form-feedback is-success";

    await validateAdminUser(credential.user);
    window.location.replace("./admin.html");
  } catch (error) {
    console.error("[LOGIN] Erro ao autenticar:", error, error?.details ?? "");

    if (["ADMIN_NOT_FOUND", "ADMIN_INACTIVE", "ADMIN_ROLE_INVALID"].includes(error?.message)) {
      await signOut(auth).catch(() => {});
    }

    if (error?.message === "ADMIN_NOT_FOUND") {
      feedback.textContent = "O usuário foi autenticado, mas o documento admins/UID não foi encontrado.";
    } else if (error?.message === "ADMIN_INACTIVE") {
      feedback.textContent = "O cadastro administrativo foi encontrado, mas está marcado como inativo.";
    } else if (error?.message === "ADMIN_ROLE_INVALID") {
      feedback.textContent = "A função administrativa precisa ser owner, admin ou editor.";
    } else {
      feedback.textContent = translateAuthError(error);
    }

    feedback.className = "form-feedback is-error";
  } finally {
    setSubmitting(form, false);
  }
}

function togglePasswordVisibility() {
  const visible = passwordInput.type === "text";
  passwordInput.type = visible ? "password" : "text";
  passwordToggle.setAttribute("aria-pressed", String(!visible));
  passwordToggle.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
  const openText = passwordToggle.querySelector(".eye-open");
  const closedText = passwordToggle.querySelector(".eye-closed");
  if (openText) openText.hidden = !visible;
  if (closedText) closedText.hidden = visible;
}

function openResetDialog() {
  clearResetErrors();
  resetEmailInput.value = normalizeText(emailInput.value);
  resetDialog.showModal();
  document.body.classList.add("modal-open");
  setTimeout(() => resetEmailInput.focus(), 50);
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
    resetFeedback.textContent = "Enviamos o link de recuperação. Verifique também a pasta de spam.";
    resetFeedback.className = "form-feedback is-success";
  } catch (error) {
    console.error("[LOGIN] Erro ao enviar recuperação:", error);
    resetFeedback.textContent = translateAuthError(error);
    resetFeedback.className = "form-feedback is-error";
  } finally {
    setSubmitting(resetForm, false);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!checkingInitialSession) return;
  checkingInitialSession = false;
  if (!user) return;
  try {
    await validateAdminUser(user);
    window.location.replace("./admin.html");
  } catch (error) {
    console.error("[LOGIN] Sessão sem acesso:", error, error?.details ?? "");
    await signOut(auth).catch(() => {});
  }
});

form?.addEventListener("submit", handleLogin);
passwordToggle?.addEventListener("click", togglePasswordVisibility);
forgotPasswordButton?.addEventListener("click", openResetDialog);
closeResetDialog?.addEventListener("click", closeReset);
resetForm?.addEventListener("submit", handleResetPassword);
resetDialog?.addEventListener("close", () => document.body.classList.remove("modal-open"));
