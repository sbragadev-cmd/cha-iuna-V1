import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { db } from "./firebase-config.js";

const giftsGrid = document.querySelector("#homeGiftsGrid");
const giftFeedback = document.querySelector("#giftFeedback");

const state = {
  gifts: [],
  reservingGiftId: null
};

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(parsed));
}

function getGiftTotal(gift) {
  return normalizeInteger(
    gift.totalQuantity ??
    gift.quantity ??
    gift.targetQuantity ??
    gift.desiredQuantity,
    0
  );
}

function getGiftAvailable(gift) {
  if (gift.availableQuantity !== undefined) {
    return normalizeInteger(gift.availableQuantity, 0);
  }

  const total = getGiftTotal(gift);
  const reserved = normalizeInteger(
    gift.reservedQuantity ??
    gift.selectedQuantity ??
    gift.reservations,
    0
  );

  return Math.max(0, total - reserved);
}

function isGiftVisible(gift) {
  if (gift.active === false) {
    return false;
  }

  if (gift.status && !["active", "published", "available"].includes(gift.status)) {
    return false;
  }

  return true;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setFeedback(message = "", type = "") {
  if (!giftFeedback) {
    return;
  }

  giftFeedback.textContent = message;
  giftFeedback.className = "form-feedback";

  if (type) {
    giftFeedback.classList.add(`is-${type}`);
  }
}

function giftImageMarkup(gift) {
  const source =
    gift.imageData ||
    gift.imageUrl ||
    gift.photoUrl ||
    gift.image ||
    "";

  if (!source) {
    return `
      <div class="gift-card-placeholder" aria-hidden="true">
        <span>♥</span>
      </div>
    `;
  }

  return `
    <div class="gift-card-image">
      <img
        src="${escapeHtml(source)}"
        alt="${escapeHtml(gift.name || gift.title || "Presente para a Iúna")}"
        loading="lazy"
      >
    </div>
  `;
}

function renderGiftCard(gift) {
  const id = gift.id;
  const name = gift.name || gift.title || "Presente para a Iúna";
  const description = gift.description || gift.details || "";
  const category = gift.category || gift.type || "Lista da Iúna";
  const available = getGiftAvailable(gift);
  const total = getGiftTotal(gift);
  const isUnavailable = available <= 0;
  const isReserving = state.reservingGiftId === id;
  const maxSelectable = Math.min(available, 10);

  return `
    <article class="gift-card reveal ${isUnavailable ? "is-unavailable" : ""}" data-gift-id="${escapeHtml(id)}">
      ${giftImageMarkup(gift)}

      <div class="gift-card-body">
        <span class="gift-category">${escapeHtml(category)}</span>
        <h3>${escapeHtml(name)}</h3>

        ${description ? `<p>${escapeHtml(description)}</p>` : ""}

        <div class="gift-availability" aria-label="Quantidade disponível">
          <strong>${available}</strong>
          <span>${available === 1 ? "unidade disponível" : "unidades disponíveis"}</span>
        </div>

        ${
          total > 0
            ? `<small class="gift-total-note">Lista preparada com ${total} ${total === 1 ? "unidade" : "unidades"}.</small>`
            : ""
        }

        ${
          isUnavailable
            ? `
              <button class="button button-secondary" type="button" disabled>
                Item já escolhido
              </button>
            `
            : `
              <form class="gift-reservation-form" data-gift-reservation-form="${escapeHtml(id)}">
                <label class="field">
                  <span>Quantidade que você levará</span>

                  <select
                    name="quantity"
                    aria-label="Quantidade de ${escapeHtml(name)}"
                    ${isReserving ? "disabled" : ""}
                  >
                    ${Array.from(
                      { length: maxSelectable },
                      (_, index) => `<option value="${index + 1}">${index + 1}</option>`
                    ).join("")}
                  </select>
                </label>

                <button
                  class="button button-primary"
                  type="submit"
                  ${isReserving ? "disabled" : ""}
                >
                  ${isReserving ? "Reservando..." : "Escolher este presente"}
                </button>
              </form>
            `
        }
      </div>
    </article>
  `;
}

function renderGifts() {
  if (!giftsGrid) {
    return;
  }

  if (!state.gifts.length) {
    giftsGrid.innerHTML = `
      <article class="gift-card gift-card-empty">
        <div class="gift-card-body">
          <span class="gift-category">Lista de presentes</span>
          <h3>Nenhum item disponível no momento.</h3>
          <p>Os pais da Iúna estão preparando a lista com muito carinho.</p>
        </div>
      </article>
    `;

    giftsGrid.setAttribute("aria-busy", "false");
    return;
  }

  giftsGrid.innerHTML = state.gifts.map(renderGiftCard).join("");
  giftsGrid.setAttribute("aria-busy", "false");
}

async function loadGifts() {
  if (!giftsGrid) {
    return;
  }

  giftsGrid.setAttribute("aria-busy", "true");
  setFeedback("");

  try {
    let snapshot;

    try {
      const publishedQuery = query(
        collection(db, "gifts"),
        where("active", "==", true)
      );

      snapshot = await getDocs(publishedQuery);
    } catch (queryError) {
      console.warn(
        "[PRESENTES] Consulta por active falhou; usando leitura simples.",
        queryError
      );

      snapshot = await getDocs(collection(db, "gifts"));
    }

    state.gifts = snapshot.docs
      .map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      }))
      .filter(isGiftVisible)
      .sort((a, b) => {
        const orderA = normalizeInteger(a.order ?? a.position, 9999);
        const orderB = normalizeInteger(b.order ?? b.position, 9999);

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        const nameA = String(a.name || a.title || "");
        const nameB = String(b.name || b.title || "");

        return nameA.localeCompare(nameB, "pt-BR");
      });

    renderGifts();
  } catch (error) {
    console.error("[PRESENTES] Erro ao carregar a lista:", error);

    giftsGrid.innerHTML = `
      <article class="gift-card gift-card-error">
        <div class="gift-card-body">
          <span class="gift-category">Não foi possível carregar</span>
          <h3>A lista de presentes está temporariamente indisponível.</h3>
          <p>Tente novamente daqui a pouco.</p>
        </div>
      </article>
    `;

    giftsGrid.setAttribute("aria-busy", "false");
    setFeedback(
      "Não conseguimos carregar os presentes agora. Tente atualizar a página.",
      "error"
    );
  }
}

