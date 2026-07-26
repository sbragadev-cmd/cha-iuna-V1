const DATA_KEY = "chaIunaParentsDataV1";

const seedData = {
  budget: 6500,

  guests: [
    {
      id: crypto.randomUUID(),
      name: "Ana e Roberto",
      phone: "(53) 99911-2233",
      group: "Família",
      people: 2,
      status: "confirmed",
      notes: ""
    },
    {
      id: crypto.randomUUID(),
      name: "Carolina Braga",
      phone: "(51) 99844-1155",
      group: "Amigos",
      people: 1,
      status: "pending",
      notes: "Vegetariana"
    },
    {
      id: crypto.randomUUID(),
      name: "Paulo e família",
      phone: "(53) 99122-3344",
      group: "Capoeira",
      people: 4,
      status: "confirmed",
      notes: "2 crianças"
    },
    {
      id: crypto.randomUUID(),
      name: "Marina Souza",
      phone: "(51) 99766-5522",
      group: "Trabalho",
      people: 1,
      status: "declined",
      notes: ""
    }
  ],

  photos: [
    {
      id: crypto.randomUUID(),
      title: "Nossa espera",
      url: "",
      description: "Um capítulo cheio de amor começando.",
      published: true
    },
    {
      id: crypto.randomUUID(),
      title: "Primeiros preparativos",
      url: "",
      description: "Cada detalhe pensado com carinho.",
      published: true
    }
  ],

  gifts: [
    {
      id: crypto.randomUUID(),
      name: "Fraldas tamanho M",
      category: "Fraldas",
      price: "R$ 50 a R$ 90",
      priority: "high",
      status: "available",
      link: ""
    },
    {
      id: crypto.randomUUID(),
      name: "Kit de higiene",
      category: "Higiene",
      price: "R$ 80 a R$ 140",
      priority: "medium",
      status: "reserved",
      link: ""
    },
    {
      id: crypto.randomUUID(),
      name: "Manta para bebê",
      category: "Quarto",
      price: "R$ 70 a R$ 120",
      priority: "low",
      status: "received",
      link: ""
    }
  ],

  tasks: [
    {
      id: crypto.randomUUID(),
      title: "Confirmar decoração do piquenique",
      owner: "Pais",
      dueDate: "2026-08-15",
      priority: "high",
      done: false
    },
    {
      id: crypto.randomUUID(),
      title: "Fechar cardápio da tarde",
      owner: "Sizenando",
      dueDate: "2026-08-20",
      priority: "high",
      done: false
    },
    {
      id: crypto.randomUUID(),
      title: "Montar lembrancinhas",
      owner: "Família",
      dueDate: "2026-08-29",
      priority: "medium",
      done: false
    },
    {
      id: crypto.randomUUID(),
      title: "Criar convite digital",
      owner: "Pais",
      dueDate: "2026-07-30",
      priority: "medium",
      done: true
    }
  ],

  expenses: [
    {
      id: crypto.randomUUID(),
      name: "Reserva do local",
      category: "Local",
      amount: 1200
    },
    {
      id: crypto.randomUUID(),
      name: "Materiais de decoração",
      category: "Decoração",
      amount: 480
    },
    {
      id: crypto.randomUUID(),
      name: "Lembrancinhas",
      category: "Lembrancinhas",
      amount: 350
    }
  ]
};

let data = loadData();
let currentView = "dashboard";

const qs = (selector, context = document) =>
  context.querySelector(selector);

const qsa = (selector, context = document) =>
  [...context.querySelectorAll(selector)];

/* =====================================================
   ARMAZENAMENTO LOCAL DOS DADOS
===================================================== */

