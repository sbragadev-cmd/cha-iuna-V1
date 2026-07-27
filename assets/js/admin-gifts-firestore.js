import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { db } from "./firebase-config.js";

const giftsCollection = collection(db, "gifts");

const elements = {
  form: document.querySelector("#giftForm"),
  modal: document.querySelector("#giftModal"),
  modalTitle: document.querySelector("#giftModal .modal-head h3"),
  tableBody: document.querySelector("#giftTableBody"),
  tableHead: document.querySelector("#view-gifts table thead"),
  summary: document.querySelector("#giftSummary"),
  statGifts: document.querySelector("#statGifts"),
  statReserved: document.querySelector("#statReserved"),
  openButton: document.querySelector('[data-open-modal="giftModal"]'),
  toast: document.querySelector("#toast")
};

const state = {
  gifts: [],
  editingId: null,
  unsubscribe: null
};

function showToast(message, type = "success") {
  if (!elements.toast) {
    console.log(`[PRESENTES] ${message}`);
    return;
  }

  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.classList.add("show");

  window.clearTimeout(showToast.timeout);

  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 3000);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(parsed));
}

function getTotal(gift) {
  return normalizeInteger(
    gift.totalQuantity ??
    gift.quantity ??
    gift.targetQuantity,
    0
  );
}

function getReserved(gift) {
  return normalizeInteger(
    gift.reservedQuantity ??
    gift.selectedQuantity,
    0
  );
}

function getAvailable(gift) {
  if (gift.availableQuantity !== undefined) {
    return normalizeInteger(gift.availableQuantity, 0);
  }

  return Math.max(0, getTotal(gift) - getReserved(gift));
}

function formatStatus(gift) {
  if (gift.active === false) {
    return {
      text: "Oculto",
      className: "pending"
    };
  }

  if (getAvailable(gift) <= 0) {
    return {
      text: "Esgotado",
      className: "reserved"
    };
  }

  return {
    text: "Disponível",
    className: "available"
  };
}

function injectAdminInterface() {
  if (!elements.form) {
    console.error("[PRESENTES] Formulário #giftForm não encontrado.");
    return;
  }

  if (elements.tableHead) {
    elements.tableHead.innerHTML = `
      <tr>
        <th>Presente</th>
        <th>Categoria</th>
        <th>Total</th>
        <th>Disponíveis</th>
        <th>Escolhidos</th>
        <th>Exibição</th>
        <th>Ações</th>
      </tr>
    `;
  }

  elements.form.innerHTML = `
    <input id="giftId" type="hidden">

    <label>
      <span>Nome do presente</span>
      <input
        id="giftName"
        type="text"
        maxlength="100"
        required
        placeholder="Ex.: Fralda tamanho M"
      >
    </label>

    <div class="form-grid">
      <label>
        <span>Categoria</span>
        <select id="giftCategory">
          <option>Fraldas</option>
          <option>Higiene</option>
          <option>Roupas</option>
          <option>Quarto</option>
          <option>Alimentação</option>
          <option>Brinquedos</option>
          <option>Outro</option>
        </select>
      </label>

      <label>
        <span>Quantidade total desejada</span>
        <input
          id="giftTotalQuantity"
          type="number"
          min="1"
          max="999"
          step="1"
          value="1"
          required
        >
      </label>
    </div>

    <label>
      <span>Descrição opcional</span>
      <textarea
        id="giftDescription"
        rows="3"
        maxlength="300"
        placeholder="Ex.: Preferência por fraldas sem perfume."
      ></textarea>
    </label>

    <div class="form-grid">
      <label>
        <span>Endereço da imagem</span>
        <input
          id="giftImageUrl"
          type="url"
          placeholder="https://..."
        >
      </label>

      <label>
        <span>Ordem na lista</span>
        <input
          id="giftOrder"
          type="number"
          min="0"
          max="9999"
          step="1"
          value="0"
        >
      </label>
    </div>

    <label class="check-field">
      <input id="giftActive" type="checkbox" checked>
      <span>Exibir este item na lista pública</span>
    </label>

    <div class="admin-gift-privacy-note">
      <strong>Privacidade das reservas</strong>
      <p>
        O sistema controla apenas as quantidades. Nenhum nome de convidado
        será registrado ou exibido.
      </p>
    </div>

    <div class="modal-actions">
      <button class="secondary-button modal-cancel" type="button">
        Cancelar
      </button>

      <button class="primary-button" type="submit">
        Salvar presente
      </button>
    </div>
  `;

  elements.form
    .querySelector(".modal-cancel")
    ?.addEventListener("click", () => closeGiftModal());

  if (elements.modalTitle) {
    elements.modalTitle.textContent = "Novo presente";
  }
}

