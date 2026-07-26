import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

import {
  db,
  storage
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
const MAX_FILE_SIZE = 8 * 1024 * 1024;
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

function updatePreview() {
  if (!preview) return;

  preview.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    const removeButton = document.createElement("button");

    image.src = URL.createObjectURL(file);
    image.alt = `Prévia da foto ${index + 1}`;

    image.addEventListener(
      "load",
      () => URL.revokeObjectURL(image.src),
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

function validateFiles(files) {
  const validFiles = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFeedback(
        `O arquivo "${file.name}" não é uma imagem JPG, PNG ou WEBP.`,
        "error"
      );
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFeedback(
        `A imagem "${file.name}" ultrapassa o limite de 8 MB.`,
        "error"
      );
      continue;
    }

    validFiles.push(file);
  }

  return validFiles;
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

function safeFileName(fileName) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase();
}

function uploadFile(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    const storageReference = ref(storage, path);

    const task = uploadBytesResumable(
      storageReference,
      file,
      {
        contentType: file.type,
        customMetadata: {
          uploadedFrom: "cha-iuna-home"
        }
      }
    );

    task.on(
      "state_changed",
      snapshot => {
        const percentage =
          snapshot.totalBytes > 0
            ? snapshot.bytesTransferred / snapshot.totalBytes
            : 0;

        onProgress(percentage);
      },
      reject,
      async () => {
        const downloadURL =
          await getDownloadURL(task.snapshot.ref);

        resolve({
          downloadURL,
          storagePath: task.snapshot.ref.fullPath
        });
      }
    );
  });
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
    document.querySelector("#photoSenderName")?.value.trim();

  const eventName =
    document.querySelector("#photoEvent")?.value;

  const caption =
    document.querySelector("#photoCaption")?.value.trim();

  const consent =
    document.querySelector("#photoConsent")?.checked;

  if (!consent) {
    setFeedback(
      "Precisamos da sua autorização para guardar as fotos.",
      "error"
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";
  progressBox.hidden = false;
  progressBar.style.width = "0%";
  progressText.textContent = "Preparando o envio...";

  const submissionId =
    `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;

  const uploadedPhotos = [];

  try {
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];

      const path =
        `guest-photos/${new Date().getFullYear()}/${submissionId}/` +
        `${index + 1}-${safeFileName(file.name)}`;

      const uploadedPhoto = await uploadFile(
        file,
        path,
        fileProgress => {
          const totalProgress =
            ((index + fileProgress) / selectedFiles.length) * 100;

          progressBar.style.width =
            `${Math.round(totalProgress)}%`;

          progressText.textContent =
            `Enviando foto ${index + 1} de ${selectedFiles.length}...`;
        }
      );

      uploadedPhotos.push({
        ...uploadedPhoto,
        originalName: file.name,
        contentType: file.type,
        size: file.size
      });
    }

    await addDoc(
      collection(db, "photoSubmissions"),
      {
        submissionId,
        senderName,
        event: eventName,
        caption,
        photos: uploadedPhotos,
        photoCount: uploadedPhotos.length,
        status: "pending",
        consent: true,
        createdAt: serverTimestamp(),
        source: "home"
      }
    );

    form.reset();
    selectedFiles = [];
    updatePreview();

    progressBar.style.width = "100%";
    progressText.textContent = "Envio concluído.";

    setFeedback(
      "Fotos enviadas com carinho! Elas aparecerão na galeria após a aprovação dos pais.",
      "success"
    );
  } catch (error) {
    console.error(
      "[FOTOS] Erro no envio:",
      error
    );

    setFeedback(
      "Não foi possível concluir o envio. Verifique as regras do Storage e do Firestore.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar fotos";

    window.setTimeout(() => {
      progressBox.hidden = true;
    }, 2500);
  }
});
