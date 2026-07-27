import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  auth,
  db
} from "./firebase-config.js";

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
  unsubscribe: null,
  user: null,
  admin: null,
  authReady: false
};

function showToast(message, type = "success", duration = 4000) {
  if (!elements.toast) {
    console[type === "error" ? "error" : "log"](`[PRESENTES] ${message}`);
    return;
  }

  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.classList.add("show");

  clearTimeout(showToast.timeout);

  showToast.timeout = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, duration);
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

function formatFirebaseError(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  if (code.includes("permission-denied")) {
    return "Permissão negada pelo Firestore. Verifique se existe o documento admins/" +
      (state.user?.uid || "UID_DO_USUARIO") +
      " com active: true e role: owner, admin ou editor.";
  }

  if (code.includes("unauthenticated")) {
    return "Sua sessão não está autenticada. Saia do painel e entre novamente.";
  }

  if (code.includes("unavailable")) {
    return "O Firebase está temporariamente indisponível. Verifique sua internet.";
  }

  return message || "Não foi possível concluir a operação no Firebase.";
}

async function loadAdminProfile(user) {
  if (!user) {
    state.admin = null;
    return null;
  }

  const adminReference = doc(db, "admins", user.uid);
  const adminSnapshot = await getDoc(adminReference);

  if (!adminSnapshot.exists()) {
    state.admin = null;
    return null;
  }

  state.admin = {
    id: adminSnapshot.id,
    ...adminSnapshot.data()
  };

  return state.admin;
}

function isAuthorizedAdmin() {
  if (!state.user || !state.admin) {
    return false;
  }

  const role = String(state.admin.role || "").toLowerCase();

  return state.admin.active === true &&
    ["owner", "admin", "editor"].includes(role);
}

function requireAdmin() {
  if (!state.authReady) {
    showToast("Aguarde a autenticação do painel.", "error");
    return false;
  }

  if (!state.user) {
    showToast("Sua sessão expirou. Entre novamente no painel.", "error");
    return false;
  }

  if (!state.admin) {
    showToast(
      `O usuário está autenticado, mas não existe admins/${state.user.uid} no Firestore.`,
      "error",
      8000
    );
    return false;
  }

  if (!isAuthorizedAdmin()) {
    showToast(
      "O cadastro do administrador precisa ter active: true e role: owner, admin ou editor.",
      "error",
      8000
    );
    return false;
  }

  return true;
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
      <input id="giftName" type="text" maxlength="100" required
        placeholder="Ex.: Fralda tamanho M">
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
        <input id="giftTotalQuantity" type="number"
          min="1" max="999" step="1" value="1" required>
      </label>
    </div>

    <label>
      <span>Descrição opcional</span>
      <textarea id="giftDescription" rows="3" maxlength="300"
        placeholder="Ex.: Preferência por fraldas sem perfume."></textarea>
    </label>

    <div class="form-grid">
      <label>
        <span>Endereço da imagem</span>
        <input id="giftImageUrl" type="url" placeholder="https://...">
      </label>

      <label>
        <span>Ordem na lista</span>
        <input id="giftOrder" type="number"
          min="0" max="9999" step="1" value="0">
      </label>
    </div>

    <label class="check-field">
      <input id="giftActive" type="checkbox" checked>
      <span>Exibir este item na lista pública</span>
    </label>

    <div class="admin-gift-privacy-note">
      <strong>Privacidade das reservas</strong>
      <p>
        O sistema controla somente as quantidades.
        Nenhum nome de convidado será registrado.
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
    ?.addEventListener("click", closeGiftModal);
}

