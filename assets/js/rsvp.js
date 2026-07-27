import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { db } from "./firebase-config.js";

const $ = selector => document.querySelector(selector);

const form = $("#rsvpForm");
const feedback = $("#feedback");
const submitButton = $("#submitButton");
const attendanceDetails = $("#attendanceDetails");
const confirmationArea = $("#confirmationArea");
const successSection = $("#success");

let editingDocumentId = null;

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function formatPhone(value = "") {
  const number = onlyDigits(value).slice(0, 11);

  if (number.length <= 2) return number;
  if (number.length <= 6) return `(${number.slice(0, 2)}) ${number.slice(2)}`;
  if (number.length <= 10) {
    return `(${number.slice(0, 2)}) ${number.slice(2, 6)}-${number.slice(6)}`;
  }

  return `(${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(parsed));
}

function selectedEvent() {
  return form.querySelector('input[name="event"]:checked')?.value || "";
}

function createProtocol() {
  const code = crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase();

  return `IUNA-${code}`;
}

function setFeedback(element, message = "", type = "") {
  element.textContent = message;
  element.className = "form-feedback";

  if (type) {
    element.classList.add(`is-${type}`);
  }
}

function toggleAttendanceDetails() {
  const declined = selectedEvent() === "nao-vou";

  attendanceDetails.classList.toggle("disabled", declined);

  attendanceDetails
    .querySelectorAll("input, select, textarea")
    .forEach(field => {
      field.disabled = declined;
    });

  if (declined) {
    $("#people").value = 0;
    $("#children").value = 0;
    $("#companions").value = "";
    $("#relationship").value = "";
    $("#city").value = "";
  } else if (normalizeInteger($("#people").value, 0) < 1) {
    $("#people").value = 1;
  }
}

function validateForm() {
  const name = $("#name").value.trim();
  const phone = onlyDigits($("#phone").value);
  const event = selectedEvent();
  const people = normalizeInteger($("#people").value, 0);
  const children = normalizeInteger($("#children").value, 0);

  if (name.length < 2) {
    throw new Error("Informe seu nome completo.");
  }

  if (phone.length < 10) {
    throw new Error("Informe um WhatsApp válido.");
  }

  if (!event) {
    throw new Error("Escolha uma opção de presença.");
  }

  if (event !== "nao-vou") {
    if (people < 1 || people > 15) {
      throw new Error("Informe o total de pessoas entre 1 e 15.");
    }

    if (children > people) {
      throw new Error("O número de crianças não pode superar o total de pessoas.");
    }
  }

  if (!$("#consent").checked) {
    throw new Error("Autorize o uso dos dados para a organização.");
  }
}

function createPayload(protocol, editToken) {
  const event = selectedEvent();
  const declined = event === "nao-vou";

  return {
    protocol,
    editToken,
    name: $("#name").value.trim(),
    nameSearch: $("#name").value.trim().toLowerCase(),
    phone: formatPhone($("#phone").value),
    phoneDigits: onlyDigits($("#phone").value),
    email: $("#email").value.trim().toLowerCase(),
    event,
    status: declined ? "declined" : "confirmed",
    people: declined ? 0 : normalizeInteger($("#people").value, 1),
    children: declined ? 0 : normalizeInteger($("#children").value, 0),
    companions: declined ? "" : $("#companions").value.trim(),
    relationship: declined ? "" : $("#relationship").value,
    city: declined ? "" : $("#city").value.trim(),
    dietary: declined ? "" : $("#dietary").value.trim(),
    message: $("#message").value.trim(),
    consent: true,
    source: "site",
    updatedAt: serverTimestamp()
  };
}

async function findByProtocol(protocol) {
  const rsvpQuery = query(
    collection(db, "rsvps"),
    where("protocol", "==", protocol.toUpperCase()),
    limit(1)
  );

  const snapshot = await getDocs(rsvpQuery);

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data()
  };
}

function showSuccess(data, updated = false) {
  confirmationArea.hidden = true;
  successSection.hidden = false;

  $("#successTitle").textContent = updated
    ? "Sua resposta foi atualizada."
    : data.status === "declined"
      ? "Recebemos sua resposta com carinho."
      : "Presença confirmada com carinho!";

  $("#successText").textContent = data.status === "declined"
    ? "Sentiremos sua falta, mas agradecemos por avisar."
    : "Obrigado por fazer parte deste momento tão especial para nossa família.";

  $("#protocol").textContent = data.protocol;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  setFeedback(feedback);

  try {
    validateForm();

    submitButton.disabled = true;
    submitButton.textContent = editingDocumentId
      ? "Atualizando..."
      : "Confirmando...";

    if (editingDocumentId) {
      const current = await findByProtocol(form.dataset.protocol || "");

      if (
        !current ||
        current.id !== editingDocumentId ||
        current.editToken !== $("#editToken").value
      ) {
        throw new Error("Não foi possível validar esta edição.");
      }

      const data = createPayload(
        current.protocol,
        current.editToken
      );

      await updateDoc(
        doc(db, "rsvps", editingDocumentId),
        data
      );

      showSuccess(data, true);
      return;
    }

    const protocol = createProtocol();
    const editToken = crypto.randomUUID();
    const reference = doc(collection(db, "rsvps"));

    const data = {
      ...createPayload(protocol, editToken),
      createdAt: serverTimestamp()
    };

    await setDoc(reference, data);

    form.dataset.protocol = protocol;
    showSuccess(data);
  } catch (error) {
    console.error("[RSVP] Erro ao salvar:", error);

    const message = error?.code === "permission-denied"
      ? "O Firestore bloqueou a confirmação. Verifique as regras da coleção rsvps."
      : error?.message || "Não foi possível salvar sua resposta.";

    setFeedback(feedback, message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = editingDocumentId
      ? "Atualizar minha resposta"
      : "Confirmar minha resposta";
  }
});

$("#lookupForm").addEventListener("submit", async event => {
  event.preventDefault();

  const lookupFeedback = $("#lookupFeedback");
  const code = $("#lookupCode").value.trim().toUpperCase();

  setFeedback(lookupFeedback);

  try {
    if (!/^IUNA-[A-Z0-9]{6}$/.test(code)) {
      throw new Error("Informe um protocolo válido.");
    }

    const data = await findByProtocol(code);

    if (!data) {
      throw new Error("Confirmação não encontrada.");
    }

    editingDocumentId = data.id;
    form.dataset.protocol = data.protocol;

    $("#name").value = data.name || "";
    $("#phone").value = data.phone || "";
    $("#email").value = data.email || "";
    $("#people").value = data.people ?? 1;
    $("#children").value = data.children ?? 0;
    $("#companions").value = data.companions || "";
    $("#relationship").value = data.relationship || "";
    $("#city").value = data.city || "";
    $("#dietary").value = data.dietary || "";
    $("#message").value = data.message || "";
    $("#consent").checked = true;
    $("#editToken").value = data.editToken || "";

    const eventInput = form.querySelector(
      `input[name="event"][value="${CSS.escape(data.event || "")}"]`
    );

    if (eventInput) {
      eventInput.checked = true;
    }

    toggleAttendanceDetails();
    submitButton.textContent = "Atualizar minha resposta";

    setFeedback(
      lookupFeedback,
      "Confirmação encontrada. Você já pode atualizar os dados.",
      "success"
    );

    form.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    setFeedback(
      lookupFeedback,
      error?.message || "Não foi possível consultar.",
      "error"
    );
  }
});

$("#phone").addEventListener("input", event => {
  event.target.value = formatPhone(event.target.value);
});

form.querySelectorAll('input[name="event"]').forEach(input => {
  input.addEventListener("change", toggleAttendanceDetails);
});

$("#copyProtocol").addEventListener("click", async () => {
  const protocol = $("#protocol").textContent.trim();

  try {
    await navigator.clipboard.writeText(protocol);
    $("#copyProtocol").textContent = "Copiado!";
  } catch {
    window.prompt("Copie seu protocolo:", protocol);
  }
});

const eventFromUrl = new URLSearchParams(window.location.search).get("evento");

if (["bage", "porto-alegre", "ambos"].includes(eventFromUrl)) {
  const eventInput = form.querySelector(
    `input[name="event"][value="${eventFromUrl}"]`
  );

  if (eventInput) {
    eventInput.checked = true;
  }
}

toggleAttendanceDetails();
