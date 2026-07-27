import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { db } from "./firebase-config.js";

console.log("[CONFIRMAÇÃO] Script carregado.");
console.log("[CONFIRMAÇÃO] Firestore disponível:", Boolean(db));

const $ = selector => document.querySelector(selector);

const requiredElements = {
  form: $("#rsvpForm"),
  feedback: $("#feedback"),
  submitButton: $("#submitButton"),
  attendanceDetails: $("#attendanceDetails"),
  confirmationArea: $("#confirmationArea"),
  successSection: $("#success"),
  name: $("#name"),
  phone: $("#phone"),
  email: $("#email"),
  people: $("#people"),
  children: $("#children"),
  companions: $("#companions"),
  relationship: $("#relationship"),
  city: $("#city"),
  dietary: $("#dietary"),
  message: $("#message"),
  consent: $("#consent"),
  editToken: $("#editToken"),
  lookupForm: $("#lookupForm"),
  lookupCode: $("#lookupCode"),
  lookupFeedback: $("#lookupFeedback"),
  protocol: $("#protocol"),
  successTitle: $("#successTitle"),
  successText: $("#successText"),
  copyProtocol: $("#copyProtocol")
};

const missingElements = Object.entries(requiredElements)
  .filter(([, element]) => !element)
  .map(([name]) => name);

if (missingElements.length) {
  console.error(
    "[CONFIRMAÇÃO] Elementos ausentes no HTML:",
    missingElements
  );

  throw new Error(
    `A página está incompleta. Elementos ausentes: ${missingElements.join(", ")}`
  );
}

const {
  form,
  feedback,
  submitButton,
  attendanceDetails,
  confirmationArea,
  successSection
} = requiredElements;

let editingDocumentId = null;

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function formatPhone(value = "") {
  const number = onlyDigits(value).slice(0, 11);

  if (number.length <= 2) return number;
  if (number.length <= 6) {
    return `(${number.slice(0, 2)}) ${number.slice(2)}`;
  }

  if (number.length <= 10) {
    return `(${number.slice(0, 2)}) ${number.slice(2, 6)}-${number.slice(6)}`;
  }

  return `(${number.slice(0, 2)}) ${number.slice(2, 7)}-${number.slice(7)}`;
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(parsed));
}

function selectedEvent() {
  return form.querySelector('input[name="event"]:checked')?.value || "";
}

function createProtocol() {
  const code = crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase();

  return `IUNA-${code}`;
}

function setFeedback(element, message = "", type = "") {
  element.textContent = message;
  element.className = "form-feedback";

  if (type) {
    element.classList.add(`is-${type}`);
  }
}

function toggleAttendanceDetails() {
  const declined = selectedEvent() === "nao-vou";

  attendanceDetails.classList.toggle("disabled", declined);

  attendanceDetails
    .querySelectorAll("input, select, textarea")
    .forEach(field => {
      field.disabled = declined;
    });

  if (declined) {
    requiredElements.people.value = 0;
    requiredElements.children.value = 0;
    requiredElements.companions.value = "";
    requiredElements.relationship.value = "";
    requiredElements.city.value = "";
  } else if (normalizeInteger(requiredElements.people.value, 0) < 1) {
    requiredElements.people.value = 1;
  }
}

function validateForm() {
  const name = requiredElements.name.value.trim();
  const phone = onlyDigits(requiredElements.phone.value);
  const event = selectedEvent();
  const people = normalizeInteger(requiredElements.people.value, 0);
  const children = normalizeInteger(requiredElements.children.value, 0);

  if (name.length < 2) {
    requiredElements.name.focus();
    throw new Error("Informe seu nome completo.");
  }

  if (phone.length < 10) {
    requiredElements.phone.focus();
    throw new Error("Informe um WhatsApp válido.");
  }

  if (!event) {
    throw new Error("Escolha uma opção de presença.");
  }

  if (event !== "nao-vou") {
    if (people < 1 || people > 15) {
      requiredElements.people.focus();
      throw new Error("Informe o total de pessoas entre 1 e 15.");
    }

    if (children > people) {
      requiredElements.children.focus();
      throw new Error(
        "O número de crianças não pode superar o total de pessoas."
      );
    }
  }

  if (!requiredElements.consent.checked) {
    requiredElements.consent.focus();
    throw new Error(
      "Autorize o uso dos dados para a organização."
    );
  }
}

