import { db } from "./firebase-config.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const DEFAULT_TEMPLATE = `Olá, {nome}! 💜

Com muito carinho, queremos convidar você para o Piquenique de Boas-vindas da Iúna.

📍 Evento: {evento}
📅 Data: {data}
🕒 Horário: {horario}
🌿 Local: {local}

Para confirmar sua presença, acesse:
{link}

Esperamos você para compartilhar esse momento tão especial conosco! 🧺🌸`;

const DEFAULT_REMINDER_TEMPLATE = `Olá, {nome}! 💜

Estamos fechando com muito carinho os preparativos para o Piquenique de Boas-vindas da Iúna. 🧺🌸

Para conseguirmos organizar tudo direitinho, pedimos que você confirme sua presença até o dia 31/08.

📍 {evento}
📅 {data}
🕒 {horario}
🌿 {local}

É rapidinho! Confirme por aqui:
{link}

Se você já confirmou, pode desconsiderar esta mensagem.

Estamos muito felizes em compartilhar esse momento tão especial com você!

Com carinho,
Família da Iúna 💜`;

const EVENTS = {
  bage: {
    label: "Bagé",
    date: "05/09/2026",
    time: "15h",
    location: "Sítio Mãe Velha"
  },

  "porto-alegre": {
    label: "Porto Alegre",
    date: "03/10/2026",
    time: "15h",
    location: "Rua Martins de Lima, 25 — Partenon"
  }
};

const SITE_URL = "https://cha-iuna.vercel.app";

const state = {
  guests: [],
  rsvps: [],
  currentGuest: null,
  messageMode: "invite",
  confirmAction: null,
  unsubscribeGuests: null,
  unsubscribeRsvps: null,
  syncing: new Set()
};

const adminLoading = document.querySelector("#adminLoading");
const adminApp = document.querySelector("#adminApp");

const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebarToggle");
const syncButton = document.querySelector("#syncButton");

const profileName = document.querySelector("#profileName");
const profileRole = document.querySelector("#profileRole");
const profileAvatar = document.querySelector("#profileAvatar");

const statTotal = document.querySelector("#statTotal");
const statPending = document.querySelector("#statPending");
const statSent = document.querySelector("#statSent");
const statWaiting = document.querySelector("#statWaiting");
const statConfirmed = document.querySelector("#statConfirmed");
const pendingBadge = document.querySelector("#pendingBadge");

const messageTemplate = document.querySelector("#messageTemplate");
const saveTemplateButton = document.querySelector("#saveTemplateButton");
const restoreTemplateButton = document.querySelector("#restoreTemplateButton");
const templateStatus = document.querySelector("#templateStatus");

const reminderTemplate = document.querySelector("#reminderTemplate");
const saveReminderButton = document.querySelector("#saveReminderButton");
const restoreReminderButton = document.querySelector("#restoreReminderButton");
const reminderTemplateStatus = document.querySelector("#reminderTemplateStatus");

const guestSearch = document.querySelector("#guestSearch");
const eventFilter = document.querySelector("#eventFilter");
const sendFilter = document.querySelector("#sendFilter");
const responseFilter = document.querySelector("#responseFilter");
const guestsTableBody = document.querySelector("#guestsTableBody");
const pageFeedback = document.querySelector("#pageFeedback");

const newGuestButton = document.querySelector("#newGuestButton");
const newGuestButtonSecondary = document.querySelector("#newGuestButtonSecondary");
const sendNextButton = document.querySelector("#sendNextButton");
const sendNextReminderButton = document.querySelector("#sendNextReminderButton");

const guestDialog = document.querySelector("#guestDialog");
const guestForm = document.querySelector("#guestForm");
const closeGuestDialog = document.querySelector("#closeGuestDialog");
const guestDialogTitle = document.querySelector("#guestDialogTitle");
const guestIdInput = document.querySelector("#guestId");
const guestNameInput = document.querySelector("#guestName");
const guestPhoneInput = document.querySelector("#guestPhone");
const guestGroupInput = document.querySelector("#guestGroup");
const guestEventInput = document.querySelector("#guestEvent");
const guestPeopleCountInput = document.querySelector("#guestPeopleCount");
const guestAdultsInput = document.querySelector("#guestAdults");
const guestChildrenInput = document.querySelector("#guestChildren");
const guestNotesInput = document.querySelector("#guestNotes");
const guestFormFeedback = document.querySelector("#guestFormFeedback");

const messageDialog = document.querySelector("#messageDialog");
const closeMessageDialog = document.querySelector("#closeMessageDialog");
const messageDialogEyebrow = document.querySelector("#messageDialogEyebrow");
const messageGuestName = document.querySelector("#messageGuestName");
const messagePreview = document.querySelector("#messagePreview");
const copyMessageButton = document.querySelector("#copyMessageButton");
const openWhatsappButton = document.querySelector("#openWhatsappButton");

const confirmDialog = document.querySelector("#confirmDialog");
const confirmDialogTitle = document.querySelector("#confirmDialogTitle");
const confirmDialogMessage = document.querySelector("#confirmDialogMessage");
const cancelConfirm = document.querySelector("#cancelConfirm");
const acceptConfirm = document.querySelector("#acceptConfirm");

function normalizeText(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function normalizeSearch(value = "") {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizePhone(value = "") {
  const digits = String(value).replace(/\D/g, "").replace(/^0+/, "");

  if (!digits) return "";

  return digits.startsWith("55")
    ? digits
    : `55${digits}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  return value instanceof Date ? value : null;
}