function openGiftModal(gift = null) {
  if (!requireAdmin() || !elements.modal || !elements.form) {
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
  document.querySelector("#giftTotalQuantity").value =
    gift ? Math.max(1, getTotal(gift)) : 1;

  if (elements.modalTitle) {
    elements.modalTitle.textContent = gift
      ? "Editar presente"
      : "Novo presente";
  }

  elements.modal.classList.add("open");
  elements.modal.setAttribute("aria-hidden", "false");
}

function closeGiftModal() {
  elements.modal?.classList.remove("open");
  elements.modal?.setAttribute("aria-hidden", "true");
  state.editingId = null;
}

function render() {
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
    `;
  }

  if (elements.statGifts) {
    elements.statGifts.textContent = String(state.gifts.length);
  }

  if (elements.statReserved) {
    elements.statReserved.textContent =
      `${reservedItems} unidades escolhidas`;
  }

  if (!elements.tableBody) {
    return;
  }

  if (!state.gifts.length) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            Nenhum presente cadastrado no Firestore.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  elements.tableBody.innerHTML = state.gifts.map(gift => {
    const total = getTotal(gift);
    const available = getAvailable(gift);
    const reserved = getReserved(gift);
    const visible = gift.active !== false;

    return `
      <tr>
        <td class="person-cell">
          <strong>${escapeHtml(gift.name || "Sem nome")}</strong>
          <small>${escapeHtml(gift.description || "Sem descrição")}</small>
        </td>

        <td>${escapeHtml(gift.category || "Outro")}</td>
        <td><strong>${total}</strong></td>
        <td><strong>${available}</strong></td>
        <td><strong>${reserved}</strong></td>

        <td>
          <span class="status-pill ${visible ? "available" : "pending"}">
            ${visible ? "Visível" : "Oculto"}
          </span>
        </td>

        <td>
          <div class="action-buttons">
            <button class="icon-button" type="button"
              data-admin-edit-gift="${gift.id}" title="Editar">✎</button>

            <button class="icon-button" type="button"
              data-admin-toggle-gift="${gift.id}"
              title="${visible ? "Ocultar" : "Exibir"}">
              ${visible ? "◉" : "○"}
            </button>

            <button class="icon-button" type="button"
              data-admin-delete-gift="${gift.id}" title="Excluir">×</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function saveGift(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (!requireAdmin()) {
    return;
  }

  const name = document.querySelector("#giftName")?.value.trim() || "";
  const totalQuantity = normalizeInteger(
    document.querySelector("#giftTotalQuantity")?.value,
    0
  );

  if (name.length < 2) {
    showToast("Informe o nome do presente.", "error");
    return;
  }

  if (totalQuantity < 1) {
    showToast("Informe uma quantidade válida.", "error");
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
      `O total não pode ser menor que ${reservedQuantity}, pois essas unidades já foram escolhidas.`,
      "error"
    );
    return;
  }

  const payload = {
    name,
    category:
      document.querySelector("#giftCategory")?.value || "Outro",
    description:
      document.querySelector("#giftDescription")?.value.trim() || "",
    imageUrl:
      document.querySelector("#giftImageUrl")?.value.trim() || "",
    order: normalizeInteger(
      document.querySelector("#giftOrder")?.value,
      0
    ),
    active:
      document.querySelector("#giftActive")?.checked ?? true,
    totalQuantity,
    availableQuantity: totalQuantity - reservedQuantity,
    reservedQuantity,
    status:
      (document.querySelector("#giftActive")?.checked ?? true)
        ? "available"
        : "hidden",
    updatedAt: serverTimestamp(),
    updatedBy: state.user.uid
  };

  const submitButton = elements.form.querySelector(
    'button[type="submit"]'
  );

  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";

  try {
    if (state.editingId) {
      await updateDoc(
        doc(db, "gifts", state.editingId),
        payload
      );

      showToast("Presente atualizado.");
    } else {
      const newGiftReference = doc(giftsCollection);

      await setDoc(newGiftReference, {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: state.user.uid
      });

      showToast("Presente criado no Firebase.");
    }

    closeGiftModal();
  } catch (error) {
    console.error("[ADMIN PRESENTES] Falha ao salvar:", {
      code: error?.code,
      message: error?.message,
      error
    });

    showToast(formatFirebaseError(error), "error", 10000);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Salvar presente";
  }
}

async function toggleGift(id) {
  if (!requireAdmin()) {
    return;
  }

  const gift = state.gifts.find(item => item.id === id);

  if (!gift) {
    return;
  }

  try {
    const active = gift.active === false;

    await updateDoc(doc(db, "gifts", id), {
      active,
      status: active ? "available" : "hidden",
      updatedAt: serverTimestamp(),
      updatedBy: state.user.uid
    });

    showToast(active ? "Presente exibido." : "Presente ocultado.");
  } catch (error) {
    console.error(error);
    showToast(formatFirebaseError(error), "error", 10000);
  }
}

async function removeGift(id) {
  if (!requireAdmin()) {
    return;
  }

  const gift = state.gifts.find(item => item.id === id);

  if (!gift || !confirm(`Excluir “${gift.name}”?`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, "gifts", id));
    showToast("Presente excluído.");
  } catch (error) {
    console.error(error);
    showToast(formatFirebaseError(error), "error", 10000);
  }
}

function startSync() {
  state.unsubscribe?.();

  state.unsubscribe = onSnapshot(
    giftsCollection,
    snapshot => {
      state.gifts = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      })).sort((a, b) => {
        const orderDifference =
          normalizeInteger(a.order, 0) -
          normalizeInteger(b.order, 0);

        return orderDifference ||
          String(a.name || "").localeCompare(
            String(b.name || ""),
            "pt-BR"
          );
      });

      render();
    },
    error => {
      console.error("[ADMIN PRESENTES] Falha na leitura:", error);
      showToast(formatFirebaseError(error), "error", 10000);
    }
  );
}

elements.form?.addEventListener("submit", saveGift, true);

elements.openButton?.addEventListener("click", event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  openGiftModal();
}, true);

document.addEventListener("click", event => {
  const editButton = event.target.closest("[data-admin-edit-gift]");
  const toggleButton = event.target.closest("[data-admin-toggle-gift]");
  const deleteButton = event.target.closest("[data-admin-delete-gift]");

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

  if (toggleButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleGift(toggleButton.dataset.adminToggleGift);
    return;
  }

  if (deleteButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    removeGift(deleteButton.dataset.adminDeleteGift);
  }
}, true);

injectAdminInterface();

onAuthStateChanged(auth, async user => {
  state.authReady = true;
  state.user = user;
  state.admin = null;

  if (!user) {
    showToast("Usuário não autenticado.", "error", 8000);
    return;
  }

  try {
    await loadAdminProfile(user);

    if (!state.admin) {
      showToast(
        `Crie o documento admins/${user.uid} no Firestore para liberar o painel.`,
        "error",
        12000
      );
      return;
    }

    if (!isAuthorizedAdmin()) {
      showToast(
        "Administrador sem permissão ativa. Use active: true e role: owner.",
        "error",
        12000
      );
      return;
    }

    console.log("[ADMIN PRESENTES] Administrador autorizado:", {
      uid: user.uid,
      role: state.admin.role
    });

    startSync();
  } catch (error) {
    console.error("[ADMIN PRESENTES] Erro ao validar administrador:", error);
    showToast(formatFirebaseError(error), "error", 10000);
  }
});

window.addEventListener("beforeunload", () => {
  state.unsubscribe?.();
});
