const SESSION_KEY = "chaIunaParentsSession";
const DATA_KEY = "chaIunaParentsDataV1";

if (!sessionStorage.getItem(SESSION_KEY) && !localStorage.getItem(SESSION_KEY)) {
  window.location.replace("./login.html");
}

const seedData = {
  budget: 6500,
  guests: [
    { id: crypto.randomUUID(), name: "Ana e Roberto", phone: "(53) 99911-2233", group: "Família", people: 2, status: "confirmed", notes: "" },
    { id: crypto.randomUUID(), name: "Carolina Braga", phone: "(51) 99844-1155", group: "Amigos", people: 1, status: "pending", notes: "Vegetariana" },
    { id: crypto.randomUUID(), name: "Paulo e família", phone: "(53) 99122-3344", group: "Capoeira", people: 4, status: "confirmed", notes: "2 crianças" },
    { id: crypto.randomUUID(), name: "Marina Souza", phone: "(51) 99766-5522", group: "Trabalho", people: 1, status: "declined", notes: "" }
  ],
  photos: [
    { id: crypto.randomUUID(), title: "Nossa espera", url: "", description: "Um capítulo cheio de amor começando.", published: true },
    { id: crypto.randomUUID(), title: "Primeiros preparativos", url: "", description: "Cada detalhe pensado com carinho.", published: true }
  ],
  gifts: [
    { id: crypto.randomUUID(), name: "Fraldas tamanho M", category: "Fraldas", price: "R$ 50 a R$ 90", priority: "high", status: "available", link: "" },
    { id: crypto.randomUUID(), name: "Kit de higiene", category: "Higiene", price: "R$ 80 a R$ 140", priority: "medium", status: "reserved", link: "" },
    { id: crypto.randomUUID(), name: "Manta para bebê", category: "Quarto", price: "R$ 70 a R$ 120", priority: "low", status: "received", link: "" }
  ],
  tasks: [
    { id: crypto.randomUUID(), title: "Confirmar decoração do piquenique", owner: "Pais", dueDate: "2026-08-15", priority: "high", done: false },
    { id: crypto.randomUUID(), title: "Fechar cardápio da tarde", owner: "Sizenando", dueDate: "2026-08-20", priority: "high", done: false },
    { id: crypto.randomUUID(), title: "Montar lembrancinhas", owner: "Família", dueDate: "2026-08-29", priority: "medium", done: false },
    { id: crypto.randomUUID(), title: "Criar convite digital", owner: "Pais", dueDate: "2026-07-30", priority: "medium", done: true }
  ],
  expenses: [
    { id: crypto.randomUUID(), name: "Reserva do local", category: "Local", amount: 1200 },
    { id: crypto.randomUUID(), name: "Materiais de decoração", category: "Decoração", amount: 480 },
    { id: crypto.randomUUID(), name: "Lembrancinhas", category: "Lembrancinhas", amount: 350 }
  ]
};

let data = loadData();
let currentView = "dashboard";

const qs = (selector, context = document) => context.querySelector(selector);
const qsa = (selector, context = document) => [...context.querySelectorAll(selector)];

function loadData() {
  try {
    const saved = localStorage.getItem(DATA_KEY);
    return saved ? JSON.parse(saved) : structuredClone(seedData);
  } catch {
    return structuredClone(seedData);
  }
}

