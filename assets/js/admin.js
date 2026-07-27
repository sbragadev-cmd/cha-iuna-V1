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

const SECTION_META = {
  dashboard: ["Área dos Pais", "Visão geral"],
  guests: ["Organização dos eventos", "Convidados"],
  gifts: ["Lista de presentes", "Presentes"],
  giftSelections: ["Escolhas dos convidados", "Presentes escolhidos"],
  messages: ["Moderação", "Recadinhos"],
  gallery: ["Moderação", "Galeria"],
  events: ["Informações oficiais", "Eventos"]
};

const state = {
  rsvps: [],
  gifts: [],
  selections: [],
  messages: [],
  gallery: [],
  unsubs: [],
  currentGiftImageData: "",
  confirmAction: null
};

const navItems = [...document.querySelectorAll(".nav-item")];
const sections = [...document.querySelectorAll(".admin-section")];
const sectionEyebrow = document.querySelector("#sectionEyebrow");
const sectionTitle = document.querySelector("#sectionTitle");
const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebarToggle");
const syncButton = document.querySelector("#syncButton");

const profileName = document.querySelector("#profileName");
const profileRole = document.querySelector("#profileRole");
const profileAvatar = document.querySelector("#profileAvatar");

const guestSearch = document.querySelector("#guestSearch");
const guestEventFilter = document.querySelector("#guestEventFilter");
const guestStatusFilter = document.querySelector("#guestStatusFilter");
const guestsTableBody = document.querySelector("#guestsTableBody");

const giftAdminSearch = document.querySelector("#giftAdminSearch");
const giftAdminStatusFilter = document.querySelector("#giftAdminStatusFilter");
const adminGiftsGrid = document.querySelector("#adminGiftsGrid");

const selectionSearch = document.querySelector("#selectionSearch");
const giftSelectionsTableBody = document.querySelector("#giftSelectionsTableBody");

const messagesGrid = document.querySelector("#messagesGrid");
const galleryAdminGrid = document.querySelector("#galleryAdminGrid");

const giftDialog = document.querySelector("#giftDialog");
const giftForm = document.querySelector("#giftForm");
const newGiftButton = document.querySelector("#newGiftButton");
const closeGiftDialog = document.querySelector("#closeGiftDialog");
const giftDialogTitle = document.querySelector("#giftDialogTitle");
const giftIdInput = document.querySelector("#giftId");
const giftNameInput = document.querySelector("#giftName");
const giftCategoryInput = document.querySelector("#giftCategory");
const giftQuantityInput = document.querySelector("#giftQuantity");
const giftDescriptionInput = document.querySelector("#giftDescription");
const giftImageInput = document.querySelector("#giftImage");
const giftActiveInput = document.querySelector("#giftActive");
const giftImagePreviewWrap = document.querySelector("#giftImagePreviewWrap");
const giftImagePreview = document.querySelector("#giftImagePreview");
const removeGiftImage = document.querySelector("#removeGiftImage");
const giftFormFeedback = document.querySelector("#giftFormFeedback");

const confirmDialog = document.querySelector("#confirmDialog");
const confirmDialogTitle = document.querySelector("#confirmDialogTitle");
const confirmDialogMessage = document.querySelector("#confirmDialogMessage");
const cancelConfirm = document.querySelector("#cancelConfirm");
const acceptConfirm = document.querySelector("#acceptConfirm");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
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

function getGiftTotal(gift) {
  return Math.max(0, Number(gift.quantity ?? gift.totalQuantity ?? 0));
}

function getGiftReserved(gift) {
  return Math.max(0, Number(gift.reservedQuantity ?? 0));
}

function getGiftAvailable(gift) {
  return Math.max(0, getGiftTotal(gift) - getGiftReserved(gift));
}

function safeImage(value = "") {
  const source = String(value).trim();

  if (
    source.startsWith("data:image/jpeg;base64,") ||
    source.startsWith("data:image/png;base64,") ||
    source.startsWith("data:image/webp;base64,") ||
    source.startsWith("https://")
  ) {
    return source;
  }

  return "";
}

