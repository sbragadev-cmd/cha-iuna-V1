import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  db
} from "./firebase-config.js";

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
  user: null,
  admin: null,
  unsubscribe: null
};

function normalizeInteger(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(number));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTotal(gift) {
  return normalizeInteger(gift.totalQuantity, 0);
}

function getReserved(gift) {
  return normalizeInteger(gift.reservedQuantity, 0);
}

function getAvailable(gift) {
  return normalizeInteger(
    gift.availableQuantity,
    Math.max(0, getTotal(gift) - getReserved(gift))
  );
}

function showToast(message, type = "success", duration = 4000) {
  if (!elements.toast) {
    console[type === "error" ? "error" : "log"](message);
    return;
  }

  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, duration);
}

function explainFirebaseError(error) {
  console.error("[ADMIN PRESENTES] Erro Firebase:", error);

  if (error?.code === "permission-denied") {
    return "O Firestore negou a gravação. Confira o documento do administrador e as regras.";
  }

  if (error?.code === "unavailable") {
    return "O Firebase está indisponível ou sem conexão neste momento.";
  }

  if (String(error?.message || "").includes("offline")) {
    return "O navegador não conseguiu conectar ao Firestore. Atualize a página e confira a internet.";
  }

  return error?.message || "Não foi possível concluir a operação.";
}

