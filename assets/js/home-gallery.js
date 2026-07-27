import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { db } from "./firebase-config.js";

const galleryGrid = document.querySelector("#homeGalleryGrid");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPhotoSource(photo) {
  return (
    photo.imageData ||
    photo.imageUrl ||
    photo.downloadURL ||
    photo.url ||
    ""
  );
}

function getPhotoLabel(photo) {
  const labels = {
    geral: "Nossa história",
    "nossa-espera": "Nossa espera",
    preparativos: "Preparativos",
    bage: "Bagé",
    "porto-alegre": "Porto Alegre",
    familia: "Família",
    amigos: "Amigos",
    outro: "Um momento especial"
  };

  return labels[photo.event] || "Nossa história";
}

function renderPhoto(photo, index) {
  const source = getPhotoSource(photo);
  const caption =
    photo.caption ||
    photo.description ||
    "Uma lembrança guardada com carinho.";
  const label = getPhotoLabel(photo);
  const featuredClass = index === 0 ? " home-photo-featured" : "";

  return `
    <article class="home-photo-card${featuredClass} reveal">
      <a
        class="home-photo-link"
        href="./galeria.html"
        aria-label="Ver esta foto na galeria completa"
      >
        <div class="home-photo-image">
          <img
            src="${escapeHtml(source)}"
            alt="${escapeHtml(caption)}"
            loading="${index === 0 ? "eager" : "lazy"}"
            decoding="async"
          >
        </div>

        <div class="home-photo-caption">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(caption)}</strong>
        </div>
      </a>
    </article>
  `;
}

function renderEmptyGallery() {
  if (!galleryGrid) {
    return;
  }

  galleryGrid.innerHTML = `
    <article class="home-photo-card home-photo-featured reveal">
      <div class="home-photo-placeholder">
        <span aria-hidden="true">♥</span>
      </div>

      <div class="home-photo-caption">
        <span>Nossa espera</span>
        <strong>Em breve, nossas lembranças aparecerão aqui.</strong>
      </div>
    </article>

    <article class="home-photo-card reveal">
      <div class="home-photo-placeholder">
        <span aria-hidden="true">✿</span>
      </div>

      <div class="home-photo-caption">
        <span>Preparativos</span>
        <strong>Um cantinho sendo construído com amor.</strong>
      </div>
    </article>

    <article class="home-photo-card reveal">
      <div class="home-photo-placeholder">
        <span aria-hidden="true">☀</span>
      </div>

      <div class="home-photo-caption">
        <span>Família e amigos</span>
        <strong>Momentos que um dia serão contados para a Iúna.</strong>
      </div>
    </article>
  `;
}

async function loadHomeGallery() {
  if (!galleryGrid) {
    return;
  }

  galleryGrid.setAttribute("aria-busy", "true");

  try {
    let snapshot;

    try {
      const galleryQuery = query(
        collection(db, "photos"),
        where("status", "==", "published"),
        orderBy("createdAt", "desc"),
        limit(6)
      );

      snapshot = await getDocs(galleryQuery);
    } catch (indexError) {
      console.warn(
        "[GALERIA] Consulta ordenada indisponível; usando consulta sem ordenação.",
        indexError
      );

      const fallbackQuery = query(
        collection(db, "photos"),
        where("status", "==", "published"),
        limit(6)
      );

      snapshot = await getDocs(fallbackQuery);
    }

    const photos = snapshot.docs
      .map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      }))
      .filter((photo) => Boolean(getPhotoSource(photo)));

    if (!photos.length) {
      renderEmptyGallery();
      galleryGrid.setAttribute("aria-busy", "false");
      return;
    }

    galleryGrid.innerHTML = photos.map(renderPhoto).join("");
    galleryGrid.setAttribute("aria-busy", "false");
  } catch (error) {
    console.error("[GALERIA] Erro ao carregar fotos publicadas:", error);
    renderEmptyGallery();
    galleryGrid.setAttribute("aria-busy", "false");
  }
}

loadHomeGallery();
