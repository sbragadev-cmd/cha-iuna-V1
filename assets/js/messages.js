import { db } from "./firebase-config.js";

import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const form = document.querySelector("#messageForm");
const nameInput = document.querySelector("#name");
const relationshipInput = document.querySelector("#relationship");
const messageInput = document.querySelector("#message");
const consentInput = document.querySelector("#consent");
const counter = document.querySelector("#messageCounter");
const feedback = document.querySelector("#formFeedback");
const successDialog = document.querySelector("#successDialog");
const writeAnotherButton = document.querySelector("#writeAnother");
const messagesGrid = document.querySelector("#messagesGrid");
const emptyState = document.querySelector("#emptyState");
const wallCount = document.querySelector("#wallCount");
const menuToggle = document.querySelector("#menuToggle");
const headerNav = document.querySelector(".header-nav");

let unsubscribe = null;

function normalizeText(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setError(fieldId, message = "") {
  const field = document.querySelector(`#${fieldId}`);
  const error = document.querySelector(`#${fieldId}Error`);

  if (field) {
    field.setAttribute("aria-invalid", message ? "true" : "false");
  }

  if (error) {
    error.textContent = message;
  }
}

function clearErrors() {
  ["name", "message", "consent"].forEach((field) => setError(field, ""));
  feedback.textContent = "";
  feedback.className = "form-feedback";
}

function validateForm() {
  clearErrors();

  const name = normalizeText(nameInput.value);
  const message = normalizeText(messageInput.value);

  let valid = true;

  if (name.length < 2) {
    setError("name", "Informe seu nome.");
    valid = false;
  }

  if (message.length < 3) {
    setError("message", "Escreva um recadinho com pelo menos 3 caracteres.");
    valid = false;
  }

  if (!consentInput.checked) {
    setError("consent", "É necessário autorizar a revisão e publicação.");
    valid = false;
  }

  return valid;
}

function setSubmitting(submitting) {
  const button = form.querySelector('button[type="submit"]');
  const text = button.querySelector(".button-text");
  const loading = button.querySelector(".button-loading");

  button.disabled = submitting;
  text.hidden = submitting;
  loading.hidden = !submitting;
}

async function submitMessage(event) {
  event.preventDefault();

  if (!validateForm()) {
    feedback.textContent = "Revise os campos destacados.";
    feedback.classList.add("is-error");
    return;
  }

  setSubmitting(true);

  try {
    await addDoc(collection(db, "messages"), {
      name: normalizeText(nameInput.value),
      relationship: relationshipInput.value || "",
      message: normalizeText(messageInput.value),
      active: true,
      approved: false,
      source: "public-site",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    form.reset();
    updateCounter();

    successDialog.showModal();
    document.body.classList.add("modal-open");
  } catch (error) {
    console.error("[MESSAGES] Erro ao enviar recadinho:", error);

    feedback.textContent =
      "Não foi possível enviar o recadinho agora. Tente novamente em instantes.";
    feedback.classList.add("is-error");
  } finally {
    setSubmitting(false);
  }
}

function updateCounter() {
  counter.textContent = `${messageInput.value.length}/1000`;
}

function renderMessages(items) {
  wallCount.textContent =
    `${items.length} ${items.length === 1 ? "recadinho" : "recadinhos"}`;

  if (!items.length) {
    messagesGrid.hidden = true;
    emptyState.hidden = false;
    messagesGrid.innerHTML = "";
    return;
  }

  messagesGrid.hidden = false;
  emptyState.hidden = true;

  messagesGrid.innerHTML = items
    .map(({ data }) => `
      <article class="message-card">
        <p>${escapeHtml(data.message ?? "")}</p>

        <div class="message-author">
          <strong>${escapeHtml(data.name ?? "Convidado")}</strong>
          ${
            data.relationship
              ? `<small>${escapeHtml(data.relationship)}</small>`
              : ""
          }
        </div>
      </article>
    `)
    .join("");
}

function startMessagesListener() {
  const messagesQuery = query(
    collection(db, "messages"),
    where("active", "==", true),
    where("approved", "==", true),
    orderBy("createdAt", "desc")
  );

  unsubscribe = onSnapshot(
    messagesQuery,
    (snapshot) => {
      const items = snapshot.docs.map((document) => ({
        id: document.id,
        data: document.data()
      }));

      renderMessages(items);
    },
    (error) => {
      console.error("[MESSAGES] Erro ao carregar mural:", error);

      messagesGrid.hidden = true;
      emptyState.hidden = false;
      emptyState.querySelector("h3").textContent =
        "Não foi possível carregar os recadinhos agora.";
      emptyState.querySelector("p").textContent =
        "Atualize a página em alguns instantes.";
    }
  );
}

function toggleMenu() {
  const willOpen = !headerNav.classList.contains("open");

  headerNav.classList.toggle("open", willOpen);
  menuToggle.setAttribute("aria-expanded", String(willOpen));
}

messageInput?.addEventListener("input", updateCounter);
form?.addEventListener("submit", submitMessage);
menuToggle?.addEventListener("click", toggleMenu);

headerNav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    headerNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});

writeAnotherButton?.addEventListener("click", () => {
  successDialog.close();
  document.body.classList.remove("modal-open");
  nameInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

successDialog?.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
});

window.addEventListener("beforeunload", () => {
  if (typeof unsubscribe === "function") {
    unsubscribe();
  }
});

updateCounter();
startMessagesListener();
