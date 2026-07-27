import {
  collection,
  getDocs,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  db
} from "./firebase-config.js";

const galleryGrid = document.querySelector("#galleryGrid");
const galleryStatus = document.querySelector("#galleryStatus");
const galleryEmpty = document.querySelector("#galleryEmpty");
const galleryCount = document.querySelector("#galleryCount");
const filterButtons = Array.from(
  document.querySelectorAll(".gallery-filter")
);
const loadMoreBox = document.querySelector("#galleryLoadMore");
const loadMoreButton = document.querySelector("#loadMoreButton");

const lightbox = document.querySelector("#galleryLightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxCategory = document.querySelector("#lightboxCategory");
const lightboxTitle = document.querySelector("#lightboxTitle");
const lightboxCaption = document.querySelector("#lightboxCaption");
const lightboxSender = document.querySelector("#lightboxSender");
const lightboxPrevious = document.querySelector("#lightboxPrevious");
const lightboxNext = document.querySelector("#lightboxNext");

const PAGE_SIZE = 12;

const categoryLabels = {
  "nossa-espera": "Nossa espera",
  preparativos: "Preparativos",
  bage: "Bagé",
  "porto-alegre": "Porto Alegre",
  familia: "Família",
  amigos: "Amigos",
  outro: "Outro momento",
  geral: "Lembrança"
};

let allPhotos = [];
let filteredPhotos = [];
let visibleCount = PAGE_SIZE;
let lightboxIndex = 0;
let previousFocus = null;

function escapeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createGalleryCard(photo, index) {
  const article = document.createElement("article");
  article.className = "gallery-card";
  article.dataset.category = photo.event;

  const button = document.createElement("button");
  button.className = "gallery-card-button";
  button.type = "button";
  button.setAttribute(
    "aria-label",
    `Ampliar fotografia: ${photo.caption || "Lembrança da Iúna"}`
  );

  const image = document.createElement("img");
  image.src = photo.imageData;
  image.alt = photo.caption || "Fotografia da galeria da Iúna";
  image.loading = index < 4 ? "eager" : "lazy";
  image.decoding = "async";

  const overlay = document.createElement("div");
  overlay.className = "gallery-card-overlay";
  overlay.innerHTML = `
    <span class="gallery-card-category">
      ${escapeText(categoryLabels[photo.event] || "Lembrança")}
    </span>

    <strong>
      ${escapeText(photo.caption || "Uma lembrança especial")}
    </strong>

    <small>
      Enviada por ${escapeText(photo.senderName || "Pessoa querida")}
    </small>
  `;

  button.append(image, overlay);

  button.addEventListener("click", () => {
    openLightbox(index, button);
  });

  article.appendChild(button);

  return article;
}

function renderGallery() {
  if (!galleryGrid || !galleryEmpty || !galleryCount) {
    return;
  }

  const visiblePhotos =
    filteredPhotos.slice(0, visibleCount);

  galleryGrid.innerHTML = "";

  visiblePhotos.forEach((photo, index) => {
    galleryGrid.appendChild(
      createGalleryCard(photo, index)
    );
  });

  galleryCount.textContent =
    String(filteredPhotos.length);

  const hasPhotos =
    filteredPhotos.length > 0;

  galleryEmpty.hidden = hasPhotos;
  galleryGrid.hidden = !hasPhotos;

  if (loadMoreBox) {
    loadMoreBox.hidden =
      !hasPhotos ||
      visibleCount >= filteredPhotos.length;
  }
}

function applyFilter(filter) {
  visibleCount = PAGE_SIZE;

  filteredPhotos =
    filter === "all"
      ? [...allPhotos]
      : allPhotos.filter(photo => photo.event === filter);

  filterButtons.forEach(button => {
    const isActive =
      button.dataset.filter === filter;

    button.classList.toggle("active", isActive);
    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  });

  renderGallery();
}

async function loadGallery() {
  try {
    const photosQuery = query(
      collection(db, "photos"),
      where("status", "==", "published"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(photosQuery);

    allPhotos = snapshot.docs
      .map(documentSnapshot => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      }))
      .filter(photo => Boolean(photo.imageData));

    filteredPhotos = [...allPhotos];

    if (galleryStatus) {
      galleryStatus.hidden = true;
    }

    renderGallery();
  } catch (error) {
    console.error("[GALERIA] Erro ao carregar fotos:", error);

    if (galleryStatus) {
      galleryStatus.innerHTML = `
        <p>
          Não foi possível carregar a galeria.
          Verifique as regras e o índice do Firestore.
        </p>
      `;
    }

    if (galleryCount) {
      galleryCount.textContent = "0";
    }
  }
}

function updateLightbox() {
  const photo = filteredPhotos[lightboxIndex];

  if (!photo) {
    closeLightbox();
    return;
  }

  lightboxImage.src = photo.imageData;
  lightboxImage.alt =
    photo.caption || "Fotografia da galeria da Iúna";

  lightboxCategory.textContent =
    categoryLabels[photo.event] || "Lembrança";

  lightboxTitle.textContent =
    photo.caption || "Uma lembrança especial";

  lightboxCaption.textContent =
    "Esta fotografia faz parte do álbum da Iúna.";

  lightboxSender.textContent =
    photo.senderName || "Pessoa querida";

  lightboxPrevious.disabled =
    filteredPhotos.length <= 1;

  lightboxNext.disabled =
    filteredPhotos.length <= 1;
}

function openLightbox(index, trigger) {
  if (!lightbox || !filteredPhotos[index]) {
    return;
  }

  lightboxIndex = index;
  previousFocus = trigger || document.activeElement;

  updateLightbox();

  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");

  document.querySelector(".lightbox-close")?.focus();
}

function closeLightbox() {
  if (!lightbox) return;

  lightbox.hidden = true;
  document.body.classList.remove("lightbox-open");

  if (lightboxImage) {
    lightboxImage.src = "";
  }

  previousFocus?.focus?.();
}

function showPreviousPhoto() {
  if (!filteredPhotos.length) return;

  lightboxIndex =
    (lightboxIndex - 1 + filteredPhotos.length)
    % filteredPhotos.length;

  updateLightbox();
}

function showNextPhoto() {
  if (!filteredPhotos.length) return;

  lightboxIndex =
    (lightboxIndex + 1)
    % filteredPhotos.length;

  updateLightbox();
}

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    applyFilter(button.dataset.filter || "all");
  });
});

loadMoreButton?.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderGallery();
});

document
  .querySelectorAll("[data-lightbox-close]")
  .forEach(element => {
    element.addEventListener("click", closeLightbox);
  });

lightboxPrevious?.addEventListener(
  "click",
  showPreviousPhoto
);

lightboxNext?.addEventListener(
  "click",
  showNextPhoto
);

document.addEventListener("keydown", event => {
  if (!lightbox || lightbox.hidden) {
    return;
  }

  if (event.key === "Escape") {
    closeLightbox();
  }

  if (event.key === "ArrowLeft") {
    showPreviousPhoto();
  }

  if (event.key === "ArrowRight") {
    showNextPhoto();
  }
});

loadGallery();