function formatDate(value) {
  const date = timestampToDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function getTemplate() {
  return localStorage.getItem("iuna-invitation-template") || DEFAULT_TEMPLATE;
}

function getReminderTemplate() {
  return (
    localStorage.getItem("iuna-reminder-template") ||
    DEFAULT_REMINDER_TEMPLATE
  );
}

function createConfirmationLink(guestId) {
  const url = new URL(
    "/confirmar-presenca.html",
    SITE_URL
  );

  url.searchParams.set(
    "convite",
    guestId
  );

  return url.href;
}

function fillMessageTemplate(template, guest, guestId) {
  const event = EVENTS[guest.eventId] || EVENTS.bage;

  return template
    .replaceAll("{nome}", guest.name || "convidado")
    .replaceAll("{evento}", event.label)
    .replaceAll("{data}", event.date)
    .replaceAll("{horario}", event.time)
    .replaceAll("{local}", event.location)
    .replaceAll("{link}", createConfirmationLink(guestId));
}

function createMessage(guest, guestId) {
  return fillMessageTemplate(
    getTemplate(),
    guest,
    guestId
  );
}

function createReminderMessage(guest, guestId) {
  return fillMessageTemplate(
    getReminderTemplate(),
    guest,
    guestId
  );
}

function updateProfile(detail) {
  const user = detail?.user;
  const admin = detail?.admin ?? {};

  const name =
    admin.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Pais da Iúna";

  profileName.textContent = name;
  profileRole.textContent =
    admin.role === "owner"
      ? "Proprietário"
      : admin.role === "editor"
        ? "Editor"
        : "Administrador";
  profileAvatar.textContent = name.charAt(0).toUpperCase();
}


function onlyDigits(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function normalizeComparablePhone(value = "") {
  const digits = onlyDigits(value);

  if (digits.startsWith("55") && digits.length >= 12) {
    return digits.slice(2);
  }

  return digits;
}

function getRsvpForGuest(guest) {
  const guestId = guest.id;
  const data = guest.data;

  /*
   * 1. Melhor vínculo: invitationId gravado no RSVP.
   */
  const directMatch = state.rsvps.find(
    (item) =>
      String(item.data.invitationId || "") === guestId
  );

  if (directMatch) {
    return directMatch;
  }

  /*
   * 2. Compatibilidade com RSVP que não recebeu invitationId:
   * telefone + evento.
   */
  const guestPhone = normalizeComparablePhone(
    data.phoneDigits || data.phone
  );

  if (!guestPhone) {
    return null;
  }

  return state.rsvps.find((item) => {
    const rsvpPhone = normalizeComparablePhone(
      item.data.phoneDigits || item.data.phone
    );

    const samePhone =
      rsvpPhone &&
      rsvpPhone === guestPhone;

    const sameEvent =
      !data.eventId ||
      !item.data.eventId ||
      data.eventId === item.data.eventId;

    return samePhone && sameEvent;
  }) || null;
}

function getEffectiveGuestData(guest) {
  const rsvp = getRsvpForGuest(guest);

  if (!rsvp) {
    return {
      ...guest.data,
      matchedRsvp: null
    };
  }

  const rsvpData = rsvp.data;
  const confirmed =
    rsvpData.attendanceStatus === "confirmed";

  return {
    ...guest.data,

    confirmationStatus:
      confirmed
        ? "confirmed"
        : "declined",

    adults:
      Number(rsvpData.adults ?? guest.data.adults ?? 0),

    children:
      Number(rsvpData.children ?? guest.data.children ?? 0),

    peopleCount:
      Number(
        rsvpData.totalGuests ??
        (
          Number(rsvpData.adults ?? 0) +
          Number(rsvpData.children ?? 0)
        )
      ),

    rsvpProtocol:
      rsvpData.protocol ||
      rsvp.id,

    matchedRsvp: rsvp
  };
}

async function persistRsvpMatch(guest, effectiveData) {
  const rsvp = effectiveData.matchedRsvp;

  if (!rsvp) return;

  const currentStatus =
    guest.data.confirmationStatus || "waiting";

  const desiredStatus =
    effectiveData.confirmationStatus;

  if (
    currentStatus === desiredStatus &&
    String(guest.data.rsvpProtocol || "") ===
      String(effectiveData.rsvpProtocol || "")
  ) {
    return;
  }

  const syncKey = `${guest.id}:${rsvp.id}`;

  if (state.syncing.has(syncKey)) {
    return;
  }

  state.syncing.add(syncKey);

  try {
    const payload = {
      confirmationStatus: desiredStatus,
      rsvpId: rsvp.id,
      rsvpProtocol:
        effectiveData.rsvpProtocol || rsvp.id,

      adults:
        Number(effectiveData.adults || 0),

      children:
        Number(effectiveData.children || 0),

      peopleCount:
        Number(effectiveData.peopleCount || 0),

      confirmationSource:
        "rsvp-auto-match",

      updatedAt:
        serverTimestamp()
    };

    if (desiredStatus === "confirmed") {
      payload.confirmedAt =
        serverTimestamp();
    }

    if (desiredStatus === "declined") {
      payload.declinedAt =
        serverTimestamp();
    }

    await updateDoc(
      doc(
        db,
        "invitationGuests",
        guest.id
      ),
      payload
    );
  } catch (error) {
    console.warn(
      "[INVITES] RSVP encontrado, mas não foi possível persistir o vínculo:",
      error
    );
  } finally {
    state.syncing.delete(syncKey);
  }
}

function reconcileGuestsWithRsvps() {
  state.guests.forEach((guest) => {
    const effective =
      getEffectiveGuestData(guest);

    if (effective.matchedRsvp) {
      persistRsvpMatch(
        guest,
        effective
      );
    }
  });

  renderGuests();
}

function updateStats() {
  const effectiveGuests =
    state.guests.map((item) => ({
      ...item,
      data: getEffectiveGuestData(item)
    }));

  const total = effectiveGuests.length;

  const pending = effectiveGuests.filter(
    (item) =>
      item.data.invitationStatus !== "sent"
  ).length;

  const sent = effectiveGuests.filter(
    (item) =>
      item.data.invitationStatus === "sent"
  ).length;

  const waiting = effectiveGuests.filter(
    (item) =>
      (item.data.confirmationStatus || "waiting") === "waiting"
  ).length;

  const confirmed = effectiveGuests.filter(
    (item) =>
      item.data.confirmationStatus === "confirmed"
  ).length;

  statTotal.textContent = total;
  statPending.textContent = pending;
  statSent.textContent = sent;
  statWaiting.textContent = waiting;
  statConfirmed.textContent = confirmed;
  pendingBadge.textContent = pending;
}

function getFilteredGuests() {
  const term = normalizeSearch(guestSearch.value);
  const selectedEvent = eventFilter.value;
  const selectedSend = sendFilter.value;
  const selectedResponse = responseFilter.value;

  return state.guests.filter((guest) => {
    const data = getEffectiveGuestData(guest);

    const searchable = normalizeSearch(
      [data.name, data.phone, data.group, data.notes].join(" ")
    );

    const invitationStatus = data.invitationStatus || "pending";
    const confirmationStatus = data.confirmationStatus || "waiting";

    return (
      (!term || searchable.includes(term)) &&
      (selectedEvent === "all" || data.eventId === selectedEvent) &&
      (selectedSend === "all" || invitationStatus === selectedSend) &&
      (selectedResponse === "all" || confirmationStatus === selectedResponse)
    );
  });
}

function renderGuests() {
  updateStats();

  const filtered = getFilteredGuests();

  if (!filtered.length) {
    guestsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">Nenhum convidado encontrado.</td>
      </tr>
    `;
    return;
  }

  guestsTableBody.innerHTML = filtered
    .map((guest) => {
      const { id } = guest;
      const data = getEffectiveGuestData(guest);
      const event = EVENTS[data.eventId] || EVENTS.bage;
      const invitationStatus = data.invitationStatus || "pending";
      const confirmationStatus = data.confirmationStatus || "waiting";

      return `
        <tr>
          <td>
            <span class="guest-cell">
              <strong>${escapeHtml(data.name || "Sem nome")}</strong>
              <small>${escapeHtml(data.phone || "Sem telefone")} • ${escapeHtml(data.group || "Outros")}</small>
              <small class="invite-link-mini">${escapeHtml(createConfirmationLink(id))}</small>
            </span>
          </td>

          <td>${escapeHtml(event.label)}</td>

          <td>
            <strong>${Number(data.peopleCount || 1)}</strong>
            <small>${Number(data.adults || 0)} adultos / ${Number(data.children || 0)} crianças</small>
          </td>

          <td>
            <span class="invite-status ${invitationStatus}">
              ${invitationStatus === "sent" ? "Enviado" : "Pendente"}
            </span>
          </td>

          <td>
            <select class="response-select" data-id="${escapeHtml(id)}">
              <option value="waiting" ${confirmationStatus === "waiting" ? "selected" : ""}>Aguardando</option>
              <option value="confirmed" ${confirmationStatus === "confirmed" ? "selected" : ""}>Confirmado</option>
              <option value="declined" ${confirmationStatus === "declined" ? "selected" : ""}>Não poderá ir</option>
            </select>

            ${
              data.rsvpProtocol
                ? `<small class="invite-link-mini">Protocolo: ${escapeHtml(data.rsvpProtocol)}</small>`
                : ""
            }
          </td>

          <td>${formatDate(data.invitationSentAt)}</td>

          <td>
            <div class="invite-actions">
              <button class="invite-action primary open-message" data-id="${escapeHtml(id)}" type="button">WhatsApp</button>
              <button class="invite-action send-reminder" data-id="${escapeHtml(id)}" type="button">Lembrete</button>
              <button class="invite-action copy-message" data-id="${escapeHtml(id)}" type="button">Copiar</button>
              <button class="invite-action edit-guest" data-id="${escapeHtml(id)}" type="button">Editar</button>
              <button class="invite-action mark-sent" data-id="${escapeHtml(id)}" type="button">
                ${invitationStatus === "sent" ? "Reenviar" : "Marcar enviado"}
              </button>
              <button class="invite-action danger delete-guest" data-id="${escapeHtml(id)}" type="button">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function startListener() {
  const guestsQuery = query(
    collection(db, "invitationGuests"),
    orderBy("createdAt", "desc")
  );

  const rsvpsQuery = query(
    collection(db, "rsvps"),
    orderBy("createdAt", "desc")
  );

  state.unsubscribeGuests = onSnapshot(
    guestsQuery,
    (snapshot) => {
      state.guests = snapshot.docs.map((document) => ({
        id: document.id,
        data: document.data()
      }));

      pageFeedback.textContent = "";

      reconcileGuestsWithRsvps();
    },
    (error) => {
      console.error(
        "[INVITES] Erro ao carregar invitationGuests:",
        error
      );

      guestsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty">
            Não foi possível carregar a lista de convidados.
          </td>
        </tr>
      `;

      pageFeedback.textContent =
        "Verifique as permissões de invitationGuests no Firestore.";
    }
  );

  state.unsubscribeRsvps = onSnapshot(
    rsvpsQuery,
    (snapshot) => {
      state.rsvps = snapshot.docs.map((document) => ({
        id: document.id,
        data: document.data()
      }));

      pageFeedback.textContent = "";

      reconcileGuestsWithRsvps();
    },
    (error) => {
      console.error(
        "[INVITES] Erro ao carregar rsvps:",
        error
      );

      pageFeedback.textContent =
        "Os convites foram carregados, mas não foi possível sincronizar as confirmações do site.";
    }
  );
}

function openGuestForm(guest = null) {
  guestForm.reset();
  guestFormFeedback.textContent = "";
  guestFormFeedback.className = "form-feedback";

  if (guest) {
    guestDialogTitle.textContent = "Editar convidado";
    guestIdInput.value = guest.id;
    guestNameInput.value = guest.data.name || "";
    guestPhoneInput.value = guest.data.phone || "";
    guestGroupInput.value = guest.data.group || "Família";
    guestEventInput.value = guest.data.eventId || "bage";
    guestPeopleCountInput.value = Number(guest.data.peopleCount || 1);
    guestAdultsInput.value = Number(guest.data.adults || 0);
    guestChildrenInput.value = Number(guest.data.children || 0);
    guestNotesInput.value = guest.data.notes || "";
  } else {
    guestDialogTitle.textContent = "Adicionar convidado";
    guestIdInput.value = "";
    guestGroupInput.value = "Família";
    guestEventInput.value = "bage";
    guestPeopleCountInput.value = 1;
    guestAdultsInput.value = 1;
    guestChildrenInput.value = 0;
  }

  guestDialog.showModal();
  document.body.classList.add("modal-open");
}

function closeGuestForm() {
  guestDialog.close();
  document.body.classList.remove("modal-open");
}

async function saveGuest(event) {
  event.preventDefault();

  const name = normalizeText(guestNameInput.value);
  const phone = normalizeText(guestPhoneInput.value);
  const phoneDigits = normalizePhone(phone);
  const guestId = guestIdInput.value;

  if (name.length < 2 || phoneDigits.length < 12) {
    guestFormFeedback.textContent =
      "Informe um nome e um WhatsApp válido com DDD.";
    guestFormFeedback.className = "form-feedback is-error";
    return;
  }

  const button = guestForm.querySelector('button[type="submit"]');
  const text = button.querySelector(".button-text");
  const loading = button.querySelector(".button-loading");

  button.disabled = true;
  text.hidden = true;
  loading.hidden = false;

  try {
    const payload = {
      name,
      phone,
      phoneDigits,
      group: guestGroupInput.value,
      eventId: guestEventInput.value,
      peopleCount: Math.max(1, Number(guestPeopleCountInput.value || 1)),
      adults: Math.max(0, Number(guestAdultsInput.value || 0)),
      children: Math.max(0, Number(guestChildrenInput.value || 0)),
      notes: normalizeText(guestNotesInput.value),
      updatedAt: serverTimestamp()
    };

    if (guestId) {
      await updateDoc(doc(db, "invitationGuests", guestId), payload);
    } else {
      await addDoc(collection(db, "invitationGuests"), {
        ...payload,
        invitationStatus: "pending",
        confirmationStatus: "waiting",
        invitationSentAt: null,
        createdAt: serverTimestamp()
      });
    }

    closeGuestForm();
  } catch (error) {
    console.error("[INVITES] Erro ao salvar:", error);
    guestFormFeedback.textContent = "Não foi possível salvar o convidado.";
    guestFormFeedback.className = "form-feedback is-error";
  } finally {
    button.disabled = false;
    text.hidden = false;
    loading.hidden = true;
  }
}

function openMessage(guest, mode = "invite") {
  state.currentGuest = guest;
  state.messageMode = mode;

  const isReminder =
    mode === "reminder";

  messageDialogEyebrow.textContent =
    isReminder
      ? "Lembrete de confirmação"
      : "Mensagem personalizada";

  messageGuestName.textContent =
    isReminder
      ? `Lembrete para ${guest.data.name || "convidado"}`
      : `Convite para ${guest.data.name || "convidado"}`;

  messagePreview.value =
    isReminder
      ? createReminderMessage(guest.data, guest.id)
      : createMessage(guest.data, guest.id);

  messageDialog.showModal();
  document.body.classList.add("modal-open");
}

function closeMessage() {
  messageDialog.close();
  state.currentGuest = null;
  document.body.classList.remove("modal-open");
}

async function openWhatsapp() {
  if (!state.currentGuest) return;

  const guest = state.currentGuest;
  const phone = normalizePhone(guest.data.phoneDigits || guest.data.phone);
  const message = messagePreview.value.trim();

  if (!phone) {
    pageFeedback.textContent = "Este convidado não possui WhatsApp válido.";
    return;
  }

  const updatePayload = {
    invitationStatus: "sent",
    updatedAt: serverTimestamp()
  };

  if (state.messageMode === "reminder") {
    updatePayload.lastReminderAt = serverTimestamp();
    updatePayload.lastReminderMessage = message;
    updatePayload.reminderCount =
      Number(guest.data.reminderCount || 0) + 1;
  } else {
    updatePayload.invitationSentAt = serverTimestamp();
    updatePayload.lastInvitationMessage = message;
  }

  await updateDoc(
    doc(db, "invitationGuests", guest.id),
    updatePayload
  );

  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener"
  );

  closeMessage();
}

function askConfirmation({ title, message, action }) {
  confirmDialogTitle.textContent = title;
  confirmDialogMessage.textContent = message;
  state.confirmAction = action;
  confirmDialog.showModal();
  document.body.classList.add("modal-open");
}

function closeConfirmation() {
  confirmDialog.close();
  state.confirmAction = null;
  document.body.classList.remove("modal-open");
}

async function runConfirmation() {
  if (typeof state.confirmAction !== "function") return;

  acceptConfirm.disabled = true;

  try {
    await state.confirmAction();
    closeConfirmation();
  } finally {
    acceptConfirm.disabled = false;
  }
}

messageTemplate.value = getTemplate();
reminderTemplate.value = getReminderTemplate();

saveTemplateButton.addEventListener("click", () => {
  localStorage.setItem(
    "iuna-invitation-template",
    messageTemplate.value.trim() || DEFAULT_TEMPLATE
  );

  templateStatus.textContent = "Mensagem salva com sucesso.";

  window.setTimeout(() => {
    templateStatus.textContent = "Mensagem salva neste dispositivo.";
  }, 1800);
});

restoreTemplateButton.addEventListener("click", () => {
  messageTemplate.value = DEFAULT_TEMPLATE;
  localStorage.setItem("iuna-invitation-template", DEFAULT_TEMPLATE);
});

saveReminderButton.addEventListener("click", () => {
  localStorage.setItem(
    "iuna-reminder-template",
    reminderTemplate.value.trim() || DEFAULT_REMINDER_TEMPLATE
  );

  reminderTemplateStatus.textContent =
    "Lembrete salvo com sucesso.";

  window.setTimeout(() => {
    reminderTemplateStatus.textContent =
      "Mensagem salva neste dispositivo.";
  }, 1800);
});

restoreReminderButton.addEventListener("click", () => {
  reminderTemplate.value =
    DEFAULT_REMINDER_TEMPLATE;

  localStorage.setItem(
    "iuna-reminder-template",
    DEFAULT_REMINDER_TEMPLATE
  );
});

document.querySelectorAll("[data-reminder-variable]").forEach((button) => {
  button.addEventListener("click", () => {
    const variable =
      button.dataset.reminderVariable;

    const start =
      reminderTemplate.selectionStart;

    const end =
      reminderTemplate.selectionEnd;

    const value =
      reminderTemplate.value;

    reminderTemplate.value =
      value.slice(0, start) +
      variable +
      value.slice(end);

    reminderTemplate.focus();

    reminderTemplate.setSelectionRange(
      start + variable.length,
      start + variable.length
    );
  });
});

document.querySelectorAll("[data-variable]").forEach((button) => {
  button.addEventListener("click", () => {
    const variable = button.dataset.variable;
    const start = messageTemplate.selectionStart;
    const end = messageTemplate.selectionEnd;
    const value = messageTemplate.value;

    messageTemplate.value =
      value.slice(0, start) +
      variable +
      value.slice(end);

    messageTemplate.focus();
    messageTemplate.setSelectionRange(
      start + variable.length,
      start + variable.length
    );
  });
});

[newGuestButton, newGuestButtonSecondary].forEach((button) => {
  button.addEventListener("click", () => openGuestForm());
});

sendNextButton.addEventListener("click", () => {
  const next = state.guests.find(
    (item) => item.data.invitationStatus !== "sent"
  );

  if (!next) {
    pageFeedback.textContent = "Todos os convites já foram enviados.";
    return;
  }

  openMessage(next);
});

sendNextReminderButton.addEventListener("click", () => {
  const next = state.guests.find(
    (item) => {
      const data =
        getEffectiveGuestData(item);

      return (
        data.invitationStatus === "sent" &&
        (data.confirmationStatus || "waiting") === "waiting"
      );
    }
  );

  if (!next) {
    pageFeedback.textContent =
      "Não há convidados aguardando confirmação para receber lembrete.";
    return;
  }

  openMessage(next, "reminder");
});

closeGuestDialog.addEventListener("click", closeGuestForm);
guestForm.addEventListener("submit", saveGuest);

closeMessageDialog.addEventListener("click", closeMessage);

copyMessageButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(messagePreview.value);
  copyMessageButton.textContent = "Mensagem copiada";

  window.setTimeout(() => {
    copyMessageButton.textContent = "Copiar mensagem";
  }, 1500);
});

openWhatsappButton.addEventListener("click", openWhatsapp);

guestSearch.addEventListener("input", renderGuests);
eventFilter.addEventListener("change", renderGuests);
sendFilter.addEventListener("change", renderGuests);
responseFilter.addEventListener("change", renderGuests);

guestsTableBody.addEventListener("click", async (event) => {
  const openButton = event.target.closest(".open-message");
  const reminderButton = event.target.closest(".send-reminder");
  const copyButton = event.target.closest(".copy-message");
  const editButton = event.target.closest(".edit-guest");
  const sentButton = event.target.closest(".mark-sent");
  const deleteButton = event.target.closest(".delete-guest");

  const id =
    openButton?.dataset.id ||
    reminderButton?.dataset.id ||
    copyButton?.dataset.id ||
    editButton?.dataset.id ||
    sentButton?.dataset.id ||
    deleteButton?.dataset.id;

  if (!id) return;

  const guest = state.guests.find((item) => item.id === id);
  if (!guest) return;

  if (openButton) openMessage(guest);

  if (reminderButton) {
    const effectiveData =
      getEffectiveGuestData(guest);

    if (
      (effectiveData.confirmationStatus || "waiting") !== "waiting"
    ) {
      pageFeedback.textContent =
        `${guest.data.name} já respondeu ao convite.`;
    } else {
      openMessage(guest, "reminder");
    }
  }

  if (copyButton) {
    await navigator.clipboard.writeText(
      createMessage(guest.data, guest.id)
    );
    pageFeedback.textContent = `Mensagem de ${guest.data.name} copiada.`;
  }

  if (editButton) openGuestForm(guest);

  if (sentButton) {
    await updateDoc(doc(db, "invitationGuests", id), {
      invitationStatus: "sent",
      invitationSentAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  if (deleteButton) {
    askConfirmation({
      title: "Excluir convidado?",
      message: `O convidado “${guest.data.name}” será removido da lista.`,
      action: () => deleteDoc(doc(db, "invitationGuests", id))
    });
  }
});

guestsTableBody.addEventListener("change", async (event) => {
  const select = event.target.closest(".response-select");
  if (!select) return;

  await updateDoc(doc(db, "invitationGuests", select.dataset.id), {
    confirmationStatus: select.value,
    updatedAt: serverTimestamp()
  });
});

syncButton.addEventListener("click", () => {
  syncButton.classList.add("is-syncing");
  renderGuests();

  window.setTimeout(() => {
    syncButton.classList.remove("is-syncing");
  }, 650);
});

sidebarToggle.addEventListener("click", () => {
  const open = !sidebar.classList.contains("open");
  sidebar.classList.toggle("open", open);
  sidebarToggle.setAttribute("aria-expanded", String(open));
});

cancelConfirm.addEventListener("click", closeConfirmation);
acceptConfirm.addEventListener("click", runConfirmation);

[guestDialog, messageDialog, confirmDialog].forEach((dialog) => {
  dialog.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
  });
});

window.addEventListener("iuna-admin-ready", (event) => {
  updateProfile(event.detail);
  startListener();
});

if (window.__IUNA_ADMIN__) {
  updateProfile(window.__IUNA_ADMIN__);
  startListener();
}

window.addEventListener("beforeunload", () => {
  if (
    typeof state.unsubscribeGuests ===
    "function"
  ) {
    state.unsubscribeGuests();
  }

  if (
    typeof state.unsubscribeRsvps ===
    "function"
  ) {
    state.unsubscribeRsvps();
  }
});
