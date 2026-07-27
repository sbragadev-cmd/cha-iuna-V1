import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { db } from "./firebase-config.js";

console.log("[CONFIRMAÇÃO] Script carregado.");
console.log("[CONFIRMAÇÃO] Projeto ativo: cha-da-iuna");
console.log("[CONFIRMAÇÃO] Firestore disponível:", Boolean(db));

const form = document.querySelector("#rsvpForm");
const feedback = document.querySelector("#feedback");
const submitButton = document.querySelector("#submitButton");

const lookupForm = document.querySelector("#lookupForm");
const lookupCode = document.querySelector("#lookupCode");
const lookupFeedback = document.querySelector("#lookupFeedback");

if (!form) {
  throw new Error("O formulário #rsvpForm não foi encontrado.");
}

function showFeedback(element, message = "", type = "") {
  if (!element) return;

  element.textContent = message;
  element.className = "form-feedback";

  if (type) {
    element.classList.add(`is-${type}`);
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
  return element
    ? String(element.value ?? "").trim()
    : fallback;
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

function createProtocol() {
  const randomPart = crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `IUNA-${randomPart}`;
}

function normalizeProtocol(value = "") {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
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
      throw new Error(
        "Informe o total de pessoas entre 1 e 15."
      );
    }

    if (data.children > data.people) {
      throw new Error(
        "O número de crianças não pode superar o total de pessoas."
      );
    }
  }

  if (!data.consent) {
    throw new Error(
      "Autorize o uso dos dados para a organização."
    );
  }
}

function buildPayload(protocol) {
  const event = getCheckedValue("event");
  const declined = event === "nao-vou";
  const name = getValue("#name");
  const phone = getValue("#phone");

  return {
    protocol,
    editToken: crypto.randomUUID(),
    name,
    nameSearch: name.toLowerCase(),
    phone,
    phoneDigits: onlyDigits(phone),
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
    consent: Boolean(getElement("#consent")?.checked),
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
  const protocolElement = getElement("#protocol");

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
        : "Obrigado por fazer parte deste momento tão especial. Guarde o protocolo abaixo para consultar sua confirmação.";
  }

  if (protocolElement) {
    protocolElement.textContent = data.protocol;
  }

  successSection?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  showFeedback(feedback, "");

  try {
    const protocol = createProtocol();
    const data = buildPayload(protocol);

    validate(data);

    submitButton.disabled = true;
    submitButton.textContent = "Confirmando presença...";

    console.log(
      "[CONFIRMAÇÃO] Gravando:",
      `cha-da-iuna / rsvps / ${protocol}`
    );

    await setDoc(
      doc(db, "rsvps", protocol),
      data
    );

    console.log(
      "[CONFIRMAÇÃO] Presença gravada:",
      protocol
    );

    showFeedback(
      feedback,
      `Presença registrada. Seu protocolo é ${protocol}.`,
      "success"
    );

    showSuccess(data);
  } catch (error) {
    console.error(
      "[CONFIRMAÇÃO] Erro ao gravar:",
      error
    );

    let message =
      error?.message ||
      "Não foi possível registrar sua confirmação.";

    if (error?.code === "permission-denied") {
      message =
        "O Firebase bloqueou a gravação. Publique as regras atualizadas no projeto cha-da-iuna.";
    }

    if (error?.code === "failed-precondition") {
      message =
        "O Firestore ainda não foi criado no projeto cha-da-iuna.";
    }

    if (error?.code === "unavailable") {
      message =
        "Não foi possível acessar o Firebase. Verifique sua conexão.";
    }

    showFeedback(feedback, message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Confirmar minha resposta";
  }
});

if (lookupForm) {
  lookupForm.addEventListener("submit", async event => {
    event.preventDefault();

    const protocol = normalizeProtocol(lookupCode?.value);

    if (!protocol || !protocol.startsWith("IUNA-")) {
      showFeedback(
        lookupFeedback,
        "Digite um protocolo válido, como IUNA-AB12CD34.",
        "error"
      );
      return;
    }

    showFeedback(
      lookupFeedback,
      "Consultando confirmação..."
    );

    try {
      const snapshot = await getDoc(
        doc(db, "rsvps", protocol)
      );

      if (!snapshot.exists()) {
        showFeedback(
          lookupFeedback,
          "Nenhuma confirmação foi encontrada com esse protocolo.",
          "error"
        );
        return;
      }

      const data = snapshot.data();

      const eventLabels = {
        bage: "Bagé",
        "porto-alegre": "Porto Alegre",
        ambos: "Bagé e Porto Alegre",
        "nao-vou": "Não poderá participar"
      };

      const statusText =
        data.status === "declined"
          ? "Resposta registrada: não poderá participar."
          : `Presença confirmada para ${eventLabels[data.event] || "o evento"}.`;

      const peopleText =
        data.status === "declined"
          ? ""
          : ` Total de pessoas: ${data.people || 1}.`;

      showFeedback(
        lookupFeedback,
        `${data.name}: ${statusText}${peopleText}`,
        "success"
      );
    } catch (error) {
      console.error(
        "[CONSULTA] Erro:",
        error
      );

      const message =
        error?.code === "permission-denied"
          ? "A consulta foi bloqueada pelas regras do Firebase. Publique as regras atualizadas."
          : "Não foi possível consultar o protocolo agora.";

      showFeedback(
        lookupFeedback,
        message,
        "error"
      );
    }
  });
}

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
    const value = getElement("#protocol")
      ?.textContent
      .trim();

    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      copyButton.textContent = "Copiado!";
    } catch {
      window.prompt("Copie seu protocolo:", value);
    }
  });
}

console.log("[CONFIRMAÇÃO] Inicialização concluída.");
