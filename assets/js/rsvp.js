import { db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const EVENTS = {
  bage: {
    id: "bage",
    label: "Bagé",
    date: "05/09/2026",
    time: "15h",
    location: "Sítio Mãe Velha",
    city: "Bagé/RS"
  },
  "porto-alegre": {
    id: "porto-alegre",
    label: "Porto Alegre",
    date: "03/10/2026",
    time: "15h",
    location: "Rua Martins de Lima, 25 — Partenon",
    city: "Porto Alegre/RS"
  }
};

const form = document.querySelector("#rsvpForm");
const consultForm = document.querySelector("#consultForm");
const guestDetails = document.querySelector("#guestDetails");
const phoneInput = document.querySelector("#phone");
const protocolInput = document.querySelector("#protocol");
const successSection = document.querySelector("#successSection");
const generatedProtocol = document.querySelector("#generatedProtocol");
const successTitle = document.querySelector("#successTitle");
const successMessage = document.querySelector("#successMessage");
const formFeedback = document.querySelector("#formFeedback");
const consultFeedback = document.querySelector("#consultFeedback");
const consultResult = document.querySelector("#consultResult");
const copyProtocolButton = document.querySelector("#copyProtocol");
const copyFeedback = document.querySelector("#copyFeedback");

function normalizeText(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function createProtocol() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomValues = new Uint32Array(8);
  crypto.getRandomValues(randomValues);

  const suffix = [...randomValues]
    .map((value) => alphabet[value % alphabet.length])
    .join("");

  return `IUNA-${suffix}`;
}

function normalizeProtocol(value = "") {
  const cleaned = String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/^IUNA?/, "IUNA");

  if (cleaned.startsWith("IUNA-")) {
    return cleaned.slice(0, 13);
  }

  if (cleaned.startsWith("IUNA")) {
    return `IUNA-${cleaned.slice(4)}`.slice(0, 13);
  }

  return cleaned.slice(0, 13);
}

function getCheckedValue(name) {
  return form?.querySelector(`input[name="${name}"]:checked`)?.value ?? "";
}

function setError(fieldId, message = "") {
  const errorElement = document.querySelector(`#${fieldId}Error`);
  const input = document.querySelector(`#${fieldId}`);

  if (errorElement) errorElement.textContent = message;
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function clearErrors() {
  ["event", "guestName", "phone", "attendance", "consent"].forEach((field) => {
    setError(field, "");
  });

  formFeedback.textContent = "";
  formFeedback.className = "form-feedback";
}

function validateForm() {
  clearErrors();

  const eventId = getCheckedValue("eventId");
  const attendanceStatus = getCheckedValue("attendanceStatus");
  const guestName = normalizeText(form.guestName.value);
  const phoneDigits = onlyDigits(form.phone.value);
  const consent = form.consent.checked;

  let valid = true;

  if (!EVENTS[eventId]) {
    setError("event", "Escolha o evento que deseja confirmar.");
    valid = false;
  }

  if (guestName.length < 3) {
    setError("guestName", "Informe seu nome completo.");
    valid = false;
  }

  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    setError("phone", "Informe um telefone válido com DDD.");
    valid = false;
  }

  if (!["confirmed", "declined"].includes(attendanceStatus)) {
    setError("attendance", "Informe se poderá comparecer.");
    valid = false;
  }

  if (!consent) {
    setError("consent", "É necessário autorizar o uso dos dados.");
    valid = false;
  }

  if (attendanceStatus === "confirmed") {
    const adults = Number(form.adults.value);
    const children = Number(form.children.value);

    if (!Number.isInteger(adults) || adults < 1 || adults > 10) {
      formFeedback.textContent = "Informe uma quantidade válida de adultos.";
      formFeedback.classList.add("is-error");
      valid = false;
    }

    if (!Number.isInteger(children) || children < 0 || children > 10) {
      formFeedback.textContent = "Informe uma quantidade válida de crianças.";
      formFeedback.classList.add("is-error");
      valid = false;
    }
  }

  return valid;
}

function toggleGuestDetails() {
  const status = getCheckedValue("attendanceStatus");
  const declined = status === "declined";

  guestDetails.classList.toggle("is-hidden", declined);
  form.adults.disabled = declined;
  form.children.disabled = declined;
  form.companions.disabled = declined;
  form.notes.disabled = declined;
}

function setSubmitting(submitting) {
  const button = form.querySelector('button[type="submit"]');
  const text = button.querySelector(".button-text");
  const loading = button.querySelector(".button-loading");

  button.disabled = submitting;
  text.hidden = submitting;
  loading.hidden = !submitting;
}

async function getUniqueProtocol() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const protocol = createProtocol();
    const snapshot = await getDoc(doc(db, "rsvps", protocol));

    if (!snapshot.exists()) return protocol;
  }

  throw new Error("Não foi possível gerar um protocolo único.");
}

