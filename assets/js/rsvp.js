import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { db } from "./firebase-config.js";

console.log("[CONFIRMAÇÃO] Script carregado.");
console.log("[CONFIRMAÇÃO] Firestore disponível:", Boolean(db));

const form = document.querySelector("#rsvpForm");
const feedback = document.querySelector("#feedback");
const submitButton = document.querySelector("#submitButton");

if (!form) {
  console.error("[CONFIRMAÇÃO] Formulário #rsvpForm não encontrado.");
  throw new Error("O formulário de confirmação não foi encontrado no HTML.");
}

function showFeedback(message = "", type = "") {
  if (!feedback) return;

  feedback.textContent = message;
  feedback.className = "form-feedback";

  if (type) {
    feedback.classList.add(`is-${type}`);
  }
}

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function getElement(selector) {
  return document.querySelector(selector);
}

function getValue(selector, fallback = "") {
  const element = getElement(selector);
  return element ? String(element.value ?? "").trim() : fallback;
}

function getNumber(selector, fallback = 0) {
  const value = Number(getValue(selector, fallback));

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(value));
}

function getCheckedValue(name) {
  return document.querySelector(
    `input[name="${name}"]:checked`
  )?.value || "";
}

function isChecked(selector) {
  return Boolean(getElement(selector)?.checked);
}

function createProtocol() {
  const code = crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase();

  return `IUNA-${code}`;
}

function validate(data) {
  if (data.name.length < 2) {
    throw new Error("Informe seu nome completo.");
  }

  if (data.phoneDigits.length < 10) {
    throw new Error("Informe um WhatsApp válido.");
  }

  if (!data.event) {
    throw new Error("Escolha uma opção de presença.");
  }

  if (data.event !== "nao-vou") {
    if (data.people < 1 || data.people > 15) {
      throw new Error("Informe o total de pessoas entre 1 e 15.");
    }

    if (data.children > data.people) {
      throw new Error(
        "O número de crianças não pode superar o total de pessoas."
      );
    }
  }

  const consentElement = getElement("#consent");

  if (consentElement && !data.consent) {
    throw new Error(
      "Autorize o uso dos dados para a organização."
    );
  }
}

function buildPayload() {
  const event = getCheckedValue("event");
  const declined = event === "nao-vou";
  const name = getValue("#name");
  const phone = getValue("#phone");
  const phoneDigits = onlyDigits(phone);

  return {
    protocol: createProtocol(),
    editToken: crypto.randomUUID(),
    name,
    nameSearch: name.toLowerCase(),
    phone,
    phoneDigits,
    email: getValue("#email").toLowerCase(),
    event,
    status: declined ? "declined" : "confirmed",
    people: declined ? 0 : getNumber("#people", 1),
    children: declined ? 0 : getNumber("#children", 0),
    companions: declined ? "" : getValue("#companions"),
    relationship: declined ? "" : getValue("#relationship"),
    city: declined ? "" : getValue("#city"),
    dietary: declined ? "" : getValue("#dietary"),
    message: getValue("#message"),
    consent: getElement("#consent")
      ? isChecked("#consent")
      : true,
    source: "site",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function showSuccess(data) {
  const confirmationArea = getElement("#confirmationArea");
  const successSection = getElement("#success");
  const successTitle = getElement("#successTitle");
  const successText = getElement("#successText");
  const protocol = getElement("#protocol");

  if (confirmationArea) {
    confirmationArea.hidden = true;
  }

  if (successSection) {
    successSection.hidden = false;
  }

  if (successTitle) {
    successTitle.textContent =
      data.status === "declined"
        ? "Recebemos sua resposta com carinho."
        : "Presença confirmada com carinho!";
  }

  if (successText) {
    successText.textContent =
      data.status === "declined"
        ? "Sentiremos sua falta, mas agradecemos por avisar."
        : "Obrigado por fazer parte deste momento tão especial.";
  }

  if (protocol) {
    protocol.textContent = data.protocol;
  }

  showFeedback(
    `Resposta enviada com sucesso. Protocolo: ${data.protocol}`,
    "success"
  );
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  showFeedback("");

  console.log("[CONFIRMAÇÃO] Formulário enviado.");

  try {
    const data = buildPayload();

    console.log("[CONFIRMAÇÃO] Dados preparados:", {
      ...data,
      editToken: "[protegido]"
    });

    validate(data);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Enviando para o Firebase...";
    }

    console.log(
      "[CONFIRMAÇÃO] Salvando em:",
      "iuna-e113d / rsvps"
    );

    const documentReference = await addDoc(
      collection(db, "rsvps"),
      data
    );

    console.log(
      "[CONFIRMAÇÃO] Documento salvo com sucesso:",
      documentReference.id
    );

    showSuccess(data);
  } catch (error) {
    console.error("[CONFIRMAÇÃO] Erro ao salvar:", {
      code: error?.code,
      message: error?.message,
      stack: error?.stack
    });

    let message =
      error?.message ||
      "Não foi possível salvar sua resposta.";

    if (error?.code === "permission-denied") {
      message =
        "O Firebase bloqueou a gravação. Verifique e publique as regras da coleção rsvps.";
    }

    if (error?.code === "failed-precondition") {
      message =
        "O banco Firestore ainda não foi criado ou configurado no projeto iuna-e113d.";
    }

    if (error?.code === "unavailable") {
      message =
        "Não foi possível acessar o Firebase. Verifique sua conexão.";
    }

    showFeedback(message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Confirmar minha resposta";
    }
  }
});

const phoneInput = getElement("#phone");

if (phoneInput) {
  phoneInput.addEventListener("input", event => {
    event.target.value = event.target.value
      .replace(/[^\d()\s-]/g, "")
      .slice(0, 16);
  });
}

const copyButton = getElement("#copyProtocol");

if (copyButton) {
  copyButton.addEventListener("click", async () => {
    const protocol = getElement("#protocol")?.textContent.trim();

    if (!protocol) return;

    try {
      await navigator.clipboard.writeText(protocol);
      copyButton.textContent = "Copiado!";
    } catch {
      window.prompt("Copie seu protocolo:", protocol);
    }
  });
}

console.log("[CONFIRMAÇÃO] Inicialização concluída.");