function loadData() {
  try {
    const saved = localStorage.getItem(DATA_KEY);

    if (!saved) {
      return structuredClone(seedData);
    }

    const parsed = JSON.parse(saved);

    return {
      budget: Number(parsed.budget ?? seedData.budget),
      guests: Array.isArray(parsed.guests)
        ? parsed.guests
        : [],
      photos: Array.isArray(parsed.photos)
        ? parsed.photos
        : [],
      gifts: Array.isArray(parsed.gifts)
        ? parsed.gifts
        : [],
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks
        : [],
      expenses: Array.isArray(parsed.expenses)
        ? parsed.expenses
        : []
    };
  } catch (error) {
    console.error("Erro ao carregar dados locais:", error);
    return structuredClone(seedData);
  }
}

function saveData(message = "Alterações salvas") {
  try {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify(data)
    );

    renderAll();
    showToast(message);
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    showToast("Não foi possível salvar as alterações");
  }
}

/* =====================================================
   FORMATAÇÃO
===================================================== */

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "Sem prazo";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(
    new Date(`${value}T12:00:00Z`)
  );
}

function statusText(status) {
  const statuses = {
    confirmed: "Confirmado",
    pending: "Aguardando",
    declined: "Não irá",
    available: "Disponível",
    reserved: "Reservado",
    received: "Recebido"
  };

  return statuses[status] || status;
}

function priorityText(priority) {
  const priorities = {
    high: "Alta",
    medium: "Média",
    low: "Baixa"
  };

  return priorities[priority] || priority;
}

function escapeHtml(value = "") {
  const characters = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };

  return String(value).replace(
    /[&<>"']/g,
    character => characters[character]
  );
}

