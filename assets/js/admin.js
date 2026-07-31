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
  currentGalleryImageData: "",
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
const newPhotoButton = document.querySelector("#newPhotoButton");
const gallerySearch = document.querySelector("#gallerySearch");
const galleryAlbumFilter = document.querySelector("#galleryAlbumFilter");
const galleryStatusFilter = document.querySelector("#galleryStatusFilter");
const galleryDialog = document.querySelector("#galleryDialog");
const galleryForm = document.querySelector("#galleryForm");
const closeGalleryDialog = document.querySelector("#closeGalleryDialog");
const cancelGalleryEdit = document.querySelector("#cancelGalleryEdit");
const galleryDialogTitle = document.querySelector("#galleryDialogTitle");
const galleryIdInput = document.querySelector("#galleryId");
const galleryTitleInput = document.querySelector("#galleryTitle");
const galleryCaptionInput = document.querySelector("#galleryCaption");
const galleryCaptionCount = document.querySelector("#galleryCaptionCount");
const galleryAlbumInput = document.querySelector("#galleryAlbum");
const galleryEventInput = document.querySelector("#galleryEvent");
const gallerySubmittedByInput = document.querySelector("#gallerySubmittedBy");
const galleryPhotoDateInput = document.querySelector("#galleryPhotoDate");
const galleryLocationInput = document.querySelector("#galleryLocation");
const galleryOrderInput = document.querySelector("#galleryOrder");
const galleryApprovedInput = document.querySelector("#galleryApproved");
const galleryPublishedInput = document.querySelector("#galleryPublished");
const galleryFeaturedInput = document.querySelector("#galleryFeatured");
const galleryImageInput = document.querySelector("#galleryImage");
const galleryImagePreview = document.querySelector("#galleryImagePreview");
const galleryImagePlaceholder = document.querySelector("#galleryImagePlaceholder");
const removeGalleryImage = document.querySelector("#removeGalleryImage");
const galleryFormFeedback = document.querySelector("#galleryFormFeedback");

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
  const term = normalizeText(gallerySearch?.value ?? "").toLowerCase();
  const albumFilter = galleryAlbumFilter?.value ?? "all";
  const statusFilter = galleryStatusFilter?.value ?? "all";

  const sorted = [...state.gallery].sort((a, b) => {
    const orderA = Number(a.data.order ?? 9999);
    const orderB = Number(b.data.order ?? 9999);
    if (orderA !== orderB) return orderA - orderB;

    const dateA = timestampToDate(a.data.createdAt)?.getTime() ?? 0;
    const dateB = timestampToDate(b.data.createdAt)?.getTime() ?? 0;
    return dateB - dateA;
  });

  const filtered = sorted.filter(({ data }) => {
    const searchable = [
      data.title, data.caption, data.submittedBy,
      data.location, data.album, data.eventLabel
    ]
      .map((value) => normalizeText(value).toLowerCase())
      .join(" ");

    const matchesAlbum =
      albumFilter === "all" || data.album === albumFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && data.approved !== true) ||
      (statusFilter === "approved" && data.approved === true) ||
      (statusFilter === "published" && data.published === true) ||
      (statusFilter === "hidden" && data.published !== true) ||
      (statusFilter === "featured" && data.featured === true);

    return (!term || searchable.includes(term)) && matchesAlbum && matchesStatus;
  });

  document.querySelector("#galleryTotalCount").textContent = state.gallery.length;
  document.querySelector("#galleryPublishedCount").textContent =
    state.gallery.filter((item) => item.data.published === true).length;
  document.querySelector("#galleryPendingCount").textContent =
    state.gallery.filter((item) => item.data.approved !== true).length;
  document.querySelector("#galleryFeaturedCount").textContent =
    state.gallery.filter((item) => item.data.featured === true).length;

  if (!filtered.length) {
    galleryAdminGrid.innerHTML =
      '<p class="empty-copy">Nenhuma foto encontrada com os filtros selecionados.</p>';
    return;
  }

  galleryAdminGrid.innerHTML = filtered
    .map(({ id, data }) => {
      const image = safeImage(data.imageData ?? data.imageUrl ?? "");
      const approved = data.approved === true;
      const publishedPhoto = data.published === true;
      const featuredPhoto = data.featured === true;

      return `
        <article class="gallery-admin-card gallery-editor-card ${approved ? "" : "pending"}">
          <button class="gallery-admin-image edit-photo" type="button" data-id="${escapeHtml(id)}">
            ${image
              ? `<img src="${image}" alt="${escapeHtml(data.title ?? "Foto")}">`
              : '<span class="gallery-card-placeholder">▧</span>'
            }
            ${featuredPhoto ? '<span class="gallery-featured-badge">★ Destaque</span>' : ""}
            <span class="gallery-image-edit-hint">Editar foto</span>
          </button>

          <div class="gallery-admin-content">
            <div class="gallery-admin-top">
              <div>
                <div class="gallery-status-row">
                  <span class="status-pill ${approved ? "approved" : "pending"}">
                    ${approved ? "Aprovada" : "Pendente"}
                  </span>
                  <span class="status-pill ${publishedPhoto ? "published" : "inactive"}">
                    ${publishedPhoto ? "Publicada" : "Oculta"}
                  </span>
                </div>
                <h3>${escapeHtml(data.title ?? "Foto sem título")}</h3>
              </div>
              <span class="gallery-order-badge">Ordem ${Number(data.order ?? 0)}</span>
            </div>

            <p class="gallery-card-caption">${escapeHtml(data.caption ?? "Sem legenda.")}</p>

            <dl class="gallery-card-meta">
              <div><dt>Álbum</dt><dd>${escapeHtml(data.album ?? "Outros")}</dd></div>
              <div><dt>Evento</dt><dd>${escapeHtml(data.eventLabel ?? "—")}</dd></div>
              <div><dt>Local</dt><dd>${escapeHtml(data.location ?? "—")}</dd></div>
              <div><dt>Enviada por</dt><dd>${escapeHtml(data.submittedBy ?? "Convidado")}</dd></div>
            </dl>

            <div class="card-actions gallery-card-actions">
              <button class="icon-button edit-photo" data-id="${escapeHtml(id)}" type="button">Editar</button>
              ${approved
                ? `<button class="icon-button reject-photo" data-id="${escapeHtml(id)}" type="button">Desaprovar</button>`
                : `<button class="icon-button approve approve-photo" data-id="${escapeHtml(id)}" type="button">Aprovar</button>`
              }
              <button class="icon-button toggle-photo-publication"
                data-id="${escapeHtml(id)}"
                data-published="${publishedPhoto}"
                type="button">
                ${publishedPhoto ? "Ocultar" : "Publicar"}
              </button>
              <button class="icon-button danger delete-photo" data-id="${escapeHtml(id)}" type="button">Excluir</button>
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

function updateGalleryPreview() {
  const hasImage = Boolean(state.currentGalleryImageData);
  galleryImagePreview.hidden = !hasImage;
  galleryImagePlaceholder.hidden = hasImage;

  if (hasImage) {
    galleryImagePreview.src = state.currentGalleryImageData;
  } else {
    galleryImagePreview.removeAttribute("src");
  }
}

function openGalleryForm(photo = null) {
  galleryForm.reset();
  galleryFormFeedback.textContent = "";
  galleryFormFeedback.className = "form-feedback";
  state.currentGalleryImageData = "";

  if (photo) {
    galleryDialogTitle.textContent = "Editar foto";
    galleryIdInput.value = photo.id;
    galleryTitleInput.value = photo.data.title ?? "";
    galleryCaptionInput.value = photo.data.caption ?? "";
    galleryAlbumInput.value = photo.data.album ?? "Outros";
    galleryEventInput.value = photo.data.eventId ?? "";
    gallerySubmittedByInput.value = photo.data.submittedBy ?? "";
    galleryPhotoDateInput.value = photo.data.photoDate ?? "";
    galleryLocationInput.value = photo.data.location ?? "";
    galleryOrderInput.value = Number(photo.data.order ?? 0);
    galleryApprovedInput.checked = photo.data.approved === true;
    galleryPublishedInput.checked = photo.data.published === true;
    galleryFeaturedInput.checked = photo.data.featured === true;
    state.currentGalleryImageData = photo.data.imageData ?? photo.data.imageUrl ?? "";
  } else {
    galleryDialogTitle.textContent = "Adicionar foto";
    galleryIdInput.value = "";
    galleryAlbumInput.value = "Preparativos";
    galleryOrderInput.value = state.gallery.length;
    galleryApprovedInput.checked = true;
    galleryPublishedInput.checked = true;
    galleryFeaturedInput.checked = false;
  }

  galleryCaptionCount.textContent = String(galleryCaptionInput.value.length);
  updateGalleryPreview();
  galleryDialog.showModal();
  document.body.classList.add("modal-open");
}

function closeGalleryForm() {
  galleryDialog.close();
  document.body.classList.remove("modal-open");
}

async function saveGalleryPhoto(event) {
  event.preventDefault();

  const photoId = galleryIdInput.value;
  const title = normalizeText(galleryTitleInput.value);
  const album = galleryAlbumInput.value;

  if (title.length < 2 || !album) {
    galleryFormFeedback.textContent = "Informe o título e selecione o álbum.";
    galleryFormFeedback.classList.add("is-error");
    return;
  }

  if (!state.currentGalleryImageData) {
    galleryFormFeedback.textContent = "Escolha uma imagem para continuar.";
    galleryFormFeedback.classList.add("is-error");
    return;
  }

  const submitButton = galleryForm.querySelector('button[type="submit"]');
  const buttonText = submitButton.querySelector(".button-text");
  const buttonLoading = submitButton.querySelector(".button-loading");

  submitButton.disabled = true;
  buttonText.hidden = true;
  buttonLoading.hidden = false;

  try {
    const eventId = galleryEventInput.value;
    const eventLabels = {
      bage: "Bagé",
      "porto-alegre": "Porto Alegre"
    };

    const payload = {
      title,
      caption: normalizeText(galleryCaptionInput.value),
      album,
      eventId,
      eventLabel: eventLabels[eventId] ?? "",
      submittedBy: normalizeText(gallerySubmittedByInput.value),
      photoDate: galleryPhotoDateInput.value || "",
      location: normalizeText(galleryLocationInput.value),
      order: Math.max(0, Number(galleryOrderInput.value ?? 0)),
      approved: galleryApprovedInput.checked,
      published: galleryPublishedInput.checked,
      featured: galleryFeaturedInput.checked,
      active: galleryPublishedInput.checked,
      imageData: state.currentGalleryImageData,
      updatedAt: serverTimestamp()
    };

    if (photoId) {
      await updateDoc(doc(db, "gallery", photoId), payload);
    } else {
      await addDoc(collection(db, "gallery"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    closeGalleryForm();
  } catch (error) {
    console.error("[ADMIN GALLERY] Erro ao salvar foto:", error);
    galleryFormFeedback.textContent =
      "Não foi possível salvar a foto. Verifique as permissões do Firestore.";
    galleryFormFeedback.classList.add("is-error");
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

gallerySearch.addEventListener("input", renderGallery);
galleryAlbumFilter.addEventListener("change", renderGallery);
galleryStatusFilter.addEventListener("change", renderGallery);

newPhotoButton.addEventListener("click", () => openGalleryForm());
closeGalleryDialog.addEventListener("click", closeGalleryForm);
cancelGalleryEdit.addEventListener("click", closeGalleryForm);
galleryForm.addEventListener("submit", saveGalleryPhoto);

galleryCaptionInput.addEventListener("input", () => {
  galleryCaptionCount.textContent = String(galleryCaptionInput.value.length);
});

galleryImageInput.addEventListener("change", async () => {
  const file = galleryImageInput.files?.[0];
  if (!file) return;

  try {
    state.currentGalleryImageData = await compressImage(file, 1400, 0.8);
    updateGalleryPreview();
  } catch (error) {
    console.error("[ADMIN GALLERY] Erro ao processar imagem:", error);
    galleryFormFeedback.textContent = "Não foi possível processar esta imagem.";
    galleryFormFeedback.classList.add("is-error");
  }
});

removeGalleryImage.addEventListener("click", () => {
  state.currentGalleryImageData = "";
  galleryImageInput.value = "";
  updateGalleryPreview();
});

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

galleryAdminGrid.addEventListener("click", async (event) => {
  const edit = event.target.closest(".edit-photo");
  const approve = event.target.closest(".approve-photo");
  const reject = event.target.closest(".reject-photo");
  const togglePublication = event.target.closest(".toggle-photo-publication");
  const remove = event.target.closest(".delete-photo");

  if (edit) {
    const photo = state.gallery.find((item) => item.id === edit.dataset.id);
    if (photo) openGalleryForm(photo);
    return;
  }

  if (approve) {
    await updateModeration("gallery", approve.dataset.id, true);
    return;
  }

  if (reject) {
    await updateDoc(doc(db, "gallery", reject.dataset.id), {
      approved: false,
      published: false,
      active: false,
      updatedAt: serverTimestamp()
    });
    return;
  }

  if (togglePublication) {
    const willPublish = togglePublication.dataset.published !== "true";
    const publicationPayload = {
      published: willPublish,
      active: willPublish,
      updatedAt: serverTimestamp()
    };

    if (willPublish) publicationPayload.approved = true;

    await updateDoc(
      doc(db, "gallery", togglePublication.dataset.id),
      publicationPayload
    );
    return;
  }

  if (remove) {
    askConfirmation({
      title: "Excluir foto?",
      message: "A imagem e todas as informações serão removidas definitivamente.",
      action: () => deleteDoc(doc(db, "gallery", remove.dataset.id))
    });
  }
});

cancelConfirm.addEventListener("click", closeConfirmation);
acceptConfirm.addEventListener("click", runConfirmation);

giftDialog.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
});

galleryDialog.addEventListener("close", () => {
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