function updateProfile(detail) {
  const user = detail?.user;
  const admin = detail?.admin ?? {};

  const name =
    admin.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Pais da Iúna";

  const roleLabels = {
    owner: "Proprietário",
    admin: "Administrador",
    editor: "Editor"
  };

  profileName.textContent = name;
  profileRole.textContent = roleLabels[admin.role] ?? "Administrador";
  profileAvatar.textContent = name.charAt(0).toUpperCase();
}

function openSection(sectionId) {
  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.section === sectionId);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === `section-${sectionId}`);
  });

  const [eyebrow, title] = SECTION_META[sectionId] ?? SECTION_META.dashboard;
  sectionEyebrow.textContent = eyebrow;
  sectionTitle.textContent = title;

  sidebar.classList.remove("open");
  sidebarToggle.setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDashboard() {
  const confirmed = state.rsvps.filter(
    (item) => item.data.attendanceStatus === "confirmed"
  );

  const totalPeople = confirmed.reduce(
    (sum, item) => sum + Number(item.data.totalGuests ?? 0),
    0
  );

  const giftUnitsSelected = state.gifts.reduce(
    (sum, item) => sum + getGiftReserved(item.data),
    0
  );

  const pendingMessages = state.messages.filter(
    (item) => item.data.approved !== true
  ).length;

  const pendingGallery = state.gallery.filter(
    (item) => item.data.approved !== true
  ).length;

  document.querySelector("#kpiRsvps").textContent = state.rsvps.length;
  document.querySelector("#kpiRsvpsDetail").textContent =
    `${totalPeople} pessoas confirmadas`;

  document.querySelector("#kpiGifts").textContent = state.gifts.length;
  document.querySelector("#kpiGiftsDetail").textContent =
    `${giftUnitsSelected} unidades escolhidas`;

  document.querySelector("#kpiMessages").textContent = pendingMessages;
  document.querySelector("#kpiGallery").textContent = pendingGallery;

  document.querySelector("#guestsBadge").textContent = state.rsvps.length;
  document.querySelector("#giftSelectionsBadge").textContent = state.selections.length;
  document.querySelector("#messagesBadge").textContent = pendingMessages;
  document.querySelector("#galleryBadge").textContent = pendingGallery;

  ["bage", "porto-alegre"].forEach((eventId) => {
    const eventConfirmed = confirmed.filter(
      (item) => item.data.eventId === eventId
    );

    const adults = eventConfirmed.reduce(
      (sum, item) => sum + Number(item.data.adults ?? 0),
      0
    );

    const children = eventConfirmed.reduce(
      (sum, item) => sum + Number(item.data.children ?? 0),
      0
    );

    const prefix = eventId === "bage" ? "bage" : "poa";

    document.querySelector(`#${prefix}People`).textContent = adults + children;
    document.querySelector(`#${prefix}Adults`).textContent = adults;
    document.querySelector(`#${prefix}Children`).textContent = children;
  });

  renderActivity();
}

