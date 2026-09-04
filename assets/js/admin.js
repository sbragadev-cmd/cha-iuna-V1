import { db } from "./firebase-config.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const SITE_URL = "https://cha-iuna.vercel.app";

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

const SECTION_META = {
  dashboard: ["Área dos Pais", "Visão geral"],
  guests: ["Confirmações", "Convidados"],
  invites: ["WhatsApp", "Convites"],
  gifts: ["Lista de presentes", "Presentes"],
  giftSelections: ["Escolhas dos convidados", "Presentes escolhidos"],
  messages: ["Moderação", "Recadinhos"],
  gallery: ["Álbum de memórias", "Galeria"],
  events: ["Informações oficiais", "Eventos"],
  settings: ["Sistema", "Configurações"]
};

const DEFAULT_INVITE_TEMPLATE = `Olá, {nome}! 💜

Com muito carinho, queremos convidar você para o Piquenique de Boas-vindas da Iúna.

📍 Evento: {evento}
📅 Data: {data}
🕒 Horário: {horario}
🌿 Local: {local}

Confirme sua presença:
{link}

Esperamos você para compartilhar esse momento tão especial conosco! 🧺🌸`;

const DEFAULT_REMINDER_TEMPLATE = `Olá, {nome}! 💜

Estamos finalizando os preparativos para o Piquenique de Boas-vindas da Iúna.

Pedimos que confirme sua presença até 31/08.

📍 {evento}
📅 {data}
🕒 {horario}
🌿 {local}

Confirme por aqui:
{link}

Se você já confirmou, pode desconsiderar esta mensagem.

Com carinho,
Família da Iúna 💜`;

