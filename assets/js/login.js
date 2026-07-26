import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  auth
} from "./firebase-config.js";

const loginForm = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const rememberInput = document.querySelector("#remember");
const feedback = document.querySelector("#loginFeedback");
const togglePassword = document.querySelector("#togglePassword");
const forgotPasswordButton = document.querySelector("#forgotPassword");
const submitButton = loginForm?.querySelector('button[type="submit"]');

let authChecked = false;

/* =====================================================
   MENSAGENS
===================================================== */

function showFeedback(message, type = "error") {
  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.dataset.type = type;

  const colors = {
    error: "#b83f4b",
    success: "#34785c",
    info: "#76549b"
  };

  feedback.style.color =
    colors[type] || colors.error;
}

function clearFeedback() {
  if (!feedback) {
    return;
  }

  feedback.textContent = "";
  feedback.removeAttribute("data-type");
}

/* =====================================================
   CARREGAMENTO
===================================================== */

function setLoading(loading) {
  if (submitButton) {
    submitButton.disabled = loading;

    const buttonText =
      submitButton.querySelector("span");

    if (buttonText) {
      buttonText.textContent = loading
        ? "Entrando..."
        : "Entrar no painel";
    }
  }

  if (emailInput) {
    emailInput.disabled = loading;
  }

  if (passwordInput) {
    passwordInput.disabled = loading;
  }

  if (rememberInput) {
    rememberInput.disabled = loading;
  }
}

/* =====================================================
   ERROS AMIGÁVEIS
===================================================== */

function getFriendlyError(error) {
  const code =
    error?.code ||
    error?.message ||
    "";

  const errors = {
    "auth/invalid-credential":
      "E-mail ou senha incorretos.",

    "auth/user-not-found":
      "Usuário não encontrado.",

    "auth/wrong-password":
      "E-mail ou senha incorretos.",

    "auth/invalid-email":
      "Digite um endereço de e-mail válido.",

    "auth/missing-email":
      "Digite seu e-mail.",

    "auth/missing-password":
      "Digite sua senha.",

    "auth/user-disabled":
      "Este usuário está desativado.",

    "auth/too-many-requests":
      "Muitas tentativas foram realizadas. Aguarde alguns minutos.",

    "auth/network-request-failed":
      "Não foi possível conectar ao Firebase. Verifique sua internet.",

    "auth/operation-not-allowed":
      "O acesso por e-mail e senha ainda não está ativado no Firebase.",

    "auth/unauthorized-domain":
      "Este domínio ainda não foi autorizado no Firebase."
  };

  return (
    errors[code] ||
    "Não foi possível entrar. Verifique os dados e tente novamente."
  );
}

/* =====================================================
   MOSTRAR SENHA
===================================================== */

togglePassword?.addEventListener(
  "click",
  () => {
    const isPassword =
      passwordInput.type === "password";

    passwordInput.type =
      isPassword
        ? "text"
        : "password";

    togglePassword.textContent =
      isPassword
        ? "Ocultar"
        : "Mostrar";

    togglePassword.setAttribute(
      "aria-label",
      isPassword
        ? "Ocultar senha"
        : "Mostrar senha"
    );
  }
);

/* =====================================================
   RECUPERAR SENHA
===================================================== */

forgotPasswordButton?.addEventListener(
  "click",
  async () => {
    clearFeedback();

    const email =
      emailInput.value
        .trim()
        .toLowerCase();

    if (!email) {
      showFeedback(
        "Digite seu e-mail antes de solicitar a recuperação."
      );

      emailInput.focus();
      return;
    }

    try {
      forgotPasswordButton.disabled = true;

      showFeedback(
        "Enviando link de recuperação...",
        "info"
      );

      await sendPasswordResetEmail(
        auth,
        email
      );

      showFeedback(
        "O link de recuperação foi enviado para seu e-mail.",
        "success"
      );
    } catch (error) {
      console.error(
        "[LOGIN] Erro ao recuperar senha:",
        error
      );

      showFeedback(
        getFriendlyError(error),
        "error"
      );
    } finally {
      forgotPasswordButton.disabled = false;
    }
  }
);

/* =====================================================
   LOGIN
===================================================== */

loginForm?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    clearFeedback();

    const email =
      emailInput.value
        .trim()
        .toLowerCase();

    const password =
      passwordInput.value;

    if (!email || !password) {
      showFeedback(
        "Preencha o e-mail e a senha."
      );

      return;
    }

    if (!emailInput.validity.valid) {
      showFeedback(
        "Digite um e-mail válido."
      );

      emailInput.focus();
      return;
    }

    if (password.length < 6) {
      showFeedback(
        "A senha deve ter pelo menos 6 caracteres."
      );

      passwordInput.focus();
      return;
    }

    try {
      setLoading(true);

      showFeedback(
        "Verificando suas credenciais...",
        "info"
      );

      const persistence =
        rememberInput?.checked
          ? browserLocalPersistence
          : browserSessionPersistence;

      await setPersistence(
        auth,
        persistence
      );

      const credential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      console.log(
        "[LOGIN] Usuário autenticado:",
        credential.user.uid
      );

      showFeedback(
        "Login realizado. Abrindo o painel...",
        "success"
      );

      window.location.href =
        "./admin.html";
    } catch (error) {
      console.error(
        "[LOGIN] Erro no login:",
        error
      );

      showFeedback(
        getFriendlyError(error),
        "error"
      );

      setLoading(false);
    }
  }
);

/* =====================================================
   SESSÃO EXISTENTE
===================================================== */

onAuthStateChanged(
  auth,
  user => {
    if (authChecked) {
      return;
    }

    authChecked = true;

    console.log(
      "[LOGIN] Estado da autenticação:",
      user?.uid || "sem usuário"
    );

    if (user) {
      window.location.href =
        "./admin.html";
    }
  }
);