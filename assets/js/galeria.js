import { db } from "./firebase-config.js";

import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const galleryGrid = document.querySelector("#galleryGrid");
const emptyState = document.querySelector("#emptyState");
const pageFeedback = document.querySelector("#pageFeedback");
const photoCount = document.querySelector("#photoCount");

const gallerySearch = document.querySelector("#gallerySearch");
const clearSearch = document.querySelector("#clearSearch");

const uploadDialog = document.querySelector("#uploadDialog");
const uploadForm = document.querySelector("#uploadForm");
const openUploadDialogButton = document.querySelector("#openUploadDialog");
const emptyUploadButton = document.querySelector("#emptyUploadButton");
const closeUploadDialogButton = document.querySelector("#closeUploadDialog");

const senderName = document.querySelector("#senderName");
const photoFile = document.querySelector("#photoFile");
const photoCaption = document.querySelector("#photoCaption");
const photoConsent = document.querySelector("#photoConsent");
const fileLabel = document.querySelector("#fileLabel");
const imagePreviewWrap = document.querySelector("#imagePreviewWrap");
const imagePreview = document.querySelector("#imagePreview");
const uploadFeedback = document.querySelector("#uploadFeedback");

const photoDialog = document.querySelector("#photoDialog");
const closePhotoDialog = document.querySelector("#closePhotoDialog");
const expandedPhoto = document.querySelector("#expandedPhoto");
const expandedTitle = document.querySelector("#expandedTitle");
const expandedCaption = document.querySelector("#expandedCaption");

const successDialog = document.querySelector("#successDialog");
const closeSuccess = document.querySelector("#closeSuccess");

const menuToggle = document.querySelector("#menuToggle");
const headerNav = document.querySelector("#headerNav");

let photos = [];
let selectedImageData = "";
let unsubscribe = null;

function normalizeText(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function normalizeSearch(value = "") {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setError(fieldId, message = "") {
  const field = document.querySelector(`#${fieldId}`);
  const error = document.querySelector(`#${fieldId}Error`);

  if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
  if (error) error.textContent = message;
}

function clearUploadErrors() {
  ["senderName", "photoFile", "photoConsent"].forEach((field) => {
    setError(field, "");
  });

  uploadFeedback.textContent = "";
  uploadFeedback.className = "form-feedback";
}

function getPhotoSource(photo) {
  return photo.imageData || photo.imageUrl || "";
}

function sortPhotos(items) {
  return [...items].sort((a, b) => {
    const dateA = a.createdAt?.toMillis?.() || 0;
    const dateB = b.createdAt?.toMillis?.() || 0;
    return dateB - dateA;
  });
}

function getFilteredPhotos() {
  const search = normalizeSearch(gallerySearch.value);

  if (!search) return photos;

  return photos.filter((photo) => {
    const searchable = normalizeSearch(
      `${photo.senderName || ""} ${photo.caption || ""}`
    );

    return searchable.includes(search);
  });
}

function renderGallery() {
  const filtered = getFilteredPhotos();
  photoCount.textContent = photos.length;

  if (!filtered.length) {
    galleryGrid.hidden = true;
    emptyState.hidden = false;
    galleryGrid.innerHTML = "";
    return;
  }

  galleryGrid.hidden = false;
  emptyState.hidden = true;

  galleryGrid.innerHTML = filtered
    .map((photo) => {
      const source = getPhotoSource(photo);
      if (!source) return "";

      const sender = photo.senderName || "Convidado";
      const caption = photo.caption || "";

      return `
        <article class="gallery-card">
          <button
            class="gallery-photo-button"
            type="button"
            data-photo-id="${escapeHtml(photo.id)}"
            aria-label="Ampliar foto enviada por ${escapeHtml(sender)}"
          >
            <img
              src="${escapeHtml(source)}"
              alt="${escapeHtml(caption || `Foto enviada por ${sender}`)}"
              loading="lazy"
            >
          </button>

          <div class="gallery-copy">
            <h3>${escapeHtml(sender)}</h3>
            ${caption ? `<p>${escapeHtml(caption)}</p>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function openUploadDialog() {
  clearUploadErrors();
  uploadForm.reset();
  selectedImageData = "";
  fileLabel.textContent = "Clique para selecionar uma foto";
  imagePreviewWrap.hidden = true;
  imagePreview.removeAttribute("src");

  uploadDialog.showModal();
  document.body.classList.add("modal-open");

  setTimeout(() => senderName.focus(), 50);
}

function closeUpload() {
  if (uploadDialog.open) uploadDialog.close();
  document.body.classList.remove("modal-open");
}

function setSubmitting(submitting) {
  const button = uploadForm.querySelector('button[type="submit"]');
  const text = button.querySelector(".button-text");
  const loading = button.querySelector(".button-loading");

  button.disabled = submitting;
  text.hidden = submitting;
  loading.hidden = !submitting;
}

function validateUpload() {
  clearUploadErrors();

  let valid = true;

  if (normalizeText(senderName.value).length < 2) {
    setError("senderName", "Informe seu nome.");
    valid = false;
  }

  if (!selectedImageData) {
    setError("photoFile", "Escolha uma imagem.");
    valid = false;
  }

  if (!photoConsent.checked) {
    setError("photoConsent", "Confirme a autorização de publicação.");
    valid = false;
  }

  return valid;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("FILE_READ_ERROR"));

    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("IMAGE_LOAD_ERROR"));

    image.src = source;
  });
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("INVALID_FILE");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("FILE_TOO_LARGE");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);

  const maxDimension = 1280;
  const scale = Math.min(
    1,
    maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
  );

  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.82;
  let result = canvas.toDataURL("image/jpeg", quality);

  while (result.length > 780000 && quality > 0.45) {
    quality -= 0.08;
    result = canvas.toDataURL("image/jpeg", quality);
  }

  if (result.length > 900000) {
    throw new Error("COMPRESSED_FILE_TOO_LARGE");
  }

  return result;
}

