import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  db
} from "./firebase-config.js";

const form = document.querySelector("#photoUploadForm");
const fileInput = document.querySelector("#photoFiles");
const preview = document.querySelector("#photoPreview");
const feedback = document.querySelector("#photoFeedback");
const progressBox = document.querySelector("#photoUploadProgress");
const progressBar = document.querySelector("#photoUploadProgressBar");
const progressText = document.querySelector("#photoUploadProgressText");
const submitButton = form?.querySelector('button[type="submit"]');

const MAX_FILES = 5;
const MAX_ORIGINAL_SIZE = 15 * 1024 * 1024;
const MAX_DIMENSION = 1280;
const MAX_BASE64_LENGTH = 900000;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

let selectedFiles = [];

function setFeedback(message, type = "") {
  if (!feedback) return;

  feedback.textContent = message;
  feedback.className = `form-feedback ${type}`.trim();
}

function setProgress(percent, message) {
  if (progressBox) {
    progressBox.hidden = false;
  }

  if (progressBar) {
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  if (progressText) {
    progressText.textContent = message;
  }
}

function validateFiles(files) {
  const validFiles = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFeedback(
        `O arquivo "${file.name}" não é JPG, PNG ou WEBP.`,
        "error"
      );
      continue;
    }

    if (file.size > MAX_ORIGINAL_SIZE) {
      setFeedback(
        `A imagem "${file.name}" ultrapassa 15 MB.`,
        "error"
      );
      continue;
    }

    validFiles.push(file);
  }

  return validFiles;
}

function updatePreview() {
  if (!preview) return;

  preview.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const figure = document.createElement("figure");
    figure.className = "photo-preview-item";

    const image = document.createElement("img");
    const removeButton = document.createElement("button");
    const objectURL = URL.createObjectURL(file);

    image.src = objectURL;
    image.alt = `Prévia da foto ${index + 1}`;

    image.addEventListener(
      "load",
      () => URL.revokeObjectURL(objectURL),
      { once: true }
    );

    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute(
      "aria-label",
      `Remover ${file.name}`
    );

    removeButton.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      updatePreview();
    });

    figure.append(image, removeButton);
    preview.appendChild(figure);
  });
}

fileInput?.addEventListener("change", () => {
  setFeedback("");

  const files = validateFiles(
    Array.from(fileInput.files || [])
  );

  selectedFiles = files.slice(0, MAX_FILES);

  if (files.length > MAX_FILES) {
    setFeedback(
      "Foram mantidas apenas as cinco primeiras imagens.",
      "error"
    );
  }

  updatePreview();
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(
      new Error(`Não foi possível ler a imagem "${file.name}".`)
    );

    reader.readAsDataURL(file);
  });
}

function loadImage(dataURL) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(
      new Error("Não foi possível abrir a imagem selecionada.")
    );

    image.src = dataURL;
  });
}

async function compressImage(file) {
  const originalDataURL = await readFileAsDataURL(file);
  const image = await loadImage(originalDataURL);

  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(originalWidth, originalHeight)
  );

  let width = Math.max(1, Math.round(originalWidth * scale));
  let height = Math.max(1, Math.round(originalHeight * scale));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new Error("O navegador não conseguiu preparar a imagem.");
  }

  let quality = 0.78;
  let imageData = "";

  while (true) {
    canvas.width = width;
    canvas.height = height;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    imageData = canvas.toDataURL("image/jpeg", quality);

    if (imageData.length <= MAX_BASE64_LENGTH) {
      break;
    }

    if (quality > 0.42) {
      quality -= 0.08;
      continue;
    }

    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    quality = 0.7;

    if (width < 480 || height < 320) {
      throw new Error(
        `A imagem "${file.name}" continua grande demais para o Firestore.`
      );
    }
  }

  return {
    imageData,
    width,
    height,
    contentType: "image/jpeg",
    originalName: file.name,
    originalSize: file.size
  };
}

function describeFirebaseError(error) {
  const code = error?.code || "";

  const messages = {
    "permission-denied":
      "O Firestore recusou o envio. Verifique e publique as regras do Firestore.",
    "firestore/permission-denied":
      "O Firestore recusou o envio. Verifique e publique as regras do Firestore.",
    "resource-exhausted":
      "A imagem ficou grande demais para o Firestore.",
    "firestore/resource-exhausted":
      "A imagem ficou grande demais para o Firestore.",
    "unavailable":
      "O Firebase está temporariamente indisponível. Tente novamente.",
    "firestore/unavailable":
      "O Firebase está temporariamente indisponível. Tente novamente."
  };

  return messages[code]
    || error?.message
    || "Não foi possível concluir o envio.";
}

form?.addEventListener("submit", async event => {
  event.preventDefault();
  setFeedback("");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (!selectedFiles.length) {
    setFeedback(
      "Selecione pelo menos uma foto.",
      "error"
    );
    return;
  }

  const senderName =
    document.querySelector("#photoSenderName")?.value.trim() || "";

  const eventName =
    document.querySelector("#photoEvent")?.value || "outro";

  const caption =
    document.querySelector("#photoCaption")?.value.trim() || "";

  const consent =
    Boolean(document.querySelector("#photoConsent")?.checked);

  if (senderName.length < 2) {
    setFeedback(
      "Informe o nome de quem está enviando.",
      "error"
    );
    return;
  }

  if (!consent) {
    setFeedback(
      "Marque a autorização para enviar as fotos.",
      "error"
    );
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";
  }

  setProgress(2, "Preparando as imagens...");

  const submissionId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let savedCount = 0;

  try {
    for (
      let index = 0;
      index < selectedFiles.length;
      index += 1
    ) {
      const file = selectedFiles[index];

      setProgress(
        Math.round((index / selectedFiles.length) * 100),
        `Comprimindo foto ${index + 1} de ${selectedFiles.length}...`
      );

      const compressed = await compressImage(file);

      setProgress(
        Math.round(((index + 0.5) / selectedFiles.length) * 100),
        `Salvando foto ${index + 1} no Firestore...`
      );

      await addDoc(
        collection(db, "photos"),
        {
          submissionId,
          senderName,
          event: eventName,
          caption,
          imageData: compressed.imageData,
          width: compressed.width,
          height: compressed.height,
          contentType: compressed.contentType,
          originalName: compressed.originalName,
          originalSize: compressed.originalSize,
          status: "pending",
          consent: true,
          createdAt: serverTimestamp(),
          source: "home"
        }
      );

      savedCount += 1;

      setProgress(
        Math.round(((index + 1) / selectedFiles.length) * 100),
        `Foto ${index + 1} de ${selectedFiles.length} salva.`
      );
    }

    form.reset();
    selectedFiles = [];
    updatePreview();

    setProgress(100, "Envio concluído.");

    setFeedback(
      `${savedCount} ${savedCount === 1 ? "foto foi enviada" : "fotos foram enviadas"} com sucesso!`,
      "success"
    );
  } catch (error) {
    console.error("[FOTOS] Erro completo:", error);

    setFeedback(
      describeFirebaseError(error),
      "error"
    );

    setProgress(
      0,
      savedCount
        ? `${savedCount} foto(s) foram salvas antes do erro.`
        : "O envio não foi concluído."
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar fotos";
    }

    window.setTimeout(() => {
      if (progressBox) {
        progressBox.hidden = true;
      }
    }, 4000);
  }
});