async function reserveGift(giftId, quantity) {
  const giftReference = doc(db, "gifts", giftId);

  await runTransaction(db, async (transaction) => {
    const giftSnapshot = await transaction.get(giftReference);

    if (!giftSnapshot.exists()) {
      throw new Error("Este presente não está mais disponível.");
    }

    const currentGift = giftSnapshot.data();

    if (!isGiftVisible(currentGift)) {
      throw new Error("Este presente não está disponível para reserva.");
    }

    const available = getGiftAvailable(currentGift);

    if (quantity < 1 || quantity > available) {
      throw new Error(
        available > 0
          ? `Agora restam somente ${available} unidades deste item.`
          : "Este item acabou de ser escolhido por outra pessoa."
      );
    }

    const reservedQuantity = normalizeInteger(
      currentGift.reservedQuantity ??
      currentGift.selectedQuantity ??
      currentGift.reservations,
      0
    );

    transaction.update(giftReference, {
      availableQuantity: available - quantity,
      reservedQuantity: reservedQuantity + quantity,
      updatedAt: serverTimestamp()
    });
  });
}

giftsGrid?.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-gift-reservation-form]");

  if (!form) {
    return;
  }

  event.preventDefault();

  const giftId = form.dataset.giftReservationForm;
  const formData = new FormData(form);
  const quantity = normalizeInteger(formData.get("quantity"), 0);
  const gift = state.gifts.find((item) => item.id === giftId);

  if (!gift || quantity < 1) {
    setFeedback("Escolha uma quantidade válida.", "error");
    return;
  }

  const confirmed = window.confirm(
    `Confirmar ${quantity} ${
      quantity === 1 ? "unidade" : "unidades"
    } de “${gift.name || gift.title || "este presente"}”?`
  );

  if (!confirmed) {
    return;
  }

  state.reservingGiftId = giftId;
  setFeedback("");
  renderGifts();

  try {
    await reserveGift(giftId, quantity);

    setFeedback(
      "Presente escolhido com carinho. A quantidade disponível foi atualizada.",
      "success"
    );

    await loadGifts();
  } catch (error) {
    console.error("[PRESENTES] Erro ao reservar:", error);

    setFeedback(
      error?.message ||
        "Não foi possível reservar este presente. Tente novamente.",
      "error"
    );

    await loadGifts();
  } finally {
    state.reservingGiftId = null;
    renderGifts();
  }
});

loadGifts();