function openGiftModal(gift = null) {
  if (!elements.modal || !elements.form) {
    return;
  }

  state.editingId = gift?.id || null;

  elements.form.reset();

  document.querySelector("#giftId").value = gift?.id || "";
  document.querySelector("#giftName").value = gift?.name || "";
  document.querySelector("#giftCategory").value = gift?.category || "Fraldas";
  document.querySelector("#giftDescription").value = gift?.description || "";
  document.querySelector("#giftImageUrl").value =
    gift?.imageUrl || gift?.imageData || "";
  document.querySelector("#giftOrder").value =
    normalizeInteger(gift?.order, 0);
  document.querySelector("#giftActive").checked =
    gift?.active !== false;

  const totalInput = document.querySelector("#giftTotalQuantity");
  totalInput.value = gift ? Math.max(1, getTotal(gift)) : 1;

  if (elements.modalTitle) {
    elements.modalTitle.textContent = gift
      ? "Editar presente"
      : "Novo presente";
  }

  elements.modal.classList.add("open");
  elements.modal.setAttribute("aria-hidden", "false");

  window.setTimeout(() => {
    document.querySelector("#giftName")?.focus();
  }, 50);
}

function closeGiftModal() {
  if (!elements.modal) {
    return;
  }

  elements.modal.classList.remove("open");
  elements.modal.setAttribute("aria-hidden", "true");
  state.editingId = null;
}

function renderSummary() {
  const totalItems = state.gifts.reduce(
    (sum, gift) => sum + getTotal(gift),
    0
  );

  const availableItems = state.gifts.reduce(
    (sum, gift) => sum + getAvailable(gift),
    0
  );

  const reservedItems = state.gifts.reduce(
    (sum, gift) => sum + getReserved(gift),
    0
  );

  const activeGifts = state.gifts.filter(
    gift => gift.active !== false
  ).length;

  if (elements.summary) {
    elements.summary.innerHTML = `
      <article class="summary-card">
        <small>Tipos cadastrados</small>
        <strong>${state.gifts.length}</strong>
      </article>

      <article class="summary-card">
        <small>Unidades desejadas</small>
        <strong>${totalItems}</strong>
      </article>

      <article class="summary-card">
        <small>Unidades disponíveis</small>
        <strong>${availableItems}</strong>
      </article>

      <article class="summary-card">
        <small>Unidades escolhidas</small>
        <strong>${reservedItems}</strong>
      </article>

      <article class="summary-card">
        <small>Itens visíveis</small>
        <strong>${activeGifts}</strong>
      </article>
    `;
  }

  if (elements.statGifts) {
    elements.statGifts.textContent = String(state.gifts.length);
  }

  if (elements.statReserved) {
    elements.statReserved.textContent =
      `${reservedItems} unidades escolhidas`;
  }
}