function renderActivity() {
  const activity = [
    ...state.rsvps.map((item) => ({
      type: "rsvp",
      icon: "👥",
      title: `${item.data.guestName ?? "Convidado"} respondeu ao convite`,
      detail:
        item.data.attendanceStatus === "confirmed"
          ? `Presença confirmada em ${item.data.eventLabel ?? "um evento"}`
          : "Informou que não poderá comparecer",
      date: item.data.createdAt
    })),
    ...state.selections.map((item) => ({
      type: "gift",
      icon: "🎁",
      title: `${item.data.giverName ?? "Convidado"} escolheu um presente`,
      detail: `${item.data.quantity ?? 1}x ${item.data.giftName ?? "Presente"}`,
      date: item.data.createdAt
    })),
    ...state.messages.map((item) => ({
      type: "message",
      icon: "✉",
      title: `${item.data.name ?? "Convidado"} enviou um recadinho`,
      detail: item.data.approved ? "Recadinho aprovado" : "Aguardando aprovação",
      date: item.data.createdAt
    }))
  ]
    .sort((a, b) => {
      const dateA = timestampToDate(a.date)?.getTime() ?? 0;
      const dateB = timestampToDate(b.date)?.getTime() ?? 0;
      return dateB - dateA;
    })
    .slice(0, 7);

  const container = document.querySelector("#activityList");

  if (!activity.length) {
    container.innerHTML = '<p class="empty-copy">As atividades aparecerão aqui.</p>';
    return;
  }

  container.innerHTML = activity
    .map((item) => `
      <article class="activity-item">
        <span class="activity-dot">${item.icon}</span>
        <div>
          <p><strong>${escapeHtml(item.title)}</strong></p>
          <small>${escapeHtml(item.detail)} • ${formatDate(item.date)}</small>
        </div>
      </article>
    `)
    .join("");
}