const state = {
  rsvps: [],
  invitationGuests: [],
  gifts: [],
  selections: [],
  messages: [],
  gallery: [],
  currentMessageGuest: null,
  currentMessageMode: "invite",
  currentGiftImageData: "",
  currentPhotoImageData: "",
  confirmAction: null,
  unsubs: [],
  started: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const navItems = $$(".nav-item");
const sections = $$(".admin-section");

function normalizeText(value = "") {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeSearch(value = "") {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function onlyDigits(value = "") {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizePhone(value = "") {
  const digits = onlyDigits(value).replace(/^0+/, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function comparablePhone(value = "") {
  let digits = onlyDigits(value);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  return digits;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeStatus(value = "") {
  const v = String(value ?? "").trim().toLowerCase();

  if (
    value === true ||
    ["confirmed", "confirmado", "confirmada", "sim", "yes"].includes(v)
  ) return "confirmed";

  if (
    value === false ||
    ["declined", "recusado", "recusada", "nao", "não", "no"].includes(v)
  ) return "declined";

  return v || "waiting";
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function formatDate(value) {
  const date = timestampToDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function safeImage(value = "") {
  const source = String(value || "").trim();

  if (
    source.startsWith("data:image/jpeg;base64,") ||
    source.startsWith("data:image/png;base64,") ||
    source.startsWith("data:image/webp;base64,") ||
    source.startsWith("https://")
  ) return source;

  return "";
}

function createConfirmationLink(guestId) {
  const url = new URL("/confirmar-presenca.html", SITE_URL);
  url.searchParams.set("convite", guestId);
  return url.href;
}

function getInviteTemplate() {
  return localStorage.getItem("iuna-invitation-template") || DEFAULT_INVITE_TEMPLATE;
}

function getReminderTemplate() {
  return localStorage.getItem("iuna-reminder-template") || DEFAULT_REMINDER_TEMPLATE;
}

function createMessage(guest, guestId, mode = "invite") {
  const event = EVENTS[guest.eventId] || EVENTS.bage;
  const template = mode === "reminder" ? getReminderTemplate() : getInviteTemplate();

  return template
    .replaceAll("{nome}", guest.name || "convidado")
    .replaceAll("{evento}", event.label)
    .replaceAll("{data}", event.date)
    .replaceAll("{horario}", event.time)
    .replaceAll("{local}", event.location)
    .replaceAll("{link}", createConfirmationLink(guestId));
}

function updateProfile(detail) {
  const user = detail?.user;
  const admin = detail?.admin ?? {};
  const name =
    admin.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Pais da Iúna";

  const labels = {
    owner: "Proprietário",
    admin: "Administrador",
    editor: "Editor"
  };

  $("#profileName").textContent = name;
  $("#profileRole").textContent = labels[admin.role] || "Administrador";
  $("#profileAvatar").textContent = name.charAt(0).toUpperCase();

  const projectId = db.app?.options?.projectId || "Firebase";
  $("#firebaseProjectInfo").textContent = `Projeto: ${projectId}`;
}

function openSection(sectionId) {
  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.section === sectionId);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === `section-${sectionId}`);
  });

  const [eyebrow, title] = SECTION_META[sectionId] || SECTION_META.dashboard;
  $("#sectionEyebrow").textContent = eyebrow;
  $("#sectionTitle").textContent = title;

  $("#sidebar").classList.remove("open");
  $("#sidebarToggle").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getRsvpForInvite(invite) {
  const direct = state.rsvps
    .filter((item) => String(item.data.invitationId || "") === invite.id)
    .sort((a, b) => {
      const da = timestampToDate(a.data.updatedAt || a.data.createdAt)?.getTime() || 0;
      const db = timestampToDate(b.data.updatedAt || b.data.createdAt)?.getTime() || 0;
      return db - da;
    })[0];

  if (direct) return direct;

  const invitePhone = comparablePhone(invite.data.phoneDigits || invite.data.phone);
  if (!invitePhone) return null;

  const sameInviteCandidates = state.invitationGuests.filter((candidate) => {
    const candidatePhone = comparablePhone(candidate.data.phoneDigits || candidate.data.phone);
    return candidatePhone === invitePhone && candidate.data.eventId === invite.data.eventId;
  });

  if (sameInviteCandidates.length !== 1) return null;

  return state.rsvps
    .filter((item) => {
      const phone = comparablePhone(item.data.phoneDigits || item.data.phone);
      return phone === invitePhone && item.data.eventId === invite.data.eventId;
    })
    .sort((a, b) => {
      const da = timestampToDate(a.data.updatedAt || a.data.createdAt)?.getTime() || 0;
      const db = timestampToDate(b.data.updatedAt || b.data.createdAt)?.getTime() || 0;
      return db - da;
    })[0] || null;
}

function getEffectiveInvite(invite) {
  const rsvp = getRsvpForInvite(invite);

  if (!rsvp) return { ...invite.data, rsvpId: invite.data.rsvpId || "" };

  const r = rsvp.data;
  const status = normalizeStatus(r.attendanceStatus);

  return {
    ...invite.data,
    confirmationStatus: status,
    adults: Number(r.adults ?? invite.data.adults ?? 0),
    children: Number(r.children ?? invite.data.children ?? 0),
    peopleCount: Number(
      r.totalGuests ??
      (Number(r.adults || 0) + Number(r.children || 0))
    ),
    rsvpId: rsvp.id,
    rsvpProtocol: r.protocol || rsvp.id
  };
}

function getConsolidatedGuests() {
  const rows = [];
  const usedRsvps = new Set();

  state.invitationGuests.forEach((invite) => {
    const rsvp = getRsvpForInvite(invite);

    if (rsvp) usedRsvps.add(rsvp.id);

    const data = getEffectiveInvite(invite);

    rows.push({
      id: invite.id,
      source: "invite",
      data: {
        name: data.name || rsvp?.data?.guestName || "Sem nome",
        phone: data.phone || rsvp?.data?.phone || "",
        phoneDigits: data.phoneDigits || rsvp?.data?.phoneDigits || "",
        eventId: data.eventId || rsvp?.data?.eventId || "",
        eventLabel: EVENTS[data.eventId]?.label || rsvp?.data?.eventLabel || "",
        attendanceStatus: normalizeStatus(data.confirmationStatus),
        adults: Number(data.adults || 0),
        children: Number(data.children || 0),
        totalGuests: Number(data.peopleCount || 0),
        protocol: data.rsvpProtocol || data.rsvpId || "",
        relationship: data.group || "",
        updatedAt: data.updatedAt || rsvp?.data?.updatedAt || rsvp?.data?.createdAt || null
      }
    });
  });

  state.rsvps.forEach((rsvp) => {
    if (usedRsvps.has(rsvp.id)) return;

    rows.push({
      id: rsvp.id,
      source: "rsvp",
      data: {
        name: rsvp.data.guestName || "Sem nome",
        phone: rsvp.data.phone || "",
        phoneDigits: rsvp.data.phoneDigits || "",
        eventId: rsvp.data.eventId || "",
        eventLabel: rsvp.data.eventLabel || EVENTS[rsvp.data.eventId]?.label || "",
        attendanceStatus: normalizeStatus(rsvp.data.attendanceStatus),
        adults: Number(rsvp.data.adults || 0),
        children: Number(rsvp.data.children || 0),
        totalGuests: Number(
          rsvp.data.totalGuests ??
          (Number(rsvp.data.adults || 0) + Number(rsvp.data.children || 0))
        ),
        protocol: rsvp.data.protocol || rsvp.id,
        relationship: rsvp.data.relationship || "",
        updatedAt: rsvp.data.updatedAt || rsvp.data.createdAt || null
      }
    });
  });

  return rows;
}

function renderDashboard() {
  const consolidated = getConsolidatedGuests();
  const confirmed = consolidated.filter((item) => item.data.attendanceStatus === "confirmed");
  const waiting = consolidated.filter((item) => item.data.attendanceStatus === "waiting");

  const totalPeople = confirmed.reduce((sum, item) => sum + Number(item.data.totalGuests || 0), 0);

  $("#kpiRsvps").textContent = confirmed.length;
  $("#kpiRsvpsDetail").textContent = `${totalPeople} pessoas confirmadas`;
  $("#kpiWaiting").textContent = waiting.length;

  const selectedUnits = state.gifts.reduce(
    (sum, item) => sum + Number(item.data.reservedQuantity || 0),
    0
  );

  $("#kpiGifts").textContent = state.gifts.length;
  $("#kpiGiftsDetail").textContent = `${selectedUnits} unidades escolhidas`;

  const pendingMessages = state.messages.filter((item) => item.data.approved !== true).length;
  const pendingGallery = state.gallery.filter((item) => item.data.approved !== true).length;

  $("#kpiPending").textContent = pendingMessages + pendingGallery;
  $("#kpiPendingDetail").textContent = `${pendingMessages} recadinhos • ${pendingGallery} fotos`;

  $("#guestsBadge").textContent = confirmed.length;
  $("#invitesBadge").textContent = state.invitationGuests.filter(
    (item) => (getEffectiveInvite(item).confirmationStatus || "waiting") === "waiting"
  ).length;
  $("#giftSelectionsBadge").textContent = state.selections.length;
  $("#messagesBadge").textContent = pendingMessages;
  $("#galleryBadge").textContent = pendingGallery;

  ["bage", "porto-alegre"].forEach((eventId) => {
    const rows = confirmed.filter((item) => item.data.eventId === eventId);
    const adults = rows.reduce((sum, item) => sum + Number(item.data.adults || 0), 0);
    const children = rows.reduce((sum, item) => sum + Number(item.data.children || 0), 0);
    const people = rows.reduce((sum, item) => sum + Number(item.data.totalGuests || 0), 0);
    const prefix = eventId === "bage" ? "bage" : "poa";

    $(`#${prefix}People`).textContent = people;
    $(`#${prefix}Adults`).textContent = adults;
    $(`#${prefix}Children`).textContent = children;
  });

  renderActivity();
}

function renderActivity() {
  const activity = [
    ...state.rsvps.map((item) => ({
      icon: "👥",
      title: `${item.data.guestName || "Convidado"} respondeu ao convite`,
      detail: normalizeStatus(item.data.attendanceStatus) === "confirmed"
        ? `Presença confirmada em ${item.data.eventLabel || EVENTS[item.data.eventId]?.label || "um evento"}`
        : "Informou que não poderá comparecer",
      date: item.data.updatedAt || item.data.createdAt
    })),
    ...state.selections.map((item) => ({
      icon: "🎁",
      title: `${item.data.giverName || "Convidado"} escolheu um presente`,
      detail: `${item.data.quantity || 1}x ${item.data.giftName || "Presente"}`,
      date: item.data.createdAt
    })),
    ...state.messages.map((item) => ({
      icon: "✉",
      title: `${item.data.name || "Convidado"} enviou um recadinho`,
      detail: item.data.approved ? "Recadinho aprovado" : "Aguardando aprovação",
      date: item.data.createdAt
    }))
  ]
    .sort((a, b) => {
      const da = timestampToDate(a.date)?.getTime() || 0;
      const db = timestampToDate(b.date)?.getTime() || 0;
      return db - da;
    })
    .slice(0, 8);

  $("#activityList").innerHTML = activity.length
    ? activity.map((item) => `
      <article class="activity-item">
        <span class="activity-dot">${item.icon}</span>
        <div>
          <p><strong>${escapeHtml(item.title)}</strong></p>
          <small>${escapeHtml(item.detail)} • ${formatDate(item.date)}</small>
        </div>
      </article>
    `).join("")
    : '<p class="empty-copy">As atividades aparecerão aqui.</p>';
}

function renderGuests() {
  const rows = getConsolidatedGuests();
  const term = normalizeSearch($("#guestSearch").value);
  const eventFilter = $("#guestEventFilter").value;
  const statusFilter = $("#guestStatusFilter").value;

  const confirmed = rows.filter((item) => item.data.attendanceStatus === "confirmed");
  const waiting = rows.filter((item) => item.data.attendanceStatus === "waiting");
  const declined = rows.filter((item) => item.data.attendanceStatus === "declined");

  $("#guestConfirmedCount").textContent = confirmed.length;
  $("#guestWaitingCount").textContent = waiting.length;
  $("#guestDeclinedCount").textContent = declined.length;
  $("#guestPeopleCount").textContent = confirmed.reduce(
    (sum, item) => sum + Number(item.data.totalGuests || 0),
    0
  );

  const filtered = rows.filter((item) => {
    const data = item.data;
    const searchable = normalizeSearch([
      data.name, data.phone, data.phoneDigits, data.protocol
    ].join(" "));

    return (
      (!term || searchable.includes(term)) &&
      (eventFilter === "all" || data.eventId === eventFilter) &&
      (statusFilter === "all" || data.attendanceStatus === statusFilter)
    );
  });

  $("#guestsTableBody").innerHTML = filtered.length
    ? filtered.map((item) => {
        const d = item.data;
        const statusLabel = d.attendanceStatus === "confirmed"
          ? "Confirmado"
          : d.attendanceStatus === "declined"
            ? "Não poderá ir"
            : "Aguardando";

        return `
          <tr>
            <td>
              <span class="person-cell">
                <strong>${escapeHtml(d.name)}</strong>
                <small>${escapeHtml(d.relationship || "")}</small>
              </span>
            </td>
            <td>${escapeHtml(d.eventLabel || d.eventId || "—")}</td>
            <td><span class="status-pill ${d.attendanceStatus}">${statusLabel}</span></td>
            <td>${Number(d.adults || 0)}</td>
            <td>${Number(d.children || 0)}</td>
            <td><strong>${Number(d.totalGuests || 0)}</strong></td>
            <td>${escapeHtml(d.phone || "—")}</td>
            <td><code>${escapeHtml(d.protocol || "—")}</code></td>
            <td>
              <div class="table-actions">
                ${
                  d.phoneDigits || d.phone
                    ? `<a class="icon-button" href="https://wa.me/${normalizePhone(d.phoneDigits || d.phone)}" target="_blank" rel="noopener">WhatsApp</a>`
                    : ""
                }
                ${
                  item.source === "rsvp"
                    ? `<button class="icon-button danger delete-rsvp" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(d.name)}" type="button">Excluir RSVP</button>`
                    : ""
                }
              </div>
            </td>
          </tr>
        `;
      }).join("")
    : '<tr><td colspan="9" class="table-empty">Nenhum convidado encontrado.</td></tr>';
}

function renderInvites() {
  const term = normalizeSearch($("#inviteSearch").value);
  const eventFilter = $("#inviteEventFilter").value;
  const statusFilter = $("#inviteStatusFilter").value;

  const total = state.invitationGuests.length;
  const pending = state.invitationGuests.filter((item) => item.data.invitationStatus !== "sent").length;
  const sent = state.invitationGuests.filter((item) => item.data.invitationStatus === "sent").length;
  const waiting = state.invitationGuests.filter(
    (item) => (getEffectiveInvite(item).confirmationStatus || "waiting") === "waiting"
  ).length;

  $("#inviteTotal").textContent = total;
  $("#invitePending").textContent = pending;
  $("#inviteSent").textContent = sent;
  $("#inviteWaiting").textContent = waiting;

  const filtered = state.invitationGuests.filter((item) => {
    const data = getEffectiveInvite(item);
    const searchable = normalizeSearch([
      data.name, data.phone, data.group, data.notes
    ].join(" "));

    const invitationStatus = data.invitationStatus || "pending";
    const confirmationStatus = data.confirmationStatus || "waiting";

    let statusMatches = true;

    if (statusFilter === "pending") statusMatches = invitationStatus !== "sent";
    if (statusFilter === "sent") statusMatches = invitationStatus === "sent";
    if (["waiting", "confirmed", "declined"].includes(statusFilter)) {
      statusMatches = confirmationStatus === statusFilter;
    }

    return (
      (!term || searchable.includes(term)) &&
      (eventFilter === "all" || data.eventId === eventFilter) &&
      (statusFilter === "all" || statusMatches)
    );
  });

  $("#invitesTableBody").innerHTML = filtered.length
    ? filtered.map((item) => {
        const d = getEffectiveInvite(item);
        const event = EVENTS[d.eventId] || EVENTS.bage;
        const invitationStatus = d.invitationStatus || "pending";
        const confirmationStatus = d.confirmationStatus || "waiting";
        const responseLabel = confirmationStatus === "confirmed"
          ? "Confirmado"
          : confirmationStatus === "declined"
            ? "Não poderá ir"
            : "Aguardando";

        return `
          <tr>
            <td>
              <span class="guest-cell">
                <strong>${escapeHtml(d.name || "Sem nome")}</strong>
                <small>${escapeHtml(d.phone || "Sem telefone")} • ${escapeHtml(d.group || "Outros")}</small>
                <small>${escapeHtml(createConfirmationLink(item.id))}</small>
              </span>
            </td>
            <td>${escapeHtml(event.label)}</td>
            <td>
              <strong>${Number(d.peopleCount || 1)}</strong>
              <small>${Number(d.adults || 0)} adultos / ${Number(d.children || 0)} crianças</small>
            </td>
            <td>
              <span class="status-pill ${invitationStatus === "sent" ? "approved" : "pending"}">
                ${invitationStatus === "sent" ? "Enviado" : "Pendente"}
              </span>
            </td>
            <td><span class="status-pill ${confirmationStatus}">${responseLabel}</span></td>
            <td>${formatDate(d.lastReminderAt || d.invitationSentAt)}</td>
            <td>
              <div class="table-actions">
                <button class="icon-button primary invite-whatsapp" data-id="${item.id}" type="button">WhatsApp</button>
                <button class="icon-button invite-reminder" data-id="${item.id}" type="button">Lembrete</button>
                <button class="icon-button edit-invite" data-id="${item.id}" type="button">Editar</button>
                <button class="icon-button danger delete-invite" data-id="${item.id}" data-name="${escapeHtml(d.name || "convidado")}" type="button">Excluir</button>
              </div>
            </td>
          </tr>
        `;
      }).join("")
    : '<tr><td colspan="7" class="table-empty">Nenhum convite encontrado.</td></tr>';
}

function getGiftTotal(gift) {
  return Math.max(0, Number(gift.quantity ?? gift.totalQuantity ?? 0));
}

function getGiftReserved(gift) {
  return Math.max(0, Number(gift.reservedQuantity ?? 0));
}

function getGiftAvailable(gift) {
  return Math.max(0, getGiftTotal(gift) - getGiftReserved(gift));
}

function renderGifts() {
  const term = normalizeSearch($("#giftSearch").value);
  const status = $("#giftStatusFilter").value;

  const filtered = state.gifts.filter((item) => {
    const d = item.data;
    const searchable = normalizeSearch([
      d.name, d.title, d.category, d.description
    ].join(" "));

    const available = getGiftAvailable(d);

    const statusMatch =
      status === "all" ||
      (status === "active" && d.active === true) ||
      (status === "inactive" && d.active !== true) ||
      (status === "available" && available > 0) ||
      (status === "finished" && available <= 0);

    return (!term || searchable.includes(term)) && statusMatch;
  });

  $("#giftsGrid").innerHTML = filtered.length
    ? filtered.map((item) => {
        const d = item.data;
        const total = getGiftTotal(d);
        const reserved = getGiftReserved(d);
        const available = getGiftAvailable(d);
        const image = safeImage(d.imageData || d.imageUrl || "");

        return `
          <article class="admin-gift-card">
            <div class="admin-gift-image">
              ${image ? `<img src="${image}" alt="${escapeHtml(d.name || "Presente")}">` : "♡"}
            </div>
            <div class="admin-gift-content">
              <span class="status-pill ${d.active === true ? "active" : "inactive"}">
                ${d.active === true ? "Ativo" : "Inativo"}
              </span>
              <h3>${escapeHtml(d.name || d.title || "Presente")}</h3>
              <p>${escapeHtml(d.description || "Sem descrição.")}</p>
              <div class="gift-counts">
                <span><b>${total}</b><small>Total</small></span>
                <span><b>${reserved}</b><small>Escolhidos</small></span>
                <span><b>${available}</b><small>Disponíveis</small></span>
              </div>
              <div class="card-actions">
                <button class="icon-button edit-gift" data-id="${item.id}" type="button">Editar</button>
                <button class="icon-button toggle-gift" data-id="${item.id}" data-active="${d.active === true}" type="button">
                  ${d.active === true ? "Desativar" : "Ativar"}
                </button>
                <button class="icon-button danger delete-gift" data-id="${item.id}" data-name="${escapeHtml(d.name || "presente")}" type="button">Excluir</button>
              </div>
            </div>
          </article>
        `;
      }).join("")
    : '<p class="empty-copy">Nenhum presente encontrado.</p>';
}

function renderSelections() {
  const term = normalizeSearch($("#selectionSearch").value);

  const filtered = state.selections.filter((item) => {
    const d = item.data;
    const searchable = normalizeSearch([
      d.giverName, d.giverPhone, d.giftName, d.giftCategory
    ].join(" "));

    return !term || searchable.includes(term);
  });

  $("#selectionsTableBody").innerHTML = filtered.length
    ? filtered.map((item) => {
        const d = item.data;

        return `
          <tr>
            <td><strong>${escapeHtml(d.giverName || "Sem nome")}</strong></td>
            <td>${escapeHtml(d.giverPhone || "—")}</td>
            <td>${escapeHtml(d.giftName || "Presente")}</td>
            <td><strong>${Number(d.quantity || 1)}</strong></td>
            <td>${escapeHtml(d.message || "—")}</td>
            <td>${formatDate(d.createdAt)}</td>
          </tr>
        `;
      }).join("")
    : '<tr><td colspan="6" class="table-empty">Nenhuma escolha registrada.</td></tr>';
}

function renderMessages() {
  $("#messagesGrid").innerHTML = state.messages.length
    ? state.messages.map((item) => {
        const d = item.data;

        return `
          <article class="moderation-card">
            <span class="status-pill ${d.approved === true ? "approved" : "pending"}">
              ${d.approved === true ? "Aprovado" : "Pendente"}
            </span>
            <h3>${escapeHtml(d.name || "Sem nome")}</h3>
            <small>${formatDate(d.createdAt)}</small>
            <div class="message-body">“${escapeHtml(d.message || "")}”</div>
            <div class="card-actions">
              ${
                d.approved === true
                  ? `<button class="icon-button hide-message" data-id="${item.id}" type="button">Ocultar</button>`
                  : `<button class="icon-button primary approve-message" data-id="${item.id}" type="button">Aprovar</button>`
              }
              <button class="icon-button danger delete-message" data-id="${item.id}" type="button">Excluir</button>
            </div>
          </article>
        `;
      }).join("")
    : '<p class="empty-copy">Nenhum recadinho recebido.</p>';
}

function renderGallery() {
  const term = normalizeSearch($("#gallerySearch").value);
  const status = $("#galleryStatusFilter").value;

  const filtered = state.gallery
    .filter((item) => {
      const d = item.data;
      const searchable = normalizeSearch([
        d.title, d.caption, d.submittedBy, d.album
      ].join(" "));

      const statusMatch =
        status === "all" ||
        (status === "pending" && d.approved !== true) ||
        (status === "published" && d.published === true) ||
        (status === "hidden" && d.published !== true) ||
        (status === "featured" && d.featured === true);

      return (!term || searchable.includes(term)) && statusMatch;
    })
    .sort((a, b) => Number(a.data.order ?? 9999) - Number(b.data.order ?? 9999));

  $("#galleryTotalCount").textContent = state.gallery.length;
  $("#galleryPublishedCount").textContent = state.gallery.filter((item) => item.data.published === true).length;
  $("#galleryPendingCount").textContent = state.gallery.filter((item) => item.data.approved !== true).length;
  $("#galleryFeaturedCount").textContent = state.gallery.filter((item) => item.data.featured === true).length;

  $("#galleryGrid").innerHTML = filtered.length
    ? filtered.map((item) => {
        const d = item.data;
        const image = safeImage(d.imageData || d.imageUrl || "");

        return `
          <article class="gallery-card">
            ${image ? `<img src="${image}" alt="${escapeHtml(d.title || "Foto")}">` : ""}
            <div class="gallery-status-row">
              <span class="status-pill ${d.approved === true ? "approved" : "pending"}">
                ${d.approved === true ? "Aprovada" : "Pendente"}
              </span>
              <span class="status-pill ${d.published === true ? "published" : "inactive"}">
                ${d.published === true ? "Publicada" : "Oculta"}
              </span>
            </div>
            <h3>${escapeHtml(d.title || "Foto sem título")}</h3>
            <p>${escapeHtml(d.caption || "Sem legenda.")}</p>
            <small>${escapeHtml(d.submittedBy || "Convidado")}</small>
            <div class="card-actions">
              <button class="icon-button edit-photo" data-id="${item.id}" type="button">Editar</button>
              ${
                d.approved === true
                  ? `<button class="icon-button unapprove-photo" data-id="${item.id}" type="button">Desaprovar</button>`
                  : `<button class="icon-button primary approve-photo" data-id="${item.id}" type="button">Aprovar</button>`
              }
              <button class="icon-button toggle-photo" data-id="${item.id}" data-published="${d.published === true}" type="button">
                ${d.published === true ? "Ocultar" : "Publicar"}
              </button>
              <button class="icon-button danger delete-photo" data-id="${item.id}" type="button">Excluir</button>
            </div>
          </article>
        `;
      }).join("")
    : '<p class="empty-copy">Nenhuma foto encontrada.</p>';
}

function renderAll() {
  renderDashboard();
  renderGuests();
  renderInvites();
  renderGifts();
  renderSelections();
  renderMessages();
  renderGallery();
}

function subscribeCollection(name, callback) {
  const unsubscribe = onSnapshot(
    query(collection(db, name)),
    (snapshot) => {
      callback(
        snapshot.docs.map((document) => ({
          id: document.id,
          data: document.data()
        }))
      );

      renderAll();
    },
    (error) => {
      console.error(`[ADMIN] Erro em ${name}:`, error);
    }
  );

  state.unsubs.push(unsubscribe);
}

function startListeners() {
  if (state.started) return;
  state.started = true;

  subscribeCollection("rsvps", (items) => state.rsvps = items);
  subscribeCollection("invitationGuests", (items) => state.invitationGuests = items);
  subscribeCollection("gifts", (items) => state.gifts = items);
  subscribeCollection("giftSelections", (items) => state.selections = items);
  subscribeCollection("messages", (items) => state.messages = items);
  subscribeCollection("gallery", (items) => state.gallery = items);
}

function askConfirmation({ title, message, action }) {
  $("#confirmDialogTitle").textContent = title;
  $("#confirmDialogMessage").textContent = message;
  state.confirmAction = action;
  $("#confirmDialog").showModal();
}

async function runConfirmation() {
  if (typeof state.confirmAction !== "function") return;

  $("#acceptConfirm").disabled = true;

  try {
    await state.confirmAction();
    $("#confirmDialog").close();
  } catch (error) {
    console.error("[ADMIN] Falha na ação:", error);
  } finally {
    $("#acceptConfirm").disabled = false;
    state.confirmAction = null;
  }
}

function compressImage(file, maxWidth = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("READ_ERROR"));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("IMAGE_ERROR"));

      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        canvas.getContext("2d").drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

/* NAV */
navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const section = item.dataset.section;
    if (!section) return;

    if (section === "guests") {
      $("#guestStatusFilter").value = "confirmed";
      $("#guestEventFilter").value = "all";
      $("#guestSearch").value = "";
      renderGuests();
    }

    openSection(section);
  });
});

$("#sidebarToggle").addEventListener("click", () => {
  const open = !$("#sidebar").classList.contains("open");
  $("#sidebar").classList.toggle("open", open);
  $("#sidebarToggle").setAttribute("aria-expanded", String(open));
});

$("#syncButton").addEventListener("click", () => {
  $("#syncButton").classList.add("is-syncing");
  renderAll();
  setTimeout(() => $("#syncButton").classList.remove("is-syncing"), 500);
});

$("#settingsSyncButton").addEventListener("click", renderAll);

$("#kpiConfirmedCard").addEventListener("click", () => {
  $("#guestStatusFilter").value = "confirmed";
  openSection("guests");
  renderGuests();
});

$("#kpiWaitingCard").addEventListener("click", () => {
  $("#inviteStatusFilter").value = "waiting";
  openSection("invites");
  renderInvites();
});

/* FILTROS */
["#guestSearch", "#guestEventFilter", "#guestStatusFilter"].forEach((selector) => {
  $(selector).addEventListener("input", renderGuests);
  $(selector).addEventListener("change", renderGuests);
});

["#inviteSearch", "#inviteEventFilter", "#inviteStatusFilter"].forEach((selector) => {
  $(selector).addEventListener("input", renderInvites);
  $(selector).addEventListener("change", renderInvites);
});

["#giftSearch", "#giftStatusFilter"].forEach((selector) => {
  $(selector).addEventListener("input", renderGifts);
  $(selector).addEventListener("change", renderGifts);
});

$("#selectionSearch").addEventListener("input", renderSelections);
$("#gallerySearch").addEventListener("input", renderGallery);
$("#galleryStatusFilter").addEventListener("change", renderGallery);

/* TEMPLATES */
$("#inviteTemplate").value = getInviteTemplate();
$("#reminderTemplate").value = getReminderTemplate();

$("#saveInviteTemplate").addEventListener("click", () => {
  localStorage.setItem(
    "iuna-invitation-template",
    $("#inviteTemplate").value.trim() || DEFAULT_INVITE_TEMPLATE
  );
});

$("#restoreInviteTemplate").addEventListener("click", () => {
  $("#inviteTemplate").value = DEFAULT_INVITE_TEMPLATE;
  localStorage.setItem("iuna-invitation-template", DEFAULT_INVITE_TEMPLATE);
});

$("#saveReminderTemplate").addEventListener("click", () => {
  localStorage.setItem(
    "iuna-reminder-template",
    $("#reminderTemplate").value.trim() || DEFAULT_REMINDER_TEMPLATE
  );
});

$("#restoreReminderTemplate").addEventListener("click", () => {
  $("#reminderTemplate").value = DEFAULT_REMINDER_TEMPLATE;
  localStorage.setItem("iuna-reminder-template", DEFAULT_REMINDER_TEMPLATE);
});

/* CONVITES */
function openInviteGuestForm(item = null) {
  $("#inviteGuestForm").reset();
  $("#inviteGuestFeedback").textContent = "";

  if (item) {
    $("#inviteGuestDialogTitle").textContent = "Editar convidado";
    $("#inviteGuestId").value = item.id;
    $("#inviteGuestName").value = item.data.name || "";
    $("#inviteGuestPhone").value = item.data.phone || "";
    $("#inviteGuestGroup").value = item.data.group || "Família";
    $("#inviteGuestEvent").value = item.data.eventId || "bage";
    $("#inviteGuestPeople").value = Number(item.data.peopleCount || 1);
    $("#inviteGuestAdults").value = Number(item.data.adults || 0);
    $("#inviteGuestChildren").value = Number(item.data.children || 0);
    $("#inviteGuestNotes").value = item.data.notes || "";
  } else {
    $("#inviteGuestDialogTitle").textContent = "Adicionar convidado";
    $("#inviteGuestId").value = "";
    $("#inviteGuestGroup").value = "Família";
    $("#inviteGuestEvent").value = "bage";
    $("#inviteGuestPeople").value = 1;
    $("#inviteGuestAdults").value = 1;
    $("#inviteGuestChildren").value = 0;
  }

  $("#inviteGuestDialog").showModal();
}

$("#newInviteGuestButton").addEventListener("click", () => openInviteGuestForm());
$("#closeInviteGuestDialog").addEventListener("click", () => $("#inviteGuestDialog").close());

$("#inviteGuestForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = $("#inviteGuestId").value;
  const name = normalizeText($("#inviteGuestName").value);
  const phone = normalizeText($("#inviteGuestPhone").value);

  if (name.length < 2 || normalizePhone(phone).length < 12) {
    $("#inviteGuestFeedback").textContent = "Informe nome e WhatsApp válidos.";
    return;
  }

  const payload = {
    name,
    phone,
    phoneDigits: normalizePhone(phone),
    group: $("#inviteGuestGroup").value,
    eventId: $("#inviteGuestEvent").value,
    peopleCount: Math.max(1, Number($("#inviteGuestPeople").value || 1)),
    adults: Math.max(0, Number($("#inviteGuestAdults").value || 0)),
    children: Math.max(0, Number($("#inviteGuestChildren").value || 0)),
    notes: normalizeText($("#inviteGuestNotes").value),
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "invitationGuests", id), payload);
    } else {
      await addDoc(collection(db, "invitationGuests"), {
        ...payload,
        invitationStatus: "pending",
        confirmationStatus: "waiting",
        invitationSentAt: null,
        createdAt: serverTimestamp()
      });
    }

    $("#inviteGuestDialog").close();
  } catch (error) {
    console.error(error);
    $("#inviteGuestFeedback").textContent = "Não foi possível salvar.";
  }
});

function openMessageDialog(item, mode = "invite") {
  state.currentMessageGuest = item;
  state.currentMessageMode = mode;

  $("#messageDialogEyebrow").textContent =
    mode === "reminder" ? "Lembrete de confirmação" : "Convite personalizado";

  $("#messageDialogTitle").textContent =
    `${mode === "reminder" ? "Lembrete para" : "Convite para"} ${item.data.name || "convidado"}`;

  $("#messagePreview").value = createMessage(item.data, item.id, mode);
  $("#messageDialog").showModal();
}

$("#closeMessageDialog").addEventListener("click", () => $("#messageDialog").close());

$("#copyMessageButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#messagePreview").value);
    $("#copyMessageButton").textContent = "Copiado";
    setTimeout(() => $("#copyMessageButton").textContent = "Copiar", 1200);
  } catch {
    $("#copyMessageButton").textContent = "Selecione e copie";
  }
});

$("#openWhatsappButton").addEventListener("click", async () => {
  const item = state.currentMessageGuest;
  if (!item) return;

  const phone = normalizePhone(item.data.phoneDigits || item.data.phone);
  const message = $("#messagePreview").value.trim();

  if (!phone) return;

  const payload = {
    invitationStatus: "sent",
    updatedAt: serverTimestamp()
  };

  if (state.currentMessageMode === "reminder") {
    payload.lastReminderAt = serverTimestamp();
    payload.lastReminderMessage = message;
    payload.reminderCount = Number(item.data.reminderCount || 0) + 1;
  } else {
    payload.invitationSentAt = serverTimestamp();
    payload.lastInvitationMessage = message;
  }

  await updateDoc(doc(db, "invitationGuests", item.id), payload);

  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener"
  );

  $("#messageDialog").close();
});

$("#invitesTableBody").addEventListener("click", (event) => {
  const whatsapp = event.target.closest(".invite-whatsapp");
  const reminder = event.target.closest(".invite-reminder");
  const edit = event.target.closest(".edit-invite");
  const remove = event.target.closest(".delete-invite");

  const id =
    whatsapp?.dataset.id ||
    reminder?.dataset.id ||
    edit?.dataset.id ||
    remove?.dataset.id;

  if (!id) return;

  const item = state.invitationGuests.find((guest) => guest.id === id);
  if (!item) return;

  if (whatsapp) openMessageDialog(item, "invite");

  if (reminder) {
    const status = getEffectiveInvite(item).confirmationStatus || "waiting";

    if (status !== "waiting") {
      alert(`${item.data.name || "Este convidado"} já respondeu.`);
      return;
    }

    openMessageDialog(item, "reminder");
  }

  if (edit) openInviteGuestForm(item);

  if (remove) {
    askConfirmation({
      title: "Excluir convidado?",
      message: `O convidado “${item.data.name || "Sem nome"}” será removido da lista.`,
      action: () => deleteDoc(doc(db, "invitationGuests", id))
    });
  }
});

/* GUEST RSVP DELETE */
$("#guestsTableBody").addEventListener("click", (event) => {
  const button = event.target.closest(".delete-rsvp");
  if (!button) return;

  askConfirmation({
    title: "Excluir confirmação?",
    message: `A confirmação de ${button.dataset.name} será removida.`,
    action: () => deleteDoc(doc(db, "rsvps", button.dataset.id))
  });
});

/* PRESENTES */
function openGiftForm(item = null) {
  $("#giftForm").reset();
  state.currentGiftImageData = "";
  $("#giftFeedback").textContent = "";
  $("#giftImagePreviewWrap").hidden = true;

  if (item) {
    const d = item.data;

    $("#giftDialogTitle").textContent = "Editar presente";
    $("#giftId").value = item.id;
    $("#giftName").value = d.name || d.title || "";
    $("#giftCategory").value = d.category || "";
    $("#giftQuantity").value = getGiftTotal(d) || 1;
    $("#giftDescription").value = d.description || "";
    $("#giftActive").checked = d.active === true;

    state.currentGiftImageData = d.imageData || "";

    if (state.currentGiftImageData) {
      $("#giftImagePreview").src = state.currentGiftImageData;
      $("#giftImagePreviewWrap").hidden = false;
    }
  } else {
    $("#giftDialogTitle").textContent = "Cadastrar presente";
    $("#giftId").value = "";
    $("#giftQuantity").value = 1;
    $("#giftActive").checked = true;
  }

  $("#giftDialog").showModal();
}

$("#newGiftButton").addEventListener("click", () => openGiftForm());
$("#closeGiftDialog").addEventListener("click", () => $("#giftDialog").close());

$("#giftImage").addEventListener("change", async () => {
  const file = $("#giftImage").files?.[0];
  if (!file) return;

  state.currentGiftImageData = await compressImage(file);
  $("#giftImagePreview").src = state.currentGiftImageData;
  $("#giftImagePreviewWrap").hidden = false;
});

$("#removeGiftImage").addEventListener("click", () => {
  state.currentGiftImageData = "";
  $("#giftImage").value = "";
  $("#giftImagePreviewWrap").hidden = true;
});

$("#giftForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = $("#giftId").value;
  const name = normalizeText($("#giftName").value);
  const quantity = Math.max(1, Number($("#giftQuantity").value || 1));

  const current = state.gifts.find((item) => item.id === id);
  const reservedQuantity = current ? getGiftReserved(current.data) : 0;

  if (quantity < reservedQuantity) {
    $("#giftFeedback").textContent =
      "A quantidade total não pode ser menor que o número já escolhido.";
    return;
  }

  const payload = {
    name,
    category: $("#giftCategory").value,
    quantity,
    reservedQuantity,
    description: normalizeText($("#giftDescription").value),
    imageData: state.currentGiftImageData,
    active: $("#giftActive").checked,
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "gifts", id), payload);
    } else {
      await addDoc(collection(db, "gifts"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    $("#giftDialog").close();
  } catch (error) {
    console.error(error);
    $("#giftFeedback").textContent = "Não foi possível salvar.";
  }
});

$("#giftsGrid").addEventListener("click", async (event) => {
  const edit = event.target.closest(".edit-gift");
  const toggle = event.target.closest(".toggle-gift");
  const remove = event.target.closest(".delete-gift");

  if (edit) {
    const item = state.gifts.find((gift) => gift.id === edit.dataset.id);
    if (item) openGiftForm(item);
  }

  if (toggle) {
    await updateDoc(doc(db, "gifts", toggle.dataset.id), {
      active: toggle.dataset.active !== "true",
      updatedAt: serverTimestamp()
    });
  }

  if (remove) {
    askConfirmation({
      title: "Excluir presente?",
      message: `O item “${remove.dataset.name}” será removido.`,
      action: () => deleteDoc(doc(db, "gifts", remove.dataset.id))
    });
  }
});

/* MENSAGENS */
$("#messagesGrid").addEventListener("click", async (event) => {
  const approve = event.target.closest(".approve-message");
  const hide = event.target.closest(".hide-message");
  const remove = event.target.closest(".delete-message");

  if (approve) {
    await updateDoc(doc(db, "messages", approve.dataset.id), {
      approved: true,
      updatedAt: serverTimestamp()
    });
  }

  if (hide) {
    await updateDoc(doc(db, "messages", hide.dataset.id), {
      approved: false,
      updatedAt: serverTimestamp()
    });
  }

  if (remove) {
    askConfirmation({
      title: "Excluir recadinho?",
      message: "O recadinho será removido definitivamente.",
      action: () => deleteDoc(doc(db, "messages", remove.dataset.id))
    });
  }
});

/* GALERIA */
function openPhotoForm(item = null) {
  $("#photoForm").reset();
  state.currentPhotoImageData = "";
  $("#photoFeedback").textContent = "";
  $("#photoImagePreviewWrap").hidden = true;

  if (item) {
    const d = item.data;

    $("#photoDialogTitle").textContent = "Editar foto";
    $("#photoId").value = item.id;
    $("#photoTitle").value = d.title || "";
    $("#photoCaption").value = d.caption || "";
    $("#photoAlbum").value = d.album || "Preparativos";
    $("#photoSubmittedBy").value = d.submittedBy || "";
    $("#photoApproved").checked = d.approved === true;
    $("#photoPublished").checked = d.published === true;
    $("#photoFeatured").checked = d.featured === true;

    state.currentPhotoImageData = d.imageData || d.imageUrl || "";

    if (state.currentPhotoImageData) {
      $("#photoImagePreview").src = state.currentPhotoImageData;
      $("#photoImagePreviewWrap").hidden = false;
    }
  } else {
    $("#photoDialogTitle").textContent = "Adicionar foto";
    $("#photoId").value = "";
    $("#photoAlbum").value = "Preparativos";
    $("#photoApproved").checked = true;
    $("#photoPublished").checked = true;
  }

  $("#photoDialog").showModal();
}

$("#newPhotoButton").addEventListener("click", () => openPhotoForm());
$("#closePhotoDialog").addEventListener("click", () => $("#photoDialog").close());

$("#photoImage").addEventListener("change", async () => {
  const file = $("#photoImage").files?.[0];
  if (!file) return;

  state.currentPhotoImageData = await compressImage(file, 1400, 0.8);
  $("#photoImagePreview").src = state.currentPhotoImageData;
  $("#photoImagePreviewWrap").hidden = false;
});

$("#removePhotoImage").addEventListener("click", () => {
  state.currentPhotoImageData = "";
  $("#photoImage").value = "";
  $("#photoImagePreviewWrap").hidden = true;
});

$("#photoForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = $("#photoId").value;
  const title = normalizeText($("#photoTitle").value);

  if (!title) {
    $("#photoFeedback").textContent = "Informe um título.";
    return;
  }

  if (!state.currentPhotoImageData) {
    $("#photoFeedback").textContent = "Escolha uma imagem.";
    return;
  }

  const payload = {
    title,
    caption: normalizeText($("#photoCaption").value),
    album: $("#photoAlbum").value,
    submittedBy: normalizeText($("#photoSubmittedBy").value),
    imageData: state.currentPhotoImageData,
    approved: $("#photoApproved").checked,
    published: $("#photoPublished").checked,
    featured: $("#photoFeatured").checked,
    active: $("#photoPublished").checked,
    updatedAt: serverTimestamp()
  };

  if (id) {
    await updateDoc(doc(db, "gallery", id), payload);
  } else {
    await addDoc(collection(db, "gallery"), {
      ...payload,
      order: state.gallery.length,
      createdAt: serverTimestamp()
    });
  }

  $("#photoDialog").close();
});

$("#galleryGrid").addEventListener("click", async (event) => {
  const edit = event.target.closest(".edit-photo");
  const approve = event.target.closest(".approve-photo");
  const unapprove = event.target.closest(".unapprove-photo");
  const toggle = event.target.closest(".toggle-photo");
  const remove = event.target.closest(".delete-photo");

  if (edit) {
    const item = state.gallery.find((photo) => photo.id === edit.dataset.id);
    if (item) openPhotoForm(item);
  }

  if (approve) {
    await updateDoc(doc(db, "gallery", approve.dataset.id), {
      approved: true,
      updatedAt: serverTimestamp()
    });
  }

  if (unapprove) {
    await updateDoc(doc(db, "gallery", unapprove.dataset.id), {
      approved: false,
      published: false,
      active: false,
      updatedAt: serverTimestamp()
    });
  }

  if (toggle) {
    const published = toggle.dataset.published !== "true";

    const payload = {
      published,
      active: published,
      updatedAt: serverTimestamp()
    };

    if (published) {
      payload.approved = true;
    }

    await updateDoc(
      doc(db, "gallery", toggle.dataset.id),
      payload
    );
  }

  if (remove) {
    askConfirmation({
      title: "Excluir foto?",
      message: "A imagem será removida definitivamente.",
      action: () => deleteDoc(doc(db, "gallery", remove.dataset.id))
    });
  }
});

/* CONFIRM DIALOG */
$("#cancelConfirm").addEventListener("click", () => {
  $("#confirmDialog").close();
  state.confirmAction = null;
});

$("#acceptConfirm").addEventListener("click", runConfirmation);

/* AUTH READY */
window.addEventListener("iuna-admin-ready", (event) => {
  updateProfile(event.detail);
  startListeners();
});

if (window.__IUNA_ADMIN__) {
  updateProfile(window.__IUNA_ADMIN__);
  startListeners();
}

window.addEventListener("beforeunload", () => {
  state.unsubs.forEach((unsubscribe) => {
    if (typeof unsubscribe === "function") unsubscribe();
  });
});
