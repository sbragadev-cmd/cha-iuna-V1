import { db } from "./firebase-config.js";

import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const giftList = document.querySelector("#giftList");
const emptyState = document.querySelector("#emptyState");
const pageFeedback = document.querySelector("#pageFeedback");

const giftSearch = document.querySelector("#giftSearch");
const categoryFilter = document.querySelector("#categoryFilter");
const onlyAvailable = document.querySelector("#onlyAvailable");
const clearFilters = document.querySelector("#clearFilters");

const totalGiftCount = document.querySelector("#totalGiftCount");
const availableGiftCount = document.querySelector("#availableGiftCount");

const reservationDialog = document.querySelector("#reservationDialog");
const reservationForm = document.querySelector("#reservationForm");
const closeReservationDialog = document.querySelector("#closeReservationDialog");
const selectedGiftPreview = document.querySelector("#selectedGiftPreview");
const selectedGiftId = document.querySelector("#selectedGiftId");
const guestName = document.querySelector("#guestName");
const guestPhone = document.querySelector("#guestPhone");
const giftQuantity = document.querySelector("#giftQuantity");
const guestNote = document.querySelector("#guestNote");
const reservationConsent = document.querySelector("#reservationConsent");
const reservationFeedback = document.querySelector("#reservationFeedback");

const successDialog = document.querySelector("#successDialog");
const closeSuccess = document.querySelector("#closeSuccess");

const menuToggle = document.querySelector("#menuToggle");
const headerNav = document.querySelector("#headerNav");

let gifts = [];
let selectedGift = null;
let unsubscribe = null;