function createPayload(protocol, editToken) {
  const event = selectedEvent();
  const declined = event === "nao-vou";

  return {
    protocol,
    editToken,
    name: requiredElements.name.value.trim(),
    nameSearch: requiredElements.name.value.trim().toLowerCase(),
    phone: formatPhone(requiredElements.phone.value),
    phoneDigits: onlyDigits(requiredElements.phone.value),
    email: requiredElements.email.value.trim().toLowerCase(),
    event,
    status: declined ? "declined" : "confirmed",
    people: declined
      ? 0
      : normalizeInteger(requiredElements.people.value, 1),
    children: declined
      ? 0
      : normalizeInteger(requiredElements.children.value, 0),
    companions: declined
      ? ""
      : requiredElements.companions.value.trim(),
    relationship: declined
      ? ""
      : requiredElements.relationship.value,
    city: declined
      ? ""
      : requiredElements.city.value.trim(),
    dietary: declined
      ? ""
      : requiredElements.dietary.value.trim(),
    message: requiredElements.message.value.trim(),
    consent: true,
    source: "site",
    updatedAt: serverTimestamp()
  };
}

async function findByProtocol(protocol) {
  console.log("[CONFIRMAÇÃO] Consultando protocolo:", protocol);

  const confirmationQuery = query(
    collection(db, "rsvps"),
    where("protocol", "==", protocol.toUpperCase()),
    limit(1)
  );

  const snapshot = await getDocs(confirmationQuery);

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data()
  };
}

function showSuccess(data, updated = false) {
  confirmationArea.hidden = true;
  successSection.hidden = false;

  requiredElements.successTitle.textContent = updated
    ? "Sua resposta foi atualizada."
    : data.status === "declined"
      ? "Recebemos sua resposta com carinho."
      : "Presença confirmada com carinho!";

  requiredElements.successText.textContent =
    data.status === "declined"
      ? "Sentiremos sua falta, mas agradecemos por avisar."
      : "Obrigado por fazer parte deste momento tão especial.";

  requiredElements.protocol.textContent = data.protocol;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  setFeedback(feedback);

  console.log("[CONFIRMAÇÃO] Formulário enviado.");

  try {
    validateForm();

    submitButton.disabled = true;
    submitButton.textContent = editingDocumentId
      ? "Atualizando..."
      : "Enviando para o Firebase...";

    if (editingDocumentId) {
      const current = await findByProtocol(
        form.dataset.protocol || ""
      );

      if (
        !current ||
        current.id !== editingDocumentId ||
        current.editToken !== requiredElements.editToken.value
      ) {
        throw new Error(
          "Não foi possível validar esta edição."
        );
      }

      const data = createPayload(
        current.protocol,
        current.editToken
      );

      console.log(
        "[CONFIRMAÇÃO] Atualizando documento:",
        editingDocumentId
      );

      await updateDoc(
        doc(db, "rsvps", editingDocumentId),
        data
      );

      console.log(
        "[CONFIRMAÇÃO] Atualização concluída:",
        editingDocumentId
      );

      showSuccess(data, true);
      return;
    }

    const protocol = createProtocol();
    const editToken = crypto.randomUUID();

    const data = {
      ...createPayload(protocol, editToken),
      createdAt: serverTimestamp()
    };

    console.log(
      "[CONFIRMAÇÃO] Enviando para:",
      "iuna-e113d / rsvps"
    );

    console.log(
      "[CONFIRMAÇÃO] Dados preparados:",
      {
        ...data,
        editToken: "[protegido]"
      }
    );

    const documentReference = await addDoc(
      collection(db, "rsvps"),
      data
    );

    console.log(
      "[CONFIRMAÇÃO] Documento salvo com sucesso:",
      documentReference.id
    );

    form.dataset.protocol = protocol;
    showSuccess(data);
  } catch (error) {
    console.error(
      "[CONFIRMAÇÃO] Falha completa:",
      {
        code: error?.code,
        message: error?.message,
        stack: error?.stack
      }
    );

    let message =
      error?.message ||
      "Não foi possível salvar sua resposta.";

    if (error?.code === "permission-denied") {
      message =
        "O Firebase bloqueou a gravação. Publique as regras que permitem create em rsvps.";
    }

    if (error?.code === "failed-precondition") {
      message =
        "O Firestore ainda não está pronto ou precisa de configuração no projeto iuna-e113d.";
    }

    if (error?.code === "unavailable") {
      message =
        "O Firebase está indisponível ou sem conexão. Tente novamente.";
    }

    setFeedback(feedback, message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = editingDocumentId
      ? "Atualizar minha resposta"
      : "Confirmar minha resposta";
  }
});