function renderGuests() {
  const term = normalizeText(guestSearch.value).toLowerCase();
  const eventFilter = guestEventFilter.value;
  const statusFilter = guestStatusFilter.value;

  const filtered = state.rsvps.filter(({ data, id }) => {
    const searchable = [
      data.guestName,
      data.phone,
      data.phoneDigits,
      data.protocol,
      id
    ]
      .map((value) => normalizeText(value).toLowerCase())
      .join(" ");

    return (
      (!term || searchable.includes(term)) &&
      (eventFilter === "all" || data.eventId === eventFilter) &&
      (statusFilter === "all" || data.attendanceStatus === statusFilter)
    );
  });

  if (!filtered.length) {
    guestsTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="table-empty">Nenhum convidado encontrado.</td>
      </tr>
    `;
    return;
  }

  guestsTableBody.innerHTML = filtered
    .map(({ id, data }) => `
      <tr>
        <td>
          <span class="person-cell">
            <strong>${escapeHtml(data.guestName ?? "Sem nome")}</strong>
            <small>${escapeHtml(data.relationship ?? "")}</small>
          </span>
        </td>
        <td>${escapeHtml(data.eventLabel ?? data.eventId ?? "—")}</td>
        <td>
          <span class="status-pill ${data.attendanceStatus}">
            ${data.attendanceStatus === "confirmed" ? "Confirmado" : "Não poderá ir"}
          </span>
        </td>
        <td>${Number(data.adults ?? 0)}</td>
        <td>${Number(data.children ?? 0)}</td>
        <td><strong>${Number(data.totalGuests ?? 0)}</strong></td>
        <td>${escapeHtml(data.phone ?? "—")}</td>
        <td><code>${escapeHtml(data.protocol ?? id)}</code></td>
        <td>
          <div class="table-actions">
            <a
              class="icon-button"
              href="https://wa.me/55${escapeHtml(data.phoneDigits ?? "")}"
              target="_blank"
              rel="noopener"
            >
              WhatsApp
            </a>
            <button
              class="icon-button danger delete-rsvp"
              type="button"
              data-id="${escapeHtml(id)}"
              data-name="${escapeHtml(data.guestName ?? "convidado")}"
            >
              Excluir
            </button>
          </div>
        </td>
      </tr>
    `)
    .join("");
}

function renderAdminGifts() {
  const term = normalizeText(giftAdminSearch.value).toLowerCase();
  const status = giftAdminStatusFilter.value;

  const filtered = state.gifts.filter(({ data }) => {
    const searchable = [
      data.name,
      data.title,
      data.category,
      data.description
    ]
      .map((value) => normalizeText(value).toLowerCase())
      .join(" ");

    const available = getGiftAvailable(data);

    const matchesStatus =
      status === "all" ||
      (status === "active" && data.active === true) ||
      (status === "inactive" && data.active !== true) ||
      (status === "available" && available > 0) ||
      (status === "finished" && available <= 0);

    return (!term || searchable.includes(term)) && matchesStatus;
  });

  if (!filtered.length) {
    adminGiftsGrid.innerHTML =
      '<p class="empty-copy">Nenhum presente encontrado.</p>';
    return;
  }

  adminGiftsGrid.innerHTML = filtered
    .map(({ id, data }) => {
      const total = getGiftTotal(data);
      const reserved = getGiftReserved(data);
      const available = getGiftAvailable(data);
      const image = safeImage(data.imageData ?? data.imageUrl ?? "");

      return `
        <article class="admin-gift-card">
          <div class="admin-gift-image">
            ${
              image
                ? `<img src="${image}" alt="${escapeHtml(data.name ?? "Presente")}">`
                : "♡"
            }
          </div>

          <div class="admin-gift-content">
            <div class="admin-gift-top">
              <div>
                <span class="status-pill ${data.active === true ? "active" : "inactive"}">
                  ${data.active === true ? "Ativo" : "Inativo"}
                </span>
                <h3>${escapeHtml(data.name ?? data.title ?? "Presente")}</h3>
              </div>
            </div>

            <p>${escapeHtml(data.description ?? "Sem descrição.")}</p>

            <div class="gift-counts">
              <span><b>${total}</b><small>Total</small></span>
              <span><b>${reserved}</b><small>Escolhidos</small></span>
              <span><b>${available}</b><small>Disponíveis</small></span>
            </div>

            <div class="card-actions">
              <button class="icon-button edit-gift" type="button" data-id="${escapeHtml(id)}">
                Editar
              </button>

              <button
                class="icon-button toggle-gift"
                type="button"
                data-id="${escapeHtml(id)}"
                data-active="${data.active === true}"
              >
                ${data.active === true ? "Desativar" : "Ativar"}
              </button>

              <button
                class="icon-button danger delete-gift"
                type="button"
                data-id="${escapeHtml(id)}"
                data-name="${escapeHtml(data.name ?? "presente")}"
              >
                Excluir
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSelections() {
  const term = normalizeText(selectionSearch.value).toLowerCase();

  const filtered = state.selections.filter(({ data }) => {
    const searchable = [
      data.giverName,
      data.giverPhone,
      data.giverPhoneDigits,
      data.giftName,
      data.giftCategory
    ]
      .map((value) => normalizeText(value).toLowerCase())
      .join(" ");

    return !term || searchable.includes(term);
  });

  if (!filtered.length) {
    giftSelectionsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">Nenhuma escolha registrada.</td>
      </tr>
    `;
    return;
  }

  giftSelectionsTableBody.innerHTML = filtered
    .map(({ data }) => `
      <tr>
        <td><strong>${escapeHtml(data.giverName ?? "Sem nome")}</strong></td>
        <td>${escapeHtml(data.giverPhone ?? "—")}</td>
        <td>
          <span class="person-cell">
            <strong>${escapeHtml(data.giftName ?? "Presente")}</strong>
            <small>${escapeHtml(data.giftCategory ?? "")}</small>
          </span>
        </td>
        <td><strong>${Number(data.quantity ?? 1)}</strong></td>
        <td>${escapeHtml(data.message ?? "—")}</td>
        <td>${formatDate(data.createdAt)}</td>
        <td><span class="status-pill selected">Escolhido</span></td>
      </tr>
    `)
    .join("");
}

function renderMessages() {
  if (!state.messages.length) {
    messagesGrid.innerHTML =
      '<p class="empty-copy">Nenhum recadinho recebido.</p>';
    return;
  }

  messagesGrid.innerHTML = state.messages
    .map(({ id, data }) => `
      <article class="moderation-card ${data.approved === true ? "" : "pending"}">
        <div class="moderation-content">
          <div class="moderation-top">
            <div>
              <span class="status-pill ${data.approved === true ? "approved" : "pending"}">
                ${data.approved === true ? "Aprovado" : "Pendente"}
              </span>
              <h3>${escapeHtml(data.name ?? "Sem nome")}</h3>
            </div>
            <small>${formatDate(data.createdAt)}</small>
          </div>

          <p>${escapeHtml(data.relationship ?? "")}</p>
          <div class="message-body">“${escapeHtml(data.message ?? "")}”</div>

          <div class="card-actions">
            ${
              data.approved === true
                ? `<button class="icon-button reject-message" data-id="${escapeHtml(id)}" type="button">Ocultar</button>`
                : `<button class="icon-button approve approve-message" data-id="${escapeHtml(id)}" type="button">Aprovar</button>`
            }

            <button
              class="icon-button danger delete-message"
              data-id="${escapeHtml(id)}"
              type="button"
            >
              Excluir
            </button>
          </div>
        </div>
      </article>
    `)
    .join("");
}

function renderGallery() {
  if (!state.gallery.length) {
    galleryAdminGrid.innerHTML =
      '<p class="empty-copy">Nenhuma foto recebida.</p>';
    return;
  }

  galleryAdminGrid.innerHTML = state.gallery
    .map(({ id, data }) => {
      const image = safeImage(data.imageData ?? "");

      return `
        <article class="gallery-admin-card ${data.approved === true ? "" : "pending"}">
          <div class="gallery-admin-image">
            ${image ? `<img src="${image}" alt="${escapeHtml(data.title ?? "Foto")}">` : "▧"}
          </div>

          <div class="gallery-admin-content">
            <div class="gallery-admin-top">
              <div>
                <span class="status-pill ${data.approved === true ? "approved" : "pending"}">
                  ${data.approved === true ? "Aprovada" : "Pendente"}
                </span>
                <h3>${escapeHtml(data.title ?? "Foto sem título")}</h3>
              </div>
            </div>

            <p>${escapeHtml(data.caption ?? "")}</p>
            <small>Enviada por ${escapeHtml(data.submittedBy ?? "convidado")}</small>

            <div class="card-actions">
              ${
                data.approved === true
                  ? `<button class="icon-button reject-photo" data-id="${escapeHtml(id)}" type="button">Ocultar</button>`
                  : `<button class="icon-button approve approve-photo" data-id="${escapeHtml(id)}" type="button">Aprovar</button>`
              }

              <button
                class="icon-button danger delete-photo"
                data-id="${escapeHtml(id)}"
                type="button"
              >
                Excluir
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAll() {
  renderDashboard();
  renderGuests();
  renderAdminGifts();
  renderSelections();
  renderMessages();
  renderGallery();
}

function subscribeCollection(name, orderField, callback) {
  const collectionQuery = query(
    collection(db, name),
    orderBy(orderField, "desc")
  );

  const unsubscribe = onSnapshot(
    collectionQuery,
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
      console.error(`[ADMIN] Erro ao escutar ${name}:`, error);
    }
  );

  state.unsubs.push(unsubscribe);
}

function startListeners() {
  subscribeCollection("rsvps", "createdAt", (items) => {
    state.rsvps = items;
  });

  subscribeCollection("gifts", "createdAt", (items) => {
    state.gifts = items;
  });

  subscribeCollection("giftSelections", "createdAt", (items) => {
    state.selections = items;
  });

  subscribeCollection("messages", "createdAt", (items) => {
    state.messages = items;
  });

  subscribeCollection("gallery", "createdAt", (items) => {
    state.gallery = items;
  });
}

function openGiftForm(gift = null) {
  giftForm.reset();
  giftFormFeedback.textContent = "";
  giftFormFeedback.className = "form-feedback";
  state.currentGiftImageData = "";

  if (gift) {
    giftDialogTitle.textContent = "Editar presente";
    giftIdInput.value = gift.id;
    giftNameInput.value = gift.data.name ?? gift.data.title ?? "";
    giftCategoryInput.value = gift.data.category ?? "";
    giftQuantityInput.value = getGiftTotal(gift.data) || 1;
    giftDescriptionInput.value = gift.data.description ?? "";
    giftActiveInput.checked = gift.data.active === true;
    state.currentGiftImageData = gift.data.imageData ?? "";

    if (state.currentGiftImageData) {
      giftImagePreview.src = state.currentGiftImageData;
      giftImagePreviewWrap.hidden = false;
    } else {
      giftImagePreviewWrap.hidden = true;
    }
  } else {
    giftDialogTitle.textContent = "Cadastrar presente";
    giftIdInput.value = "";
    giftQuantityInput.value = 1;
    giftActiveInput.checked = true;
    giftImagePreviewWrap.hidden = true;
  }

  giftDialog.showModal();
  document.body.classList.add("modal-open");
}

function closeGiftForm() {
  giftDialog.close();
  document.body.classList.remove("modal-open");
}

function compressImage(file, maxWidth = 1100, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("READ_ERROR"));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("IMAGE_ERROR"));

      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

async function saveGift(event) {
  event.preventDefault();

  const name = normalizeText(giftNameInput.value);
  const category = giftCategoryInput.value;
  const quantity = Number(giftQuantityInput.value);
  const giftId = giftIdInput.value;

  if (name.length < 2 || !category || quantity < 1) {
    giftFormFeedback.textContent = "Preencha os campos obrigatórios.";
    giftFormFeedback.classList.add("is-error");
    return;
  }

  const submitButton = giftForm.querySelector('button[type="submit"]');
  const buttonText = submitButton.querySelector(".button-text");
  const buttonLoading = submitButton.querySelector(".button-loading");

  submitButton.disabled = true;
  buttonText.hidden = true;
  buttonLoading.hidden = false;

  try {
    const currentGift = state.gifts.find((item) => item.id === giftId);
    const reservedQuantity = currentGift
      ? getGiftReserved(currentGift.data)
      : 0;

    if (quantity < reservedQuantity) {
      throw new Error("QUANTITY_BELOW_RESERVED");
    }

    const payload = {
      name,
      category,
      quantity,
      reservedQuantity,
      description: normalizeText(giftDescriptionInput.value),
      imageData: state.currentGiftImageData,
      active: giftActiveInput.checked,
      updatedAt: serverTimestamp()
    };

    if (giftId) {
      await updateDoc(doc(db, "gifts", giftId), payload);
    } else {
      await addDoc(collection(db, "gifts"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    closeGiftForm();
  } catch (error) {
    console.error("[ADMIN GIFTS] Erro ao salvar:", error);

    giftFormFeedback.textContent =
      error.message === "QUANTITY_BELOW_RESERVED"
        ? "A quantidade total não pode ser menor que o número já escolhido."
        : "Não foi possível salvar o presente.";
    giftFormFeedback.classList.add("is-error");
  } finally {
    submitButton.disabled = false;
    buttonText.hidden = false;
    buttonLoading.hidden = true;
  }
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
  } catch (error) {
    console.error("[ADMIN] Falha na ação confirmada:", error);
  } finally {
    acceptConfirm.disabled = false;
  }
}

async function updateModeration(collectionName, id, approved) {
  await updateDoc(doc(db, collectionName, id), {
    approved,
    active: true,
    updatedAt: serverTimestamp()
  });
}

function refreshVisualState() {
  syncButton.classList.add("is-syncing");
  renderAll();

  window.setTimeout(() => {
    syncButton.classList.remove("is-syncing");
  }, 700);
}

navItems.forEach((item) => {
  item.addEventListener("click", () => openSection(item.dataset.section));
});

sidebarToggle.addEventListener("click", () => {
  const willOpen = !sidebar.classList.contains("open");
  sidebar.classList.toggle("open", willOpen);
  sidebarToggle.setAttribute("aria-expanded", String(willOpen));
});

syncButton.addEventListener("click", refreshVisualState);

guestSearch.addEventListener("input", renderGuests);
guestEventFilter.addEventListener("change", renderGuests);
guestStatusFilter.addEventListener("change", renderGuests);

giftAdminSearch.addEventListener("input", renderAdminGifts);
giftAdminStatusFilter.addEventListener("change", renderAdminGifts);
selectionSearch.addEventListener("input", renderSelections);

newGiftButton.addEventListener("click", () => openGiftForm());
closeGiftDialog.addEventListener("click", closeGiftForm);
giftForm.addEventListener("submit", saveGift);

giftImageInput.addEventListener("change", async () => {
  const file = giftImageInput.files?.[0];
  if (!file) return;

  try {
    state.currentGiftImageData = await compressImage(file);
    giftImagePreview.src = state.currentGiftImageData;
    giftImagePreviewWrap.hidden = false;
  } catch (error) {
    console.error("[ADMIN GIFTS] Erro ao processar imagem:", error);
    giftFormFeedback.textContent = "Não foi possível processar a imagem.";
    giftFormFeedback.classList.add("is-error");
  }
});

removeGiftImage.addEventListener("click", () => {
  state.currentGiftImageData = "";
  giftImageInput.value = "";
  giftImagePreview.removeAttribute("src");
  giftImagePreviewWrap.hidden = true;
});

adminGiftsGrid.addEventListener("click", async (event) => {
  const editButton = event.target.closest(".edit-gift");
  const toggleButton = event.target.closest(".toggle-gift");
  const deleteButton = event.target.closest(".delete-gift");

  if (editButton) {
    const gift = state.gifts.find((item) => item.id === editButton.dataset.id);
    if (gift) openGiftForm(gift);
  }

  if (toggleButton) {
    await updateDoc(doc(db, "gifts", toggleButton.dataset.id), {
      active: toggleButton.dataset.active !== "true",
      updatedAt: serverTimestamp()
    });
  }

  if (deleteButton) {
    askConfirmation({
      title: "Excluir presente?",
      message:
        `O item “${deleteButton.dataset.name}” será removido. Esta ação não pode ser desfeita.`,
      action: () => deleteDoc(doc(db, "gifts", deleteButton.dataset.id))
    });
  }
});

guestsTableBody.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-rsvp");
  if (!button) return;

  askConfirmation({
    title: "Excluir confirmação?",
    message:
      `A confirmação de ${button.dataset.name} será removida da lista.`,
    action: () => deleteDoc(doc(db, "rsvps", button.dataset.id))
  });
});

messagesGrid.addEventListener("click", (event) => {
  const approve = event.target.closest(".approve-message");
  const reject = event.target.closest(".reject-message");
  const remove = event.target.closest(".delete-message");

  if (approve) {
    updateModeration("messages", approve.dataset.id, true);
  }

  if (reject) {
    updateModeration("messages", reject.dataset.id, false);
  }

  if (remove) {
    askConfirmation({
      title: "Excluir recadinho?",
      message: "O recadinho será removido definitivamente.",
      action: () => deleteDoc(doc(db, "messages", remove.dataset.id))
    });
  }
});

galleryAdminGrid.addEventListener("click", (event) => {
  const approve = event.target.closest(".approve-photo");
  const reject = event.target.closest(".reject-photo");
  const remove = event.target.closest(".delete-photo");

  if (approve) {
    updateModeration("gallery", approve.dataset.id, true);
  }

  if (reject) {
    updateModeration("gallery", reject.dataset.id, false);
  }

  if (remove) {
    askConfirmation({
      title: "Excluir foto?",
      message: "A imagem será removida definitivamente da galeria.",
      action: () => deleteDoc(doc(db, "gallery", remove.dataset.id))
    });
  }
});

cancelConfirm.addEventListener("click", closeConfirmation);
acceptConfirm.addEventListener("click", runConfirmation);

giftDialog.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
});

confirmDialog.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
});

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