function normalizeText(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function normalizeSearch(value = "") {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function availableQuantity(gift) {
  const quantity = Number(gift.quantity || 0);
  const reserved = Number(gift.reservedQuantity || 0);
  return Math.max(quantity - reserved, 0);
}

function setError(fieldId, message = "") {
  const field = document.querySelector(`#${fieldId}`);
  const error = document.querySelector(`#${fieldId}Error`);

  if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
  if (error) error.textContent = message;
}

function clearReservationErrors() {
  ["guestName", "guestPhone", "giftQuantity", "reservationConsent"].forEach(
    (field) => setError(field, "")
  );

  reservationFeedback.textContent = "";
  reservationFeedback.className = "form-feedback";
}

function updateSummary() {
  totalGiftCount.textContent = gifts.length;
  availableGiftCount.textContent = gifts.filter(
    (gift) => availableQuantity(gift) > 0
  ).length;
}

function updateCategoryOptions() {
  const currentValue = categoryFilter.value;

  const categories = [...new Set(
    gifts
      .map((gift) => normalizeText(gift.category))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "pt-BR"));

  categoryFilter.innerHTML = `
    <option value="">Todas as categorias</option>
    ${categories
      .map(
        (category) =>
          `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
      )
      .join("")}
  `;

  if (categories.includes(currentValue)) {
    categoryFilter.value = currentValue;
  }
}

function getFilteredGifts() {
  const search = normalizeSearch(giftSearch.value);
  const category = categoryFilter.value;
  const availableOnly = onlyAvailable.checked;

  return gifts.filter((gift) => {
    const available = availableQuantity(gift);

    if (availableOnly && available <= 0) return false;
    if (category && gift.category !== category) return false;

    if (search) {
      const searchable = normalizeSearch(
        `${gift.name || ""} ${gift.description || ""} ${gift.category || ""}`
      );

      if (!searchable.includes(search)) return false;
    }

    return true;
  });
}

function giftImageMarkup(gift) {
  const source = gift.imageData || gift.imageUrl || "";

  if (!source) {
    return `<div class="gift-placeholder" aria-hidden="true">♡</div>`;
  }

  return `
    <img
      src="${escapeHtml(source)}"
      alt="${escapeHtml(gift.name || "Presente para a Iúna")}"
      loading="lazy"
    >
  `;
}

function renderGifts() {
  const filtered = getFilteredGifts();

  if (!filtered.length) {
    giftList.hidden = true;
    emptyState.hidden = false;
    giftList.innerHTML = "";
    return;
  }

  giftList.hidden = false;
  emptyState.hidden = true;

  giftList.innerHTML = filtered
    .map((gift) => {
      const available = availableQuantity(gift);
      const total = Number(gift.quantity || 0);

      return `
        <article class="gift-card">
          <div class="gift-image">
            ${giftImageMarkup(gift)}

            <span class="gift-status ${available <= 0 ? "unavailable" : ""}">
              ${available > 0 ? `${available} disponível${available === 1 ? "" : "is"}` : "Já escolhido"}
            </span>
          </div>

          <div class="gift-content">
            <span class="gift-category">
              ${escapeHtml(gift.category || "Presente")}
            </span>

            <h3>${escapeHtml(gift.name || "Presente para a Iúna")}</h3>

            <p class="gift-description">
              ${escapeHtml(gift.description || "Um mimo escolhido com carinho para a Iúna.")}
            </p>

            <div class="gift-meta">
              <span>
                Quantidade:
                <strong>${total}</strong>
              </span>

              <span>
                Reservados:
                <strong>${Number(gift.reservedQuantity || 0)}</strong>
              </span>
            </div>

            <button
              class="button button-primary button-full choose-gift"
              type="button"
              data-gift-id="${escapeHtml(gift.id)}"
              ${available <= 0 ? "disabled" : ""}
            >
              ${available > 0 ? "Escolher este presente" : "Presente já escolhido"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function applyFilters() {
  renderGifts();
}

function openReservation(giftId) {
  selectedGift = gifts.find((gift) => gift.id === giftId);

  if (!selectedGift) return;

  const available = availableQuantity(selectedGift);

  if (available <= 0) {
    pageFeedback.textContent =
      "Esse presente acabou de ser escolhido por outra pessoa.";
    return;
  }

  clearReservationErrors();
  reservationForm.reset();

  selectedGiftId.value = selectedGift.id;
  selectedGiftPreview.textContent = selectedGift.name || "Presente para a Iúna";

  giftQuantity.innerHTML = Array.from(
    { length: available },
    (_, index) => index + 1
  )
    .map(
      (quantity) =>
        `<option value="${quantity}">${quantity}</option>`
    )
    .join("");

  reservationDialog.showModal();
  document.body.classList.add("modal-open");

  setTimeout(() => guestName.focus(), 50);
}

function closeReservation() {
  if (reservationDialog.open) reservationDialog.close();
  document.body.classList.remove("modal-open");
}

function validateReservation() {
  clearReservationErrors();

  const name = normalizeText(guestName.value);
  const phoneDigits = guestPhone.value.replace(/\D/g, "");
  const quantity = Number(giftQuantity.value);

  let valid = true;

  if (name.length < 2) {
    setError("guestName", "Informe seu nome.");
    valid = false;
  }

  if (phoneDigits.length < 10) {
    setError("guestPhone", "Informe um WhatsApp válido.");
    valid = false;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    setError("giftQuantity", "Selecione uma quantidade válida.");
    valid = false;
  }

  if (!reservationConsent.checked) {
    setError("reservationConsent", "Confirme que deseja reservar o presente.");
    valid = false;
  }

  return valid;
}

function setSubmitting(submitting) {
  const button = reservationForm.querySelector('button[type="submit"]');
  const text = button.querySelector(".button-text");
  const loading = button.querySelector(".button-loading");

  button.disabled = submitting;
  text.hidden = submitting;
  loading.hidden = !submitting;
}

async function submitReservation(event) {
  event.preventDefault();

  if (!selectedGift || !validateReservation()) {
    reservationFeedback.textContent = "Revise os campos destacados.";
    reservationFeedback.className = "form-feedback is-error";
    return;
  }

  setSubmitting(true);

  const reservationQuantity = Number(giftQuantity.value);
  const phoneDigits = guestPhone.value.replace(/\D/g, "");

  try {
    const giftRef = doc(db, "gifts", selectedGift.id);
    const selectionRef = doc(collection(db, "giftSelections"));

    await runTransaction(db, async (transaction) => {
      const giftSnapshot = await transaction.get(giftRef);

      if (!giftSnapshot.exists()) {
        throw new Error("GIFT_NOT_FOUND");
      }

      const currentGift = giftSnapshot.data();
      const quantity = Number(currentGift.quantity || 0);
      const reserved = Number(currentGift.reservedQuantity || 0);
      const remaining = quantity - reserved;

      if (
        !currentGift.active ||
        reservationQuantity < 1 ||
        reservationQuantity > remaining
      ) {
        throw new Error("GIFT_UNAVAILABLE");
      }

      transaction.set(selectionRef, {
        giftId: selectedGift.id,
        giftName: currentGift.name || selectedGift.name || "",
        category: currentGift.category || selectedGift.category || "",
        guestName: normalizeText(guestName.value),
        guestPhone: phoneDigits,
        quantity: reservationQuantity,
        note: normalizeText(guestNote.value),
        status: "confirmed",
        source: "public-site",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      transaction.update(giftRef, {
        reservedQuantity: increment(reservationQuantity),
        updatedAt: serverTimestamp()
      });
    });

    closeReservation();
    successDialog.showModal();
    document.body.classList.add("modal-open");
  } catch (error) {
    console.error("[GIFTS] Erro ao reservar presente:", error);

    reservationFeedback.textContent =
      error?.message === "GIFT_UNAVAILABLE"
        ? "Este presente não possui mais a quantidade selecionada. Atualize a lista e tente novamente."
        : "Não foi possível confirmar sua escolha agora. Tente novamente.";
    reservationFeedback.className = "form-feedback is-error";
  } finally {
    setSubmitting(false);
  }
}

function startGiftsListener() {
const giftsQuery = query(
  collection(db, "gifts"),
  where("active", "==", true)
);

  unsubscribe = onSnapshot(
    giftsQuery,
    (snapshot) => {
      gifts = snapshot.docs
  .map((document) => ({
    id: document.id,
    ...document.data()
  }))
  .sort((giftA, giftB) => {
    const categoryA = String(giftA.category || "");
    const categoryB = String(giftB.category || "");

    const categoryComparison = categoryA.localeCompare(
      categoryB,
      "pt-BR",
      { sensitivity: "base" }
    );

    if (categoryComparison !== 0) {
      return categoryComparison;
    }

    return String(giftA.name || "").localeCompare(
      String(giftB.name || ""),
      "pt-BR",
      { sensitivity: "base" }
    );
  });

      pageFeedback.textContent = "";
      updateSummary();
      updateCategoryOptions();
      renderGifts();
    },
    (error) => {
      console.error("[GIFTS] Erro ao carregar presentes:", error);

      giftList.hidden = true;
      emptyState.hidden = false;
      emptyState.querySelector("h3").textContent =
        "Não foi possível carregar a lista agora.";
      emptyState.querySelector("p").textContent =
        "Atualize a página em alguns instantes.";

      pageFeedback.textContent =
        "O Firestore pode solicitar a criação de um índice para esta consulta.";
    }
  );
}

function formatPhone(event) {
  let value = event.target.value.replace(/\D/g, "").slice(0, 11);

  if (value.length > 10) {
    value = value.replace(
      /^(\d{2})(\d{5})(\d{0,4})$/,
      "($1) $2-$3"
    );
  } else if (value.length > 6) {
    value = value.replace(
      /^(\d{2})(\d{4})(\d{0,4})$/,
      "($1) $2-$3"
    );
  } else if (value.length > 2) {
    value = value.replace(/^(\d{2})(\d+)/, "($1) $2");
  } else if (value.length) {
    value = value.replace(/^(\d{0,2})/, "($1");
  }

  event.target.value = value;
}

giftList?.addEventListener("click", (event) => {
  const button = event.target.closest(".choose-gift");
  if (!button) return;

  openReservation(button.dataset.giftId);
});

giftSearch?.addEventListener("input", applyFilters);
categoryFilter?.addEventListener("change", applyFilters);
onlyAvailable?.addEventListener("change", applyFilters);

clearFilters?.addEventListener("click", () => {
  giftSearch.value = "";
  categoryFilter.value = "";
  onlyAvailable.checked = true;
  renderGifts();
});

guestPhone?.addEventListener("input", formatPhone);
reservationForm?.addEventListener("submit", submitReservation);
closeReservationDialog?.addEventListener("click", closeReservation);

reservationDialog?.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
});

closeSuccess?.addEventListener("click", () => {
  successDialog.close();
  document.body.classList.remove("modal-open");
});

successDialog?.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
});

menuToggle?.addEventListener("click", () => {
  const open = !headerNav.classList.contains("open");
  headerNav.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
});

headerNav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    headerNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});

window.addEventListener("beforeunload", () => {
  if (typeof unsubscribe === "function") unsubscribe();
});

startGiftsListener();