async function saveRsvp(event) {
  event.preventDefault();

  if (!validateForm()) {
    formFeedback.textContent = "Revise os campos destacados antes de continuar.";
    formFeedback.classList.add("is-error");
    return;
  }

  setSubmitting(true);

  try {
    const eventId = getCheckedValue("eventId");
    const attendanceStatus = getCheckedValue("attendanceStatus");
    const protocol = await getUniqueProtocol();
    const confirmed = attendanceStatus === "confirmed";

    const data = {
      protocol,
      eventId,
      eventLabel: EVENTS[eventId].label,
      eventDate: EVENTS[eventId].date,
      eventTime: EVENTS[eventId].time,
      eventLocation: EVENTS[eventId].location,
      guestName: normalizeText(form.guestName.value),
      guestNameNormalized: normalizeText(form.guestName.value).toLowerCase(),
      phone: formatPhone(form.phone.value),
      phoneDigits: onlyDigits(form.phone.value),
      relationship: form.relationship.value || "",
      attendanceStatus,
      adults: confirmed ? Number(form.adults.value) : 0,
      children: confirmed ? Number(form.children.value) : 0,
      companions: confirmed ? normalizeText(form.companions.value) : "",
      notes: confirmed ? normalizeText(form.notes.value) : "",
      totalGuests: confirmed
        ? Number(form.adults.value) + Number(form.children.value)
        : 0,
      consent: true,
      source: "public-site",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "rsvps", protocol), data);

    generatedProtocol.textContent = protocol;
    successTitle.textContent = confirmed
      ? "Presença confirmada com carinho!"
      : "Recebemos sua resposta.";

    successMessage.textContent = confirmed
      ? `Esperamos você em ${EVENTS[eventId].label}. Guarde seu protocolo para consultar a confirmação.`
      : "Sentiremos sua falta, mas agradecemos por nos avisar e por todo o carinho com a Iúna.";

    successSection.hidden = false;
    form.reset();
    toggleGuestDetails();
    applyEventFromUrl();

    successSection.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  } catch (error) {
    console.error("[RSVP] Erro ao salvar confirmação:", error);

    formFeedback.textContent =
      "Não foi possível registrar sua confirmação agora. Tente novamente em instantes.";
    formFeedback.classList.add("is-error");
  } finally {
    setSubmitting(false);
  }
}

function renderConsultResult(data) {
  const event = EVENTS[data.eventId];
  const confirmed = data.attendanceStatus === "confirmed";
  const nameFirstPart = normalizeText(data.guestName).split(" ")[0] || "Convidado";

  consultResult.innerHTML = `
    <h3>${confirmed ? "Presença confirmada" : "Ausência informada"}</h3>
    <dl>
      <div>
        <dt>Convidado</dt>
        <dd>${escapeHtml(nameFirstPart)}</dd>
      </div>
      <div>
        <dt>Evento</dt>
        <dd>${escapeHtml(event?.label ?? data.eventLabel ?? "Não informado")}</dd>
      </div>
      <div>
        <dt>Data e horário</dt>
        <dd>${escapeHtml(event?.date ?? data.eventDate ?? "")} • ${escapeHtml(event?.time ?? data.eventTime ?? "")}</dd>
      </div>
      <div>
        <dt>Situação</dt>
        <dd>${confirmed ? "Confirmado" : "Não comparecerá"}</dd>
      </div>
      ${
        confirmed
          ? `
            <div>
              <dt>Adultos</dt>
              <dd>${Number(data.adults ?? 0)}</dd>
            </div>
            <div>
              <dt>Crianças</dt>
              <dd>${Number(data.children ?? 0)}</dd>
            </div>
          `
          : ""
      }
    </dl>
  `;

  consultResult.hidden = false;
}

async function consultRsvp(event) {
  event.preventDefault();

  consultFeedback.textContent = "";
  consultFeedback.className = "form-feedback";
  consultResult.hidden = true;

  const protocol = normalizeProtocol(protocolInput.value);
  protocolInput.value = protocol;

  if (!/^IUNA-[A-Z0-9]{8}$/.test(protocol)) {
    consultFeedback.textContent = "Informe um protocolo válido.";
    consultFeedback.classList.add("is-error");
    return;
  }

  try {
    const snapshot = await getDoc(doc(db, "rsvps", protocol));

    if (!snapshot.exists()) {
      consultFeedback.textContent = "Protocolo não encontrado.";
      consultFeedback.classList.add("is-error");
      return;
    }

    renderConsultResult(snapshot.data());
    consultFeedback.textContent = "Confirmação encontrada.";
    consultFeedback.classList.add("is-success");
  } catch (error) {
    console.error("[RSVP] Erro ao consultar protocolo:", error);

    consultFeedback.textContent =
      "Não foi possível consultar agora. Tente novamente em instantes.";
    consultFeedback.classList.add("is-error");
  }
}

function applyEventFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("evento");

  if (!EVENTS[eventId]) return;

  const input = form.querySelector(
    `input[name="eventId"][value="${eventId}"]`
  );

  if (input) input.checked = true;
}

async function copyProtocol() {
  const protocol = generatedProtocol.textContent.trim();
  if (!protocol) return;

  try {
    await navigator.clipboard.writeText(protocol);
    copyFeedback.textContent = "Protocolo copiado.";
  } catch {
    copyFeedback.textContent =
      "Selecione e copie o protocolo exibido acima.";
  }
}

phoneInput?.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
});

protocolInput?.addEventListener("input", () => {
  protocolInput.value = normalizeProtocol(protocolInput.value);
});

form
  ?.querySelectorAll('input[name="attendanceStatus"]')
  .forEach((input) => input.addEventListener("change", toggleGuestDetails));

form?.addEventListener("submit", saveRsvp);
consultForm?.addEventListener("submit", consultRsvp);
copyProtocolButton?.addEventListener("click", copyProtocol);

applyEventFromUrl();
toggleGuestDetails();