function injectGiftForm() {
  if (!elements.form) {
    throw new Error("O formulário #giftForm não foi encontrado.");
  }

  elements.form.innerHTML = `
    <input id="giftId" type="hidden">

    <label>
      <span>Nome do presente</span>
      <input id="giftName" maxlength="100" required
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
      <span>Descrição</span>
      <textarea id="giftDescription" rows="3" maxlength="300"
        placeholder="Detalhes ou preferência da família"></textarea>
    </label>

    <div class="form-grid">
      <label>
        <span>Endereço da imagem</span>
        <input id="giftImageUrl" type="url" placeholder="https://...">
      </label>

      <label>
        <span>Ordem na lista</span>
        <input id="giftOrder" type="number"
          min="0" max="9999" value="0">
      </label>
    </div>

    <label class="check-field">
      <input id="giftActive" type="checkbox" checked>
      <span>Exibir na lista pública</span>
    </label>

    <div class="admin-gift-privacy-note">
      <strong>Reserva anônima</strong>
      <p>
        O painel mostra apenas os saldos. Nenhum nome de convidado
        será gravado para os presentes.
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
    ?.addEventListener("click", closeModal);
}

function configureTable() {
  if (!elements.tableHead) {
    return;
  }

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

function openModal(gift = null) {
  state.editingId = gift?.id || null;
  elements.form.reset();

  document.querySelector("#giftId").value = gift?.id || "";
  document.querySelector("#giftName").value = gift?.name || "";
  document.querySelector("#giftCategory").value =
    gift?.category || "Fraldas";
  document.querySelector("#giftDescription").value =
    gift?.description || "";
  document.querySelector("#giftImageUrl").value =
    gift?.imageUrl || "";
  document.querySelector("#giftOrder").value =
    normalizeInteger(gift?.order, 0);
  document.querySelector("#giftTotalQuantity").value =
    gift ? Math.max(1, getTotal(gift)) : 1;
  document.querySelector("#giftActive").checked =
    gift?.active !== false;

  if (elements.modalTitle) {
    elements.modalTitle.textContent =
      gift ? "Editar presente" : "Novo presente";
  }

  elements.modal.classList.add("open");
  elements.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  elements.modal?.classList.remove("open");
  elements.modal?.setAttribute("aria-hidden", "true");
  state.editingId = null;
}

function render() {
  const totalUnits = state.gifts.reduce(
    (sum, gift) => sum + getTotal(gift),
    0
  );

  const availableUnits = state.gifts.reduce(
    (sum, gift) => sum + getAvailable(gift),
    0
  );

  const reservedUnits = state.gifts.reduce(
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
        <strong>${totalUnits}</strong>
      </article>

      <article class="summary-card">
        <small>Unidades disponíveis</small>
        <strong>${availableUnits}</strong>
      </article>

      <article class="summary-card">
        <small>Unidades escolhidas</small>
        <strong>${reservedUnits}</strong>
      </article>
    `;
  }

  if (elements.statGifts) {
    elements.statGifts.textContent = String(state.gifts.length);
  }

  if (elements.statReserved) {
    elements.statReserved.textContent =
      `${reservedUnits} unidades escolhidas`;
  }

  if (!elements.tableBody) {
    return;
  }

  if (!state.gifts.length) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            Nenhum presente cadastrado no Firebase.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  elements.tableBody.innerHTML = state.gifts
    .map(gift => {
      const visible = gift.active !== false;

      return `
        <tr>
          <td class="person-cell">
            <strong>${escapeHtml(gift.name || "Sem nome")}</strong>
            <small>${escapeHtml(gift.description || "Sem descrição")}</small>
          </td>

          <td>${escapeHtml(gift.category || "Outro")}</td>
          <td><strong>${getTotal(gift)}</strong></td>
          <td><strong>${getAvailable(gift)}</strong></td>
          <td><strong>${getReserved(gift)}</strong></td>

          <td>
            <span class="status-pill ${visible ? "available" : "pending"}">
              ${visible ? "Visível" : "Oculto"}
            </span>
          </td>

          <td>
            <div class="action-buttons">
              <button class="icon-button" type="button"
                data-firebase-edit-gift="${gift.id}" title="Editar">✎</button>

              <button class="icon-button" type="button"
                data-firebase-toggle-gift="${gift.id}"
                title="${visible ? "Ocultar" : "Exibir"}">
                ${visible ? "◉" : "○"}
              </button>

              <button class="icon-button" type="button"
                data-firebase-delete-gift="${gift.id}" title="Excluir">×</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function saveGift(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const name = document.querySelector("#giftName")?.value.trim() || "";
  const totalQuantity = normalizeInteger(
    document.querySelector("#giftTotalQuantity")?.value,
    0
  );

  if (!name) {
    showToast("Informe o nome do presente.", "error");
    return;
  }

  if (totalQuantity < 1) {
    showToast("Informe uma quantidade válida.", "error");
    return;
  }

  const oldGift = state.gifts.find(
    gift => gift.id === state.editingId
  );

  const reservedQuantity = oldGift
    ? getReserved(oldGift)
    : 0;

  if (totalQuantity < reservedQuantity) {
    showToast(
      `O total não pode ser menor que ${reservedQuantity}, pois essas unidades já foram escolhidas.`,
      "error",
      7000
    );
    return;
  }

  const active =
    document.querySelector("#giftActive")?.checked ?? true;

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
    totalQuantity,
    reservedQuantity,
    availableQuantity: totalQuantity - reservedQuantity,
    active,
    status: active ? "available" : "hidden",
    updatedAt: serverTimestamp(),
    updatedBy: state.user.uid
  };

  const submit = elements.form.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Salvando...";

  try {
    if (state.editingId) {
      await updateDoc(
        doc(db, "gifts", state.editingId),
        payload
      );

      showToast("Presente atualizado no Firebase.");
    } else {
      const reference = doc(collection(db, "gifts"));

      await setDoc(reference, {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: state.user.uid
      });

      showToast("Presente criado no Firebase.");
    }

    closeModal();
  } catch (error) {
    showToast(explainFirebaseError(error), "error", 9000);
  } finally {
    submit.disabled = false;
    submit.textContent = "Salvar presente";
  }
}

async function toggleGift(id) {
  const gift = state.gifts.find(item => item.id === id);

  if (!gift) {
    return;
  }

  const active = gift.active === false;

  try {
    await updateDoc(doc(db, "gifts", id), {
      active,
      status: active ? "available" : "hidden",
      updatedAt: serverTimestamp(),
      updatedBy: state.user.uid
    });
  } catch (error) {
    showToast(explainFirebaseError(error), "error", 9000);
  }
}

async function deleteGift(id) {
  const gift = state.gifts.find(item => item.id === id);

  if (!gift || !confirm(`Excluir “${gift.name}”?`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, "gifts", id));
    showToast("Presente excluído.");
  } catch (error) {
    showToast(explainFirebaseError(error), "error", 9000);
  }
}

function startRealtimeSync() {
  state.unsubscribe?.();

  state.unsubscribe = onSnapshot(
    collection(db, "gifts"),
    snapshot => {
      state.gifts = snapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .sort((a, b) => {
          const difference =
            normalizeInteger(a.order, 0) -
            normalizeInteger(b.order, 0);

          return difference ||
            String(a.name || "").localeCompare(
              String(b.name || ""),
              "pt-BR"
            );
        });

      render();
    },
    error => {
      showToast(explainFirebaseError(error), "error", 9000);
    }
  );
}

async function initialize() {
  try {
    const session = await window.chaIunaAdminReady;

    state.user = session.user;
    state.admin = session.admin;

    injectGiftForm();
    configureTable();
    startRealtimeSync();

    elements.form?.addEventListener("submit", saveGift, true);

    elements.openButton?.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openModal();
      },
      true
    );

    document.addEventListener(
      "click",
      event => {
        const edit = event.target.closest(
          "[data-firebase-edit-gift]"
        );

        const toggle = event.target.closest(
          "[data-firebase-toggle-gift]"
        );

        const remove = event.target.closest(
          "[data-firebase-delete-gift]"
        );

        if (edit) {
          event.preventDefault();
          event.stopImmediatePropagation();

          const gift = state.gifts.find(
            item => item.id === edit.dataset.firebaseEditGift
          );

          if (gift) {
            openModal(gift);
          }

          return;
        }

        if (toggle) {
          event.preventDefault();
          event.stopImmediatePropagation();
          toggleGift(toggle.dataset.firebaseToggleGift);
          return;
        }

        if (remove) {
          event.preventDefault();
          event.stopImmediatePropagation();
          deleteGift(remove.dataset.firebaseDeleteGift);
        }
      },
      true
    );
  } catch (error) {
    console.error("[ADMIN PRESENTES] Inicialização cancelada:", error);
  }
}

initialize();

window.addEventListener("beforeunload", () => {
  state.unsubscribe?.();
});