function escapeAttribute(value = "") {
  return String(value).replace(
    /['"()]/g,
    ""
  );
}

/* =====================================================
   INTERFACE GERAL
===================================================== */

function showToast(message) {
  const toast = qs("#toast");

  if (!toast) {
    console.info(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timeout);

  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function switchView(view) {
  currentView = view;

  qsa("[data-view-panel]").forEach(panel => {
    panel.classList.toggle(
      "active",
      panel.dataset.viewPanel === view
    );
  });

  qsa(".nav-item[data-view]").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.view === view
    );
  });

  const names = {
    dashboard: "Visão geral",
    guests: "Convidados",
    gallery: "Galeria",
    gifts: "Lista de presentes",
    party: "Gestão da festa"
  };

  const pageTitle = qs("#pageTitle");

  if (pageTitle) {
    pageTitle.textContent =
      names[view] ||
      "Painel dos pais";
  }

  closeSidebar();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function openModal(id) {
  const modal = qs(`#${id}`);

  if (!modal) {
    return;
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function closeSidebar() {
  qs("#sidebar")?.classList.remove("open");
  qs("#sidebarBackdrop")?.classList.remove("open");
}

/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {
  const totalPeople = data.guests.reduce(
    (sum, guest) =>
      sum + Number(guest.people || 1),
    0
  );

  const confirmedPeople = data.guests
    .filter(guest => guest.status === "confirmed")
    .reduce(
      (sum, guest) =>
        sum + Number(guest.people || 1),
      0
    );

  const pendingPeople = data.guests
    .filter(guest => guest.status === "pending")
    .reduce(
      (sum, guest) =>
        sum + Number(guest.people || 1),
      0
    );

  const declinedPeople = data.guests
    .filter(guest => guest.status === "declined")
    .reduce(
      (sum, guest) =>
        sum + Number(guest.people || 1),
      0
    );

  const confirmedPercent = totalPeople
    ? Math.round(
        (confirmedPeople / totalPeople) * 100
      )
    : 0;

  const statGuests = qs("#statGuests");
  const statConfirmed = qs("#statConfirmed");
  const statPhotos = qs("#statPhotos");
  const statGifts = qs("#statGifts");
  const statReserved = qs("#statReserved");
  const statTasks = qs("#statTasks");
  const statDone = qs("#statDone");
  const guestBadge = qs("#guestBadge");

  if (statGuests) {
    statGuests.textContent = totalPeople;
  }

  if (statConfirmed) {
    statConfirmed.textContent =
      `${confirmedPeople} confirmados`;
  }

  if (statPhotos) {
    statPhotos.textContent =
      data.photos.filter(
        photo => photo.published
      ).length;
  }

  if (statGifts) {
    statGifts.textContent =
      data.gifts.length;
  }

  if (statReserved) {
    const reservedCount = data.gifts.filter(
      gift => gift.status !== "available"
    ).length;

    statReserved.textContent =
      `${reservedCount} reservados/recebidos`;
  }

  if (statTasks) {
    statTasks.textContent =
      data.tasks.length;
  }

  if (statDone) {
    const doneCount = data.tasks.filter(
      task => task.done
    ).length;

    statDone.textContent =
      `${doneCount} concluídas`;
  }

  if (guestBadge) {
    guestBadge.textContent =
      data.guests.length;
  }

  const attendancePercent = qs(
    "#attendancePercent"
  );

  const attendanceDonut = qs(
    "#attendanceDonut"
  );

  if (attendancePercent) {
    attendancePercent.textContent =
      `${confirmedPercent}%`;
  }

  if (attendanceDonut) {
    attendanceDonut.style.background =
      `conic-gradient(
        var(--green-700) ${confirmedPercent}%,
        var(--line) ${confirmedPercent}%
      )`;
  }

  const legendConfirmed = qs(
    "#legendConfirmed"
  );

  const legendPending = qs(
    "#legendPending"
  );

  const legendDeclined = qs(
    "#legendDeclined"
  );

  if (legendConfirmed) {
    legendConfirmed.textContent =
      confirmedPeople;
  }

  if (legendPending) {
    legendPending.textContent =
      pendingPeople;
  }

  if (legendDeclined) {
    legendDeclined.textContent =
      declinedPeople;
  }

  const priorityOrder = {
    high: 0,
    medium: 1,
    low: 2
  };

  const priorities = data.tasks
    .filter(task => !task.done)
    .sort(
      (first, second) =>
        priorityOrder[first.priority] -
        priorityOrder[second.priority]
    )
    .slice(0, 4);

  const priorityList = qs("#priorityList");

  if (priorityList) {
    priorityList.innerHTML = priorities.length
      ? priorities.map(task => `
          <div class="priority-item">
            <span
              class="priority-flag ${task.priority}"
            ></span>

            <div class="status-line">
              <strong>
                ${escapeHtml(task.title)}
              </strong>

              <small>
                ${escapeHtml(
                  task.owner ||
                  "Sem responsável"
                )}
                •
                ${formatDate(task.dueDate)}
              </small>
            </div>
          </div>
        `).join("")
      : `
          <div class="empty-state">
            Nenhuma tarefa pendente.
          </div>
        `;
  }

  const eventDate = new Date(
    "2026-09-05T15:00:00-03:00"
  );

  const days = Math.max(
    0,
    Math.ceil(
      (eventDate.getTime() - Date.now()) /
      86400000
    )
  );

  const daysUntilEvent = qs(
    "#daysUntilEvent"
  );

  if (daysUntilEvent) {
    daysUntilEvent.textContent =
      `${days} dias`;
  }
}

/* =====================================================
   CONVIDADOS
===================================================== */

function renderGuests() {
  const term =
    qs("#guestSearch")
      ?.value
      .trim()
      .toLowerCase() || "";

  const filter =
    qs("#guestStatusFilter")
      ?.value || "all";

  const filtered = data.guests.filter(guest => {
    const searchableText =
      `${guest.name} ${guest.phone}`
        .toLowerCase();

    const matchesTerm =
      searchableText.includes(term);

    const matchesStatus =
      filter === "all" ||
      guest.status === filter;

    return matchesTerm && matchesStatus;
  });

  const guestTableBody = qs(
    "#guestTableBody"
  );

  if (guestTableBody) {
    guestTableBody.innerHTML = filtered
      .map(guest => `
        <tr>
          <td class="person-cell">
            <strong>
              ${escapeHtml(guest.name)}
            </strong>

            <small>
              ${escapeHtml(
                guest.notes ||
                "Sem observações"
              )}
            </small>
          </td>

          <td>
            ${escapeHtml(
              guest.phone ||
              "—"
            )}
          </td>

          <td>
            ${escapeHtml(guest.group)}
          </td>

          <td>
            ${Number(guest.people || 1)}
          </td>

          <td>
            <span
              class="status-pill ${guest.status}"
            >
              ${statusText(guest.status)}
            </span>
          </td>

          <td>
            <div class="action-buttons">
              <button
                class="icon-button"
                type="button"
                data-edit-guest="${guest.id}"
                title="Editar"
              >
                ✎
              </button>

              <button
                class="icon-button"
                type="button"
                data-delete-guest="${guest.id}"
                title="Excluir"
              >
                ×
              </button>
            </div>
          </td>
        </tr>
      `)
      .join("");
  }

  const guestEmpty = qs("#guestEmpty");

  if (guestEmpty) {
    guestEmpty.hidden =
      filtered.length > 0;
  }
}

/* =====================================================
   GALERIA
===================================================== */

function renderGallery() {
  const galleryGrid = qs("#galleryGrid");

  if (!galleryGrid) {
    return;
  }

  galleryGrid.innerHTML = data.photos
    .map(photo => `
      <article class="gallery-card">
        <div
          class="gallery-image"
          ${
            photo.url
              ? `style="background-image:url('${escapeAttribute(
                  photo.url
                )}')"`
              : ""
          }
        >
          ${photo.url ? "" : "Iúna"}
        </div>

        <div class="gallery-card-body">
          <h3>
            ${escapeHtml(photo.title)}
          </h3>

          <p>
            ${escapeHtml(
              photo.description ||
              "Sem descrição."
            )}
          </p>

          <div class="card-meta">
            <span
              class="status-pill ${
                photo.published
                  ? "confirmed"
                  : "pending"
              }"
            >
              ${
                photo.published
                  ? "Publicada"
                  : "Rascunho"
              }
            </span>

            <div class="action-buttons">
              <button
                class="icon-button"
                type="button"
                data-toggle-photo="${photo.id}"
                title="Alterar publicação"
              >
                ${photo.published ? "◉" : "○"}
              </button>

              <button
                class="icon-button"
                type="button"
                data-delete-photo="${photo.id}"
                title="Excluir"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </article>
    `)
    .join("");

  const galleryEmpty = qs(
    "#galleryEmpty"
  );

  if (galleryEmpty) {
    galleryEmpty.hidden =
      data.photos.length > 0;
  }
}

/* =====================================================
   PRESENTES
===================================================== */

function renderGifts() {
  const available = data.gifts.filter(
    gift => gift.status === "available"
  ).length;

  const reserved = data.gifts.filter(
    gift => gift.status === "reserved"
  ).length;

  const received = data.gifts.filter(
    gift => gift.status === "received"
  ).length;

  const giftSummary = qs("#giftSummary");

  if (giftSummary) {
    giftSummary.innerHTML = `
      <article class="summary-card">
        <small>Disponíveis</small>
        <strong>${available}</strong>
      </article>

      <article class="summary-card">
        <small>Reservados</small>
        <strong>${reserved}</strong>
      </article>

      <article class="summary-card">
        <small>Recebidos</small>
        <strong>${received}</strong>
      </article>
    `;
  }

  const giftTableBody = qs(
    "#giftTableBody"
  );

  if (giftTableBody) {
    giftTableBody.innerHTML = data.gifts
      .map(gift => `
        <tr>
          <td class="person-cell">
            <strong>
              ${escapeHtml(gift.name)}
            </strong>

            <small>
              ${
                gift.link
                  ? "Possui link"
                  : "Sem link"
              }
            </small>
          </td>

          <td>
            ${escapeHtml(gift.category)}
          </td>

          <td>
            ${escapeHtml(
              gift.price ||
              "—"
            )}
          </td>

          <td>
            <span
              class="priority-pill ${gift.priority}"
            >
              ${priorityText(gift.priority)}
            </span>
          </td>

          <td>
            <span
              class="status-pill ${gift.status}"
            >
              ${statusText(gift.status)}
            </span>
          </td>

          <td>
            <div class="action-buttons">
              <button
                class="icon-button"
                type="button"
                data-cycle-gift="${gift.id}"
                title="Alterar situação"
              >
                ↻
              </button>

              <button
                class="icon-button"
                type="button"
                data-delete-gift="${gift.id}"
                title="Excluir"
              >
                ×
              </button>
            </div>
          </td>
        </tr>
      `)
      .join("");
  }
}

/* =====================================================
   GESTÃO DA FESTA
===================================================== */

function renderParty() {
  const spent = data.expenses.reduce(
    (sum, item) =>
      sum + Number(item.amount || 0),
    0
  );

  const balance =
    Number(data.budget || 0) - spent;

  const percent = data.budget
    ? Math.min(
        100,
        Math.round(
          (spent / data.budget) * 100
        )
      )
    : 0;

  const budgetPlanned = qs(
    "#budgetPlanned"
  );

  const budgetSpent = qs(
    "#budgetSpent"
  );

  const budgetBalance = qs(
    "#budgetBalance"
  );

  const budgetPercent = qs(
    "#budgetPercent"
  );

  const budgetProgressBar = qs(
    "#budgetProgressBar"
  );

  if (budgetPlanned) {
    budgetPlanned.textContent =
      formatCurrency(data.budget);
  }

  if (budgetSpent) {
    budgetSpent.textContent =
      formatCurrency(spent);
  }

  if (budgetBalance) {
    budgetBalance.textContent =
      formatCurrency(balance);
  }

  if (budgetPercent) {
    budgetPercent.textContent =
      `${percent}%`;
  }

  if (budgetProgressBar) {
    budgetProgressBar.style.width =
      `${percent}%`;
  }

  const taskList = qs("#taskList");

  if (taskList) {
    taskList.innerHTML = data.tasks
      .map(task => `
        <div
          class="task-item ${
            task.done ? "done" : ""
          }"
        >
          <input
            type="checkbox"
            data-toggle-task="${task.id}"
            ${task.done ? "checked" : ""}
            aria-label="Concluir tarefa"
          >

          <div class="task-copy">
            <strong>
              ${escapeHtml(task.title)}
            </strong>

            <small>
              ${escapeHtml(
                task.owner ||
                "Sem responsável"
              )}
              •
              ${formatDate(task.dueDate)}
            </small>
          </div>

          <span
            class="priority-pill ${task.priority}"
          >
            ${priorityText(task.priority)}
          </span>

          <button
            class="icon-button"
            type="button"
            data-delete-task="${task.id}"
            title="Excluir"
          >
            ×
          </button>
        </div>
      `)
      .join("");
  }

  const expenseList = qs("#expenseList");

  if (expenseList) {
    expenseList.innerHTML =
      data.expenses.length
        ? data.expenses.map(expense => `
            <div class="expense-item">
              <div>
                <strong>
                  ${escapeHtml(expense.name)}
                </strong>

                <small>
                  ${escapeHtml(
                    expense.category
                  )}
                </small>
              </div>

              <strong>
                ${formatCurrency(
                  expense.amount
                )}
              </strong>

              <button
                class="icon-button"
                type="button"
                data-delete-expense="${expense.id}"
                title="Excluir"
              >
                ×
              </button>
            </div>
          `).join("")
        : `
            <div class="empty-state">
              Nenhuma despesa cadastrada.
            </div>
          `;
  }
}

function renderAll() {
  renderDashboard();
  renderGuests();
  renderGallery();
  renderGifts();
  renderParty();
}

/* =====================================================
   MENU E NAVEGAÇÃO
===================================================== */

qsa(".nav-item[data-view]").forEach(item => {
  item.addEventListener("click", () => {
    switchView(item.dataset.view);
  });
});

qsa("[data-go-view]").forEach(item => {
  item.addEventListener("click", () => {
    switchView(item.dataset.goView);
  });
});

qsa("[data-open-modal]").forEach(item => {
  item.addEventListener("click", () => {
    openModal(item.dataset.openModal);
  });
});

qsa(".modal-close, .modal-cancel").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.closest(".modal"));
  });
});

qsa(".modal").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

qs("#menuButton")?.addEventListener(
  "click",
  () => {
    qs("#sidebar")?.classList.add("open");

    qs("#sidebarBackdrop")
      ?.classList.add("open");
  }
);

qs("#sidebarClose")?.addEventListener(
  "click",
  closeSidebar
);

qs("#sidebarBackdrop")?.addEventListener(
  "click",
  closeSidebar
);

/*
  O evento do botão #logoutButton não fica neste arquivo.

  O logout é controlado pelo arquivo admin-auth.js,
  usando o Firebase Authentication.
*/

/* =====================================================
   FILTROS DE CONVIDADOS
===================================================== */

qs("#guestSearch")?.addEventListener(
  "input",
  renderGuests
);

qs("#guestStatusFilter")?.addEventListener(
  "change",
  renderGuests
);

/* =====================================================
   FORMULÁRIO DE CONVIDADOS
===================================================== */

qs("#guestForm")?.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const id =
      qs("#guestId")?.value || "";

    const name =
      qs("#guestName")
        ?.value
        .trim() || "";

    if (!name) {
      showToast(
        "Informe o nome do convidado"
      );
      return;
    }

    const guest = {
      id: id || crypto.randomUUID(),

      name,

      phone:
        qs("#guestPhone")
          ?.value
          .trim() || "",

      group:
        qs("#guestGroup")
          ?.value || "Família",

      people: Math.max(
        1,
        Number(
          qs("#guestPeople")
            ?.value || 1
        )
      ),

      status:
        qs("#guestStatus")
          ?.value || "pending",

      notes:
        qs("#guestNotes")
          ?.value
          .trim() || ""
    };

    if (id) {
      data.guests = data.guests.map(item =>
        item.id === id
          ? guest
          : item
      );
    } else {
      data.guests.push(guest);
    }

    event.target.reset();

    if (qs("#guestId")) {
      qs("#guestId").value = "";
    }

    if (qs("#guestPeople")) {
      qs("#guestPeople").value = 1;
    }

    if (qs("#guestModalTitle")) {
      qs("#guestModalTitle").textContent =
        "Novo convidado";
    }

    closeModal(qs("#guestModal"));

    saveData(
      id
        ? "Convidado atualizado"
        : "Convidado adicionado"
    );
  }
);

/* =====================================================
   FORMULÁRIO DE FOTOS
===================================================== */

qs("#photoForm")?.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const title =
      qs("#photoTitle")
        ?.value
        .trim() || "";

    if (!title) {
      showToast(
        "Informe o título da foto"
      );
      return;
    }

    data.photos.unshift({
      id: crypto.randomUUID(),

      title,

      url:
        qs("#photoUrl")
          ?.value
          .trim() || "",

      description:
        qs("#photoDescription")
          ?.value
          .trim() || "",

      published:
        qs("#photoPublished")
          ?.checked ?? true
    });

    event.target.reset();

    if (qs("#photoPublished")) {
      qs("#photoPublished").checked = true;
    }

    closeModal(qs("#photoModal"));
    saveData("Foto adicionada");
  }
);

/* =====================================================
   FORMULÁRIO DE PRESENTES
===================================================== */

qs("#giftForm")?.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const name =
      qs("#giftName")
        ?.value
        .trim() || "";

    if (!name) {
      showToast(
        "Informe o nome do presente"
      );
      return;
    }

    data.gifts.push({
      id: crypto.randomUUID(),

      name,

      category:
        qs("#giftCategory")
          ?.value || "Outros",

      price:
        qs("#giftPrice")
          ?.value
          .trim() || "",

      priority:
        qs("#giftPriority")
          ?.value || "medium",

      status:
        qs("#giftStatus")
          ?.value || "available",

      link:
        qs("#giftLink")
          ?.value
          .trim() || ""
    });

    event.target.reset();

    closeModal(qs("#giftModal"));
    saveData("Presente adicionado");
  }
);

/* =====================================================
   FORMULÁRIO DE TAREFAS
===================================================== */

qs("#taskForm")?.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const title =
      qs("#taskTitle")
        ?.value
        .trim() || "";

    if (!title) {
      showToast(
        "Informe o título da tarefa"
      );
      return;
    }

    data.tasks.push({
      id: crypto.randomUUID(),

      title,

      owner:
        qs("#taskOwner")
          ?.value
          .trim() || "",

      dueDate:
        qs("#taskDueDate")
          ?.value || "",

      priority:
        qs("#taskPriority")
          ?.value || "medium",

      done: false
    });

    event.target.reset();

    closeModal(qs("#taskModal"));
    saveData("Tarefa adicionada");
  }
);

/* =====================================================
   FORMULÁRIO DE DESPESAS
===================================================== */

qs("#expenseForm")?.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const name =
      qs("#expenseName")
        ?.value
        .trim() || "";

    const amount = Number(
      qs("#expenseAmount")
        ?.value || 0
    );

    if (!name) {
      showToast(
        "Informe o nome da despesa"
      );
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      showToast(
        "Informe um valor válido"
      );
      return;
    }

    data.expenses.push({
      id: crypto.randomUUID(),

      name,

      category:
        qs("#expenseCategory")
          ?.value || "Outros",

      amount
    });

    event.target.reset();

    closeModal(qs("#expenseModal"));
    saveData("Despesa adicionada");
  }
);

/* =====================================================
   ORÇAMENTO
===================================================== */

qs("#editBudgetButton")?.addEventListener(
  "click",
  () => {
    const value = window.prompt(
      "Informe o novo orçamento total em reais:",
      String(data.budget)
    );

    if (value === null) {
      return;
    }

    const normalizedValue = value
      .replace(/\./g, "")
      .replace(",", ".");

    const parsed =
      Number(normalizedValue);

    if (
      !Number.isFinite(parsed) ||
      parsed < 0
    ) {
      showToast(
        "Informe um valor válido"
      );
      return;
    }

    data.budget = parsed;
    saveData("Orçamento atualizado");
  }
);

/* =====================================================
   AÇÕES DINÂMICAS
===================================================== */

document.addEventListener(
  "click",
  event => {
    const editGuest = event.target.closest(
      "[data-edit-guest]"
    );

    if (editGuest) {
      const guest = data.guests.find(
        item =>
          item.id ===
          editGuest.dataset.editGuest
      );

      if (!guest) {
        return;
      }

      if (qs("#guestId")) {
        qs("#guestId").value =
          guest.id;
      }

      if (qs("#guestName")) {
        qs("#guestName").value =
          guest.name;
      }

      if (qs("#guestPhone")) {
        qs("#guestPhone").value =
          guest.phone || "";
      }

      if (qs("#guestGroup")) {
        qs("#guestGroup").value =
          guest.group;
      }

      if (qs("#guestPeople")) {
        qs("#guestPeople").value =
          guest.people;
      }

      if (qs("#guestStatus")) {
        qs("#guestStatus").value =
          guest.status;
      }

      if (qs("#guestNotes")) {
        qs("#guestNotes").value =
          guest.notes || "";
      }

      if (qs("#guestModalTitle")) {
        qs("#guestModalTitle").textContent =
          "Editar convidado";
      }

      openModal("guestModal");
      return;
    }

    const deleteGuest = event.target.closest(
      "[data-delete-guest]"
    );

    if (
      deleteGuest &&
      window.confirm(
        "Excluir este convidado?"
      )
    ) {
      data.guests = data.guests.filter(
        item =>
          item.id !==
          deleteGuest.dataset.deleteGuest
      );

      saveData("Convidado excluído");
      return;
    }

    const togglePhoto = event.target.closest(
      "[data-toggle-photo]"
    );

    if (togglePhoto) {
      data.photos = data.photos.map(item => {
        if (
          item.id !==
          togglePhoto.dataset.togglePhoto
        ) {
          return item;
        }

        return {
          ...item,
          published: !item.published
        };
      });

      saveData(
        "Publicação da foto atualizada"
      );

      return;
    }

    const deletePhoto = event.target.closest(
      "[data-delete-photo]"
    );

    if (
      deletePhoto &&
      window.confirm(
        "Excluir esta foto?"
      )
    ) {
      data.photos = data.photos.filter(
        item =>
          item.id !==
          deletePhoto.dataset.deletePhoto
      );

      saveData("Foto excluída");
      return;
    }

    const cycleGift = event.target.closest(
      "[data-cycle-gift]"
    );

    if (cycleGift) {
      const order = [
        "available",
        "reserved",
        "received"
      ];

      data.gifts = data.gifts.map(item => {
        if (
          item.id !==
          cycleGift.dataset.cycleGift
        ) {
          return item;
        }

        const currentIndex =
          order.indexOf(item.status);

        const nextStatus =
          order[
            (currentIndex + 1) %
            order.length
          ];

        return {
          ...item,
          status: nextStatus
        };
      });

      saveData(
        "Situação do presente atualizada"
      );

      return;
    }

    const deleteGift = event.target.closest(
      "[data-delete-gift]"
    );

    if (
      deleteGift &&
      window.confirm(
        "Excluir este presente?"
      )
    ) {
      data.gifts = data.gifts.filter(
        item =>
          item.id !==
          deleteGift.dataset.deleteGift
      );

      saveData("Presente excluído");
      return;
    }

    const toggleTask = event.target.closest(
      "[data-toggle-task]"
    );

    if (toggleTask) {
      data.tasks = data.tasks.map(item => {
        if (
          item.id !==
          toggleTask.dataset.toggleTask
        ) {
          return item;
        }

        return {
          ...item,
          done: toggleTask.checked
        };
      });

      saveData(
        toggleTask.checked
          ? "Tarefa concluída"
          : "Tarefa reaberta"
      );

      return;
    }

    const deleteTask = event.target.closest(
      "[data-delete-task]"
    );

    if (
      deleteTask &&
      window.confirm(
        "Excluir esta tarefa?"
      )
    ) {
      data.tasks = data.tasks.filter(
        item =>
          item.id !==
          deleteTask.dataset.deleteTask
      );

      saveData("Tarefa excluída");
      return;
    }

    const deleteExpense = event.target.closest(
      "[data-delete-expense]"
    );

    if (
      deleteExpense &&
      window.confirm(
        "Excluir esta despesa?"
      )
    ) {
      data.expenses = data.expenses.filter(
        item =>
          item.id !==
          deleteExpense.dataset.deleteExpense
      );

      saveData("Despesa excluída");
    }
  }
);

/* =====================================================
   TECLA ESCAPE
===================================================== */

document.addEventListener(
  "keydown",
  event => {
    if (event.key !== "Escape") {
      return;
    }

    const openModalElement = qs(
      ".modal.open"
    );

    if (openModalElement) {
      closeModal(openModalElement);
    }

    closeSidebar();
  }
);

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

const currentDate = qs("#currentDate");

if (currentDate) {
  currentDate.textContent =
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(new Date());
}

renderAll();
switchView(currentView);