async function handleFileChange() {
  const [file] = photoFile.files;

  selectedImageData = "";
  imagePreviewWrap.hidden = true;
  setError("photoFile", "");

  if (!file) {
    fileLabel.textContent = "Clique para selecionar uma foto";
    return;
  }

  fileLabel.textContent = "Preparando a imagem...";

  try {
    selectedImageData = await compressImage(file);

    imagePreview.src = selectedImageData;
    imagePreviewWrap.hidden = false;
    fileLabel.textContent = file.name;
  } catch (error) {
    console.error("[GALLERY] Erro ao preparar imagem:", error);

    photoFile.value = "";
    fileLabel.textContent = "Clique para selecionar uma foto";

    const message =
      error?.message === "FILE_TOO_LARGE"
        ? "A imagem original deve ter no máximo 8 MB."
        : error?.message === "COMPRESSED_FILE_TOO_LARGE"
          ? "A imagem ainda ficou muito grande após a compressão."
          : "Não foi possível processar esta imagem.";

    setError("photoFile", message);
  }
}

async function submitPhoto(event) {
  event.preventDefault();

  if (!validateUpload()) {
    uploadFeedback.textContent = "Revise os campos destacados.";
    uploadFeedback.className = "form-feedback is-error";
    return;
  }

  setSubmitting(true);

  try {
    await addDoc(collection(db, "gallery"), {
      senderName: normalizeText(senderName.value),
      caption: normalizeText(photoCaption.value),
      imageData: selectedImageData,
      active: true,
      approved: false,
      source: "public-site",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    closeUpload();
    successDialog.showModal();
    document.body.classList.add("modal-open");
  } catch (error) {
    console.error("[GALLERY] Erro ao enviar foto:", error);

    uploadFeedback.textContent =
      "Não foi possível enviar a foto agora. Tente novamente.";
    uploadFeedback.className = "form-feedback is-error";
  } finally {
    setSubmitting(false);
  }
}

function openPhoto(photoId) {
  const photo = photos.find((item) => item.id === photoId);
  if (!photo) return;

  expandedPhoto.src = getPhotoSource(photo);
  expandedPhoto.alt =
    photo.caption || `Foto enviada por ${photo.senderName || "convidado"}`;

  expandedTitle.textContent = photo.senderName || "Convidado";
  expandedCaption.textContent = photo.caption || "";

  photoDialog.showModal();
  document.body.classList.add("modal-open");
}

function startGalleryListener() {
  const galleryQuery = query(
    collection(db, "gallery"),
    where("active", "==", true),
    where("approved", "==", true)
  );

  unsubscribe = onSnapshot(
    galleryQuery,
    (snapshot) => {
      photos = sortPhotos(
        snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data()
        }))
      );

      pageFeedback.textContent = "";
      renderGallery();
    },
    (error) => {
      console.error("[GALLERY] Erro ao carregar galeria:", error);

      galleryGrid.hidden = true;
      emptyState.hidden = false;

      emptyState.querySelector("h3").textContent =
        "Não foi possível carregar a galeria agora.";

      emptyState.querySelector("p").textContent =
        "Atualize a página em alguns instantes.";

      pageFeedback.textContent =
        "A consulta da galeria pode exigir um índice composto no Firestore.";
    }
  );
}

openUploadDialogButton?.addEventListener("click", openUploadDialog);
emptyUploadButton?.addEventListener("click", openUploadDialog);
closeUploadDialogButton?.addEventListener("click", closeUpload);

photoFile?.addEventListener("change", handleFileChange);
uploadForm?.addEventListener("submit", submitPhoto);

gallerySearch?.addEventListener("input", renderGallery);

clearSearch?.addEventListener("click", () => {
  gallerySearch.value = "";
  renderGallery();
});

galleryGrid?.addEventListener("click", (event) => {
  const button = event.target.closest(".gallery-photo-button");
  if (!button) return;

  openPhoto(button.dataset.photoId);
});

closePhotoDialog?.addEventListener("click", () => {
  photoDialog.close();
  document.body.classList.remove("modal-open");
});

closeSuccess?.addEventListener("click", () => {
  successDialog.close();
  document.body.classList.remove("modal-open");
});

[uploadDialog, photoDialog, successDialog].forEach((dialog) => {
  dialog?.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
  });
});

menuToggle?.addEventListener("click", () => {
  const open = !headerNav.classList.contains("open");
  headerNav.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
});

headerNav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    headerNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});

window.addEventListener("beforeunload", () => {
  if (typeof unsubscribe === "function") unsubscribe();
});

startGalleryListener();
