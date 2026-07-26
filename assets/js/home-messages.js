import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  db
} from "./firebase-config.js";

const form = document.querySelector("#messageForm");
const feedback = document.querySelector("#messageFeedback");
const messageWall = document.querySelector("#messageWall");
const submitButton = form?.querySelector('button[type="submit"]');

const relationshipLabels = {
  familia: "Família",
  amigos: "Amigos",
  capoeira: "Capoeira",
  trabalho: "Trabalho",
  outro: "Pessoa querida"
};

function setFeedback(message, type = "") {
  if (!feedback) return;

  feedback.textContent = message;
  feedback.className = `form-feedback ${type}`.trim();
}

function escapeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createMessageCard(data) {
  const article = document.createElement("article");
  article.className = "message-card";

  const name = escapeText(data.name || "Pessoa querida");
  const city = escapeText(data.city || "");
  const relationship = escapeText(
    relationshipLabels[data.relationship] ||
    data.relationship ||
    "Pessoa querida"
  );
  const message = escapeText(data.message || "");

  article.innerHTML = `
    <span class="message-quote" aria-hidden="true">“</span>
    <p>${message}</p>
    <footer>
      <strong>${name}</strong>
      <small>${relationship}${city ? ` — ${city}` : ""}</small>
    </footer>
  `;

  return article;
}

async function loadPublishedMessages() {
  if (!messageWall) return;

  try {
    const messagesQuery = query(
      collection(db, "messages"),
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
      limit(6)
    );

    const snapshot = await getDocs(messagesQuery);

    if (snapshot.empty) {
      return;
    }

    messageWall.innerHTML = "";

    snapshot.forEach(documentSnapshot => {
      messageWall.appendChild(
        createMessageCard(documentSnapshot.data())
      );
    });
  } catch (error) {
    console.warn(
      "[RECADINHOS] Não foi possível carregar o mural. " +
      "Verifique o índice do Firestore se necessário.",
      error
    );
  }
}

form?.addEventListener("submit", async event => {
  event.preventDefault();
  setFeedback("");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const name = document.querySelector("#messageName")?.value.trim();
  const city = document.querySelector("#messageCity")?.value.trim();
  const relationship = document.querySelector("#messageRelationship")?.value;
  const eventName = document.querySelector("#messageEvent")?.value;
  const message = document.querySelector("#messageText")?.value.trim();
  const consent = document.querySelector("#messageConsent")?.checked;

  if (!consent) {
    setFeedback(
      "Precisamos da sua autorização para guardar e publicar o recadinho.",
      "error"
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";
  setFeedback("Guardando seu carinho...");

  try {
    await addDoc(
      collection(db, "messages"),
      {
        name,
        city,
        relationship,
        event: eventName,
        message,
        status: "pending",
        consent: true,
        createdAt: serverTimestamp(),
        source: "home"
      }
    );

    form.reset();

    setFeedback(
      "Recadinho enviado com carinho! Ele aparecerá no mural após a aprovação dos pais.",
      "success"
    );
  } catch (error) {
    console.error(
      "[RECADINHOS] Erro ao enviar:",
      error
    );

    setFeedback(
      "Não foi possível enviar agora. Verifique as regras do Firestore e tente novamente.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar recadinho";
  }
});

loadPublishedMessages();
