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

let initialSessionChecked = false;

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
    error: "#b33a3a",
    success: "#51765c",
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
   ESTADO DO BOTÃO
===================================================== */

function setLoading(loading) {
  if (!submitButton) {
    return;
  }

  submitButton.disabled = loading;

  const label = submitButton.querySelector("span");

  if (label) {
    label.textContent = loading
      ? "Verificando acesso..."
      : "Entrar no painel";
  }

  emailInput.disabled = loading;
  passwordInput.disabled = loading;

  if (rememberInput) {
    rememberInput.disabled = loading;
  }
}

/* =====================================================
   VALIDAÇÃO DO ADMINISTRADOR
===================================================== */

async function getAdminProfile(uid) {
  const adminReference = doc(
    db,
    "admins",
    uid
  );

  const adminSnapshot = await getDoc(
    adminReference
  );

  if (!adminSnapshot.exists()) {
    return null;
  }

  return {
    id: adminSnapshot.id,
    ...adminSnapshot.data()
  };
}

async function validateAdmin(user) {
  const admin = await getAdminProfile(
    user.uid
  );

  if (!admin) {
    throw new Error("auth/not-admin");
  }

  if (admin.active !== true) {
    throw new Error(
      "auth/admin-disabled"
    );
  }

  const allowedRoles = [
    "owner",
    "admin",
    "editor"
  ];

  if (!allowedRoles.includes(admin.role)) {
    throw new Error(
      "auth/invalid-role"
    );
  }

  return admin;
}

/* =====================================================
   TRATAMENTO DE ERROS
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
      "Nenhum usuário foi encontrado com este e-mail.",

    "auth/wrong-password":
      "E-mail ou senha incorretos.",

    "auth/invalid-email":
      "Digite um endereço de e-mail válido.",

    "auth/user-disabled":
      "Este usuário foi desativado.",

    "auth/too-many-requests":
      "Muitas tentativas foram realizadas. Aguarde alguns minutos e tente novamente.",

    "auth/network-request-failed":
      "Não foi possível conectar ao Firebase. Verifique sua conexão com a internet.",

    "auth/missing-password":
      "Digite sua senha.",

    "auth/missing-email":
      "Digite seu e-mail.",

    "auth/not-admin":
      "Este usuário não possui autorização administrativa.",

    "auth/admin-disabled":
      "O acesso deste administrador está desativado.",

    "auth/invalid-role":
      "O usuário não possui uma função administrativa válida.",

    "permission-denied":
      "O Firebase recusou a consulta do administrador. Verifique as regras do Firestore.",

    "auth/operation-not-allowed":
      "O login por e-mail e senha ainda não está ativado no Firebase."
  };

  return (
    errors[code] ||
    "Não foi possível realizar o acesso. Tente novamente."
  );
}

/* =====================================================
   EXIBIR OU OCULTAR SENHA
===================================================== */

togglePassword?.addEventListener(
  "click",
  () => {
    const passwordVisible =
      passwordInput.type === "text";

    passwordInput.type =
      passwordVisible
        ? "password"
        : "text";

    togglePassword.textContent =
      passwordVisible
        ? "Mostrar"
        : "Ocultar";

    togglePassword.setAttribute(
      "aria-label",
      passwordVisible
        ? "Mostrar senha"
        : "Ocultar senha"
    );
  }
);

/* =====================================================
   RECUPERAÇÃO DE SENHA
===================================================== */

forgotPassword?.addEventListener(
  "click",
  async () => {
    clearFeedback();

    const email =
      emailInput.value
        .trim()
        .toLowerCase();

    if (!email) {
      showFeedback(
        "Digite seu e-mail para receber o link de redefinição."
      );

      emailInput.focus();
      return;
    }

    try {
      forgotPassword.disabled = true;

      showFeedback(
        "Enviando o link de redefinição...",
        "info"
      );

      await sendPasswordResetEmail(
        auth,
        email
      );

      showFeedback(
        "Enviamos um link de redefinição para o e-mail informado.",
        "success"
      );
    } catch (error) {
      console.error(
        "Erro ao redefinir senha:",
        error
      );

      showFeedback(
        getFriendlyError(error)
      );
    } finally {
      forgotPassword.disabled = false;
    }
  }
);

/* =====================================================
   LOGIN
===================================================== */

form?.addEventListener(
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
        "Digite um endereço de e-mail válido."
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

      await validateAdmin(
        credential.user
      );

      showFeedback(
        "Acesso autorizado. Abrindo o painel...",
        "success"
      );

      window.location.replace(
        "./admin.html"
      );
    } catch (error) {
      console.error(
        "Erro no login:",
        error
      );

      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Erro ao encerrar sessão inválida:",
            signOutError
          );
        }
      }

      showFeedback(
        getFriendlyError(error)
      );

      setLoading(false);
    }
  }
);

/* =====================================================
   VERIFICAÇÃO DE SESSÃO EXISTENTE
===================================================== */

onAuthStateChanged(
  auth,
  async user => {
    if (initialSessionChecked) {
      return;
    }

    initialSessionChecked = true;

    if (!user) {
      return;
    }

    try {
      showFeedback(
        "Verificando sessão existente...",
        "info"
      );

      await validateAdmin(user);

      window.location.replace(
        "./admin.html"
      );
    } catch (error) {
      console.error(
        "Sessão existente sem autorização:",
        error
      );

      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error(
          "Erro ao encerrar sessão:",
          signOutError
        );
      }

      clearFeedback();
    }
  }
);