const DEMO_EMAIL = "pais@chaiuna.com.br";
const DEMO_PASSWORD = "iuna2026";
const SESSION_KEY = "chaIunaParentsSession";

const form = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const feedback = document.querySelector("#loginFeedback");
const togglePassword = document.querySelector("#togglePassword");
const forgotPassword = document.querySelector("#forgotPassword");

if (sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)) {
  window.location.replace("./admin.html");
}

togglePassword?.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePassword.textContent = show ? "Ocultar" : "Mostrar";
  togglePassword.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
});

forgotPassword?.addEventListener("click", () => {
  feedback.textContent = "Na integração com Firebase, enviaremos um link de redefinição para o e-mail cadastrado.";
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  feedback.textContent = "";

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    feedback.textContent = "Preencha o e-mail e a senha.";
    return;
  }

  if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    feedback.textContent = "E-mail ou senha inválidos. Use o acesso de demonstração informado abaixo.";
    return;
  }

  const storage = document.querySelector("#remember").checked ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify({
    email,
    signedAt: new Date().toISOString()
  }));

  feedback.style.color = "#51765c";
  feedback.textContent = "Acesso autorizado. Abrindo o painel...";
  window.setTimeout(() => window.location.replace("./admin.html"), 450);
});