function renderTable() {
  if (!elements.tableBody) {
    return;
  }

  if (!state.gifts.length) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            Nenhum presente cadastrado.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  elements.tableBody.innerHTML = state.gifts
    .map(gift => {
      const status = formatStatus(gift);
      const total = getTotal(gift);
      const available = getAvailable(gift);
      const reserved = getReserved(gift);

      return `
        <tr>
          <td class="person-cell">
            <strong>${escapeHtml(gift.name || "Sem nome")}</strong>
            <small>
              ${escapeHtml(gift.description || "Sem descrição")}
            </small>
          </td>

          <td>${escapeHtml(gift.category || "Outro")}</td>

          <td>
            <strong>${total}</strong>
          </td>

          <td>
            <strong>${available}</strong>
          </td>

          <td>
            <strong>${reserved}</strong>
          </td>

          <td>
            <span class="status-pill ${status.className}">
              ${status.text}
            </span>
          </td>

          <td>
            <div class="action-buttons">
              <button
                class="icon-button"
                type="button"
                data-admin-edit-gift="${gift.id}"
                title="Editar presente"
                aria-label="Editar ${escapeHtml(gift.name || "presente")}"
              >
                ✎
              </button>

              <button
                class="icon-button"
                type="button"
                data-admin-toggle-gift="${gift.id}"
                title="${gift.active === false ? "Exibir no site" : "Ocultar do site"}"
                aria-label="${gift.active === false ? "Exibir" : "Ocultar"} ${escapeHtml(gift.name || "presente")}"
              >
                ${gift.active === false ? "○" : "◉"}
              </button>

              <button
                class="icon-button"
                type="button"
                data-admin-delete-gift="${gift.id}"
                title="Excluir presente"
                aria-label="Excluir ${escapeHtml(gift.name || "presente")}"
              >
                ×
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function render() {
  renderSummary();
  renderTable();
}

async function saveGift(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const name = document.querySelector("#giftName")?.value.trim() || "";
  const category =
    document.querySelector("#giftCategory")?.value || "Outro";
  const description =
    document.querySelector("#giftDescription")?.value.trim() || "";
  const imageUrl =
    document.querySelector("#giftImageUrl")?.value.trim() || "";
  const totalQuantity = normalizeInteger(
    document.querySelector("#giftTotalQuantity")?.value,
    0
  );
  const order = normalizeInteger(
    document.querySelector("#giftOrder")?.value,
    0
  );
  const active =
    document.querySelector("#giftActive")?.checked ?? true;

  if (name.length < 2) {
    showToast("Informe o nome do presente.", "error");
    return;
  }

  if (totalQuantity < 1) {
    showToast("Informe uma quantidade total válida.", "error");
    return;
  }

  const currentGift = state.gifts.find(
    gift => gift.id === state.editingId
  );

  const reservedQuantity = currentGift
    ? getReserved(currentGift)
    : 0;

  if (totalQuantity < reservedQuantity) {
    showToast(
      `A quantidade total não pode ser menor que as ${reservedQuantity} unidades já escolhidas.`,
      "error"
    );
    return;
  }

  const availableQuantity =
    totalQuantity - reservedQuantity;

  const payload = {
    name,
    category,
    description,
    imageUrl,
    totalQuantity,
    availableQuantity,
    reservedQuantity,
    active,
    order,
    status: active ? "available" : "hidden",
    updatedAt: serverTimestamp()
  };

  const submitButton = elements.form?.querySelector(
    'button[type="submit"]'
  );

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Salvando...";
  }

  try {
    if (state.editingId) {
      await updateDoc(
        doc(db, "gifts", state.editingId),
        payload
      );

      showToast("Presente atualizado com carinho.");
    } else {
      const newGiftReference = doc(giftsCollection);

      await setDoc(newGiftReference, {
        ...payload,
        createdAt: serverTimestamp()
      });

      showToast("Presente adicionado à lista.");
    }

    closeGiftModal();
  } catch (error) {
    console.error("[ADMIN PRESENTES] Erro ao salvar:", error);

    showToast(
      "Não foi possível salvar o presente. Verifique sua conexão e suas permissões.",
      "error"
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Salvar presente";
    }
  }
}

async function toggleGift(giftId) {
  const gift = state.gifts.find(item => item.id === giftId);

  if (!gift) {
    return;
  }

  try {
    const nextActive = gift.active === false;

    await updateDoc(doc(db, "gifts", giftId), {
      active: nextActive,
      status: nextActive ? "available" : "hidden",
      updatedAt: serverTimestamp()
    });

    showToast(
      nextActive
        ? "Presente exibido na lista pública."
        : "Presente ocultado da lista pública."
    );
  } catch (error) {
    console.error("[ADMIN PRESENTES] Erro ao alterar exibição:", error);
    showToast("Não foi possível alterar a exibição.", "error");
  }
}

async function removeGift(giftId) {
  const gift = state.gifts.find(item => item.id === giftId);

  if (!gift) {
    return;
  }

  const reserved = getReserved(gift);

  const message = reserved > 0
    ? `Este item possui ${reserved} unidades já escolhidas. Excluir mesmo assim?`
    : `Excluir “${gift.name}” da lista?`;

  if (!window.confirm(message)) {
    return;
  }

  try {
    await deleteDoc(doc(db, "gifts", giftId));
    showToast("Presente removido da lista.");
  } catch (error) {
    console.error("[ADMIN PRESENTES] Erro ao excluir:", error);
    showToast("Não foi possível excluir o presente.", "error");
  }
}

function startRealtimeSync() {
  state.unsubscribe?.();

  state.unsubscribe = onSnapshot(
    giftsCollection,
    snapshot => {
      state.gifts = snapshot.docs
        .map(documentSnapshot => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data()
        }))
        .sort((a, b) => {
          const orderDifference =
            normalizeInteger(a.order, 0) -
            normalizeInteger(b.order, 0);

          if (orderDifference !== 0) {
            return orderDifference;
          }

          return String(a.name || "").localeCompare(
            String(b.name || ""),
            "pt-BR"
          );
        });

      render();
    },
    error => {
      console.error("[ADMIN PRESENTES] Erro ao sincronizar:", error);

      showToast(
        "Não foi possível carregar a lista de presentes do Firestore.",
        "error"
      );
    }
  );
}

/*
  Intercepta o formulário antes do listener antigo do admin.js.
  Isso evita que o presente seja salvo novamente no localStorage.
*/
elements.form?.addEventListener("submit", saveGift, true);

elements.openButton?.addEventListener(
  "click",
  event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openGiftModal();
  },
  true
);

document.addEventListener(
  "click",
  event => {
    const editButton = event.target.closest(
      "[data-admin-edit-gift]"
    );

    if (editButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const gift = state.gifts.find(
        item => item.id === editButton.dataset.adminEditGift
      );

      if (gift) {
        openGiftModal(gift);
      }

      return;
    }

    const toggleButton = event.target.closest(
      "[data-admin-toggle-gift]"
    );

    if (toggleButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      toggleGift(toggleButton.dataset.adminToggleGift);
      return;
    }

    const deleteButton = event.target.closest(
      "[data-admin-delete-gift]"
    );

    if (deleteButton) {
      event.preventDefault();
      event.stopImmediatePropagation();

      removeGift(deleteButton.dataset.adminDeleteGift);
    }
  },
  true
);

injectAdminInterface();
startRealtimeSync();

window.addEventListener("beforeunload", () => {
  state.unsubscribe?.();
});