function saveData(message = "Alterações salvas") {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
  renderAll();
  showToast(message);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function statusText(status) {
  return ({ confirmed: "Confirmado", pending: "Aguardando", declined: "Não irá", available: "Disponível", reserved: "Reservado", received: "Recebido" })[status] || status;
}

function priorityText(priority) {
  return ({ high: "Alta", medium: "Média", low: "Baixa" })[priority] || priority;
}

function showToast(message) {
  const toast = qs("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

function switchView(view) {
  currentView = view;
  qsa("[data-view-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  qsa(".nav-item[data-view]").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  const names = { dashboard: "Visão geral", guests: "Convidados", gallery: "Galeria", gifts: "Lista de presentes", party: "Gestão da festa" };
  qs("#pageTitle").textContent = names[view];
  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(id) {
  const modal = qs(`#${id}`);
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function closeSidebar() {
  qs("#sidebar").classList.remove("open");
  qs("#sidebarBackdrop").classList.remove("open");
}

function renderDashboard() {
  const totalPeople = data.guests.reduce((sum, guest) => sum + Number(guest.people || 1), 0);
  const confirmedPeople = data.guests.filter(g => g.status === "confirmed").reduce((sum, g) => sum + Number(g.people || 1), 0);
  const pendingPeople = data.guests.filter(g => g.status === "pending").reduce((sum, g) => sum + Number(g.people || 1), 0);
  const declinedPeople = data.guests.filter(g => g.status === "declined").reduce((sum, g) => sum + Number(g.people || 1), 0);
  const confirmedPercent = totalPeople ? Math.round((confirmedPeople / totalPeople) * 100) : 0;

  qs("#statGuests").textContent = totalPeople;
  qs("#statConfirmed").textContent = `${confirmedPeople} confirmados`;
  qs("#statPhotos").textContent = data.photos.filter(p => p.published).length;
  qs("#statGifts").textContent = data.gifts.length;
  qs("#statReserved").textContent = `${data.gifts.filter(g => g.status !== "available").length} reservados/recebidos`;
  qs("#statTasks").textContent = data.tasks.length;
  qs("#statDone").textContent = `${data.tasks.filter(t => t.done).length} concluídas`;
  qs("#guestBadge").textContent = data.guests.length;

  qs("#attendancePercent").textContent = `${confirmedPercent}%`;
  qs("#attendanceDonut").style.background = `conic-gradient(var(--green-700) ${confirmedPercent}%, var(--line) ${confirmedPercent}%)`;
  qs("#legendConfirmed").textContent = confirmedPeople;
  qs("#legendPending").textContent = pendingPeople;
  qs("#legendDeclined").textContent = declinedPeople;

  const priorities = data.tasks.filter(t => !t.done).sort((a,b) => ({high:0,medium:1,low:2}[a.priority] - ({high:0,medium:1,low:2}[b.priority])).slice(0,4);
  qs("#priorityList").innerHTML = priorities.length ? priorities.map(task => `
    <div class="priority-item">
      <span class="priority-flag ${task.priority}"></span>
      <div class="status-line"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.owner || "Sem responsável")} • ${formatDate(task.dueDate)}</small></div>
    </div>`).join("") : `<div class="empty-state">Nenhuma tarefa pendente.</div>`;

  const eventDate = new Date("2026-09-05T15:00:00-03:00");
  const days = Math.max(0, Math.ceil((eventDate - new Date()) / 86400000));
  qs("#daysUntilEvent").textContent = `${days} dias`;
}

function renderGuests() {
  const term = qs("#guestSearch")?.value.trim().toLowerCase() || "";
  const filter = qs("#guestStatusFilter")?.value || "all";
  const filtered = data.guests.filter(guest => {
    const matchesTerm = `${guest.name} ${guest.phone}`.toLowerCase().includes(term);
    const matchesStatus = filter === "all" || guest.status === filter;
    return matchesTerm && matchesStatus;
  });

  qs("#guestTableBody").innerHTML = filtered.map(guest => `
    <tr>
      <td class="person-cell"><strong>${escapeHtml(guest.name)}</strong><small>${escapeHtml(guest.notes || "Sem observações")}</small></td>
      <td>${escapeHtml(guest.phone || "—")}</td>
      <td>${escapeHtml(guest.group)}</td>
      <td>${guest.people}</td>
      <td><span class="status-pill ${guest.status}">${statusText(guest.status)}</span></td>
      <td><div class="action-buttons">
        <button class="icon-button" data-edit-guest="${guest.id}" title="Editar">✎</button>
        <button class="icon-button" data-delete-guest="${guest.id}" title="Excluir">×</button>
      </div></td>
    </tr>`).join("");

  qs("#guestEmpty").hidden = filtered.length > 0;
}

function renderGallery() {
  qs("#galleryGrid").innerHTML = data.photos.map(photo => `
    <article class="gallery-card">
      <div class="gallery-image" ${photo.url ? `style="background-image:url('${escapeAttribute(photo.url)}')"` : ""}>${photo.url ? "" : "Iúna"}</div>
      <div class="gallery-card-body">
        <h3>${escapeHtml(photo.title)}</h3>
        <p>${escapeHtml(photo.description || "Sem descrição.")}</p>
        <div class="card-meta">
          <span class="status-pill ${photo.published ? "confirmed" : "pending"}">${photo.published ? "Publicada" : "Rascunho"}</span>
          <div class="action-buttons">
            <button class="icon-button" data-toggle-photo="${photo.id}" title="Alterar publicação">${photo.published ? "◉" : "○"}</button>
            <button class="icon-button" data-delete-photo="${photo.id}" title="Excluir">×</button>
          </div>
        </div>
      </div>
    </article>`).join("");
  qs("#galleryEmpty").hidden = data.photos.length > 0;
}

function renderGifts() {
  const available = data.gifts.filter(g => g.status === "available").length;
  const reserved = data.gifts.filter(g => g.status === "reserved").length;
  const received = data.gifts.filter(g => g.status === "received").length;
  qs("#giftSummary").innerHTML = `
    <article class="summary-card"><small>Disponíveis</small><strong>${available}</strong></article>
    <article class="summary-card"><small>Reservados</small><strong>${reserved}</strong></article>
    <article class="summary-card"><small>Recebidos</small><strong>${received}</strong></article>`;

  qs("#giftTableBody").innerHTML = data.gifts.map(gift => `
    <tr>
      <td class="person-cell"><strong>${escapeHtml(gift.name)}</strong><small>${gift.link ? "Possui link" : "Sem link"}</small></td>
      <td>${escapeHtml(gift.category)}</td>
      <td>${escapeHtml(gift.price || "—")}</td>
      <td><span class="priority-pill ${gift.priority}">${priorityText(gift.priority)}</span></td>
      <td><span class="status-pill ${gift.status}">${statusText(gift.status)}</span></td>
      <td><div class="action-buttons">
        <button class="icon-button" data-cycle-gift="${gift.id}" title="Alterar situação">↻</button>
        <button class="icon-button" data-delete-gift="${gift.id}" title="Excluir">×</button>
      </div></td>
    </tr>`).join("");
}

function renderParty() {
  const spent = data.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = data.budget - spent;
  const percent = data.budget ? Math.min(100, Math.round((spent / data.budget) * 100)) : 0;
  qs("#budgetPlanned").textContent = formatCurrency(data.budget);
  qs("#budgetSpent").textContent = formatCurrency(spent);
  qs("#budgetBalance").textContent = formatCurrency(balance);
  qs("#budgetPercent").textContent = `${percent}%`;
  qs("#budgetProgressBar").style.width = `${percent}%`;

  qs("#taskList").innerHTML = data.tasks.map(task => `
    <div class="task-item ${task.done ? "done" : ""}">
      <input type="checkbox" data-toggle-task="${task.id}" ${task.done ? "checked" : ""} aria-label="Concluir tarefa">
      <div class="task-copy"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.owner || "Sem responsável")} • ${formatDate(task.dueDate)}</small></div>
      <span class="priority-pill ${task.priority}">${priorityText(task.priority)}</span>
      <button class="icon-button" data-delete-task="${task.id}" title="Excluir">×</button>
    </div>`).join("");

  qs("#expenseList").innerHTML = data.expenses.length ? data.expenses.map(expense => `
    <div class="expense-item">
      <div><strong>${escapeHtml(expense.name)}</strong><small>${escapeHtml(expense.category)}</small></div>
      <strong>${formatCurrency(expense.amount)}</strong>
      <button class="icon-button" data-delete-expense="${expense.id}" title="Excluir">×</button>
    </div>`).join("") : `<div class="empty-state">Nenhuma despesa cadastrada.</div>`;
}

function renderAll() {
  renderDashboard();
  renderGuests();
  renderGallery();
  renderGifts();
  renderParty();
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[char]);
}
function escapeAttribute(value = "") {
  return String(value).replace(/['"()]/g, "");
}

qsa(".nav-item[data-view]").forEach(item => item.addEventListener("click", () => switchView(item.dataset.view)));
qsa("[data-go-view]").forEach(item => item.addEventListener("click", () => switchView(item.dataset.goView)));
qsa("[data-open-modal]").forEach(item => item.addEventListener("click", () => openModal(item.dataset.openModal)));
qsa(".modal-close,.modal-cancel").forEach(button => button.addEventListener("click", () => closeModal(button.closest(".modal"))));
qsa(".modal").forEach(modal => modal.addEventListener("click", event => { if (event.target === modal) closeModal(modal); }));

qs("#menuButton").addEventListener("click", () => {
  qs("#sidebar").classList.add("open");
  qs("#sidebarBackdrop").classList.add("open");
});
qs("#sidebarClose").addEventListener("click", closeSidebar);
qs("#sidebarBackdrop").addEventListener("click", closeSidebar);

qs("#logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  window.location.replace("./login.html");
});

qs("#guestSearch").addEventListener("input", renderGuests);
qs("#guestStatusFilter").addEventListener("change", renderGuests);

qs("#guestForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = qs("#guestId").value;
  const guest = {
    id: id || crypto.randomUUID(),
    name: qs("#guestName").value.trim(),
    phone: qs("#guestPhone").value.trim(),
    group: qs("#guestGroup").value,
    people: Number(qs("#guestPeople").value || 1),
    status: qs("#guestStatus").value,
    notes: qs("#guestNotes").value.trim()
  };
  if (id) data.guests = data.guests.map(item => item.id === id ? guest : item);
  else data.guests.push(guest);
  event.target.reset();
  qs("#guestId").value = "";
  qs("#guestPeople").value = 1;
  qs("#guestModalTitle").textContent = "Novo convidado";
  closeModal(qs("#guestModal"));
  saveData(id ? "Convidado atualizado" : "Convidado adicionado");
});

qs("#photoForm").addEventListener("submit", event => {
  event.preventDefault();
  data.photos.unshift({
    id: crypto.randomUUID(),
    title: qs("#photoTitle").value.trim(),
    url: qs("#photoUrl").value.trim(),
    description: qs("#photoDescription").value.trim(),
    published: qs("#photoPublished").checked
  });
  event.target.reset();
  qs("#photoPublished").checked = true;
  closeModal(qs("#photoModal"));
  saveData("Foto adicionada");
});

qs("#giftForm").addEventListener("submit", event => {
  event.preventDefault();
  data.gifts.push({
    id: crypto.randomUUID(),
    name: qs("#giftName").value.trim(),
    category: qs("#giftCategory").value,
    price: qs("#giftPrice").value.trim(),
    priority: qs("#giftPriority").value,
    status: qs("#giftStatus").value,
    link: qs("#giftLink").value.trim()
  });
  event.target.reset();
  closeModal(qs("#giftModal"));
  saveData("Presente adicionado");
});

qs("#taskForm").addEventListener("submit", event => {
  event.preventDefault();
  data.tasks.push({
    id: crypto.randomUUID(),
    title: qs("#taskTitle").value.trim(),
    owner: qs("#taskOwner").value.trim(),
    dueDate: qs("#taskDueDate").value,
    priority: qs("#taskPriority").value,
    done: false
  });
  event.target.reset();
  closeModal(qs("#taskModal"));
  saveData("Tarefa adicionada");
});

qs("#expenseForm").addEventListener("submit", event => {
  event.preventDefault();
  data.expenses.push({
    id: crypto.randomUUID(),
    name: qs("#expenseName").value.trim(),
    category: qs("#expenseCategory").value,
    amount: Number(qs("#expenseAmount").value || 0)
  });
  event.target.reset();
  closeModal(qs("#expenseModal"));
  saveData("Despesa adicionada");
});

qs("#editBudgetButton").addEventListener("click", () => {
  const value = prompt("Informe o novo orçamento total em reais:", String(data.budget));
  if (value === null) return;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) {
    showToast("Informe um valor válido");
    return;
  }
  data.budget = parsed;
  saveData("Orçamento atualizado");
});

document.addEventListener("click", event => {
  const editGuest = event.target.closest("[data-edit-guest]");
  if (editGuest) {
    const guest = data.guests.find(item => item.id === editGuest.dataset.editGuest);
    if (!guest) return;
    qs("#guestId").value = guest.id;
    qs("#guestName").value = guest.name;
    qs("#guestPhone").value = guest.phone;
    qs("#guestGroup").value = guest.group;
    qs("#guestPeople").value = guest.people;
    qs("#guestStatus").value = guest.status;
    qs("#guestNotes").value = guest.notes;
    qs("#guestModalTitle").textContent = "Editar convidado";
    openModal("guestModal");
  }

  const deleteGuest = event.target.closest("[data-delete-guest]");
  if (deleteGuest && confirm("Excluir este convidado?")) {
    data.guests = data.guests.filter(item => item.id !== deleteGuest.dataset.deleteGuest);
    saveData("Convidado excluído");
  }

  const togglePhoto = event.target.closest("[data-toggle-photo]");
  if (togglePhoto) {
    data.photos = data.photos.map(item => item.id === togglePhoto.dataset.togglePhoto ? { ...item, published: !item.published } : item);
    saveData("Publicação da foto atualizada");
  }

  const deletePhoto = event.target.closest("[data-delete-photo]");
  if (deletePhoto && confirm("Excluir esta foto?")) {
    data.photos = data.photos.filter(item => item.id !== deletePhoto.dataset.deletePhoto);
    saveData("Foto excluída");
  }

  const cycleGift = event.target.closest("[data-cycle-gift]");
  if (cycleGift) {
    const order = ["available", "reserved", "received"];
    data.gifts = data.gifts.map(item => {
      if (item.id !== cycleGift.dataset.cycleGift) return item;
      const next = order[(order.indexOf(item.status) + 1) % order.length];
      return { ...item, status: next };
    });
    saveData("Situação do presente atualizada");
  }

  const deleteGift = event.target.closest("[data-delete-gift]");
  if (deleteGift && confirm("Excluir este presente?")) {
    data.gifts = data.gifts.filter(item => item.id !== deleteGift.dataset.deleteGift);
    saveData("Presente excluído");
  }

  const toggleTask = event.target.closest("[data-toggle-task]");
  if (toggleTask) {
    data.tasks = data.tasks.map(item => item.id === toggleTask.dataset.toggleTask ? { ...item, done: toggleTask.checked } : item);
    saveData(toggleTask.checked ? "Tarefa concluída" : "Tarefa reaberta");
  }

  const deleteTask = event.target.closest("[data-delete-task]");
  if (deleteTask && confirm("Excluir esta tarefa?")) {
    data.tasks = data.tasks.filter(item => item.id !== deleteTask.dataset.deleteTask);
    saveData("Tarefa excluída");
  }

  const deleteExpense = event.target.closest("[data-delete-expense]");
  if (deleteExpense && confirm("Excluir esta despesa?")) {
    data.expenses = data.expenses.filter(item => item.id !== deleteExpense.dataset.deleteExpense);
    saveData("Despesa excluída");
  }
});

qs("#currentDate").textContent = new Intl.DateTimeFormat("pt-BR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" }).format(new Date());
renderAll();