requiredElements.lookupForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const code = requiredElements.lookupCode
      .value
      .trim()
      .toUpperCase();

    setFeedback(requiredElements.lookupFeedback);

    try {
      if (!/^IUNA-[A-Z0-9]{6}$/.test(code)) {
        throw new Error("Informe um protocolo válido.");
      }

      const data = await findByProtocol(code);

      if (!data) {
        throw new Error("Confirmação não encontrada.");
      }

      editingDocumentId = data.id;
      form.dataset.protocol = data.protocol;

      requiredElements.name.value = data.name || "";
      requiredElements.phone.value = data.phone || "";
      requiredElements.email.value = data.email || "";
      requiredElements.people.value = data.people ?? 1;
      requiredElements.children.value = data.children ?? 0;
      requiredElements.companions.value =
        data.companions || "";
      requiredElements.relationship.value =
        data.relationship || "";
      requiredElements.city.value = data.city || "";
      requiredElements.dietary.value = data.dietary || "";
      requiredElements.message.value = data.message || "";
      requiredElements.consent.checked = true;
      requiredElements.editToken.value =
        data.editToken || "";

      const eventInput = form.querySelector(
        `input[name="event"][value="${CSS.escape(
          data.event || ""
        )}"]`
      );

      if (eventInput) {
        eventInput.checked = true;
      }

      toggleAttendanceDetails();
      submitButton.textContent =
        "Atualizar minha resposta";

      setFeedback(
        requiredElements.lookupFeedback,
        "Confirmação encontrada.",
        "success"
      );

      form.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      console.error(
        "[CONFIRMAÇÃO] Erro na consulta:",
        error
      );

      setFeedback(
        requiredElements.lookupFeedback,
        error?.message ||
          "Não foi possível consultar.",
        "error"
      );
    }
  }
);

requiredElements.phone.addEventListener(
  "input",
  event => {
    event.target.value =
      formatPhone(event.target.value);
  }
);

form
  .querySelectorAll('input[name="event"]')
  .forEach(input => {
    input.addEventListener(
      "change",
      toggleAttendanceDetails
    );
  });

requiredElements.copyProtocol.addEventListener(
  "click",
  async () => {
    const protocol =
      requiredElements.protocol.textContent.trim();

    try {
      await navigator.clipboard.writeText(protocol);
      requiredElements.copyProtocol.textContent =
        "Copiado!";
    } catch {
      window.prompt(
        "Copie seu protocolo:",
        protocol
      );
    }
  }
);

const eventFromUrl =
  new URLSearchParams(window.location.search)
    .get("evento");

if (
  ["bage", "porto-alegre", "ambos"]
    .includes(eventFromUrl)
) {
  const eventInput = form.querySelector(
    `input[name="event"][value="${eventFromUrl}"]`
  );

  if (eventInput) {
    eventInput.checked = true;
  }
}

toggleAttendanceDetails();

console.log(
  "[CONFIRMAÇÃO] Inicialização concluída."
);
