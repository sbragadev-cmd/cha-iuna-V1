import { db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

/**
 * Retorna o ID do convite informado no link:
 * confirmar-presenca.html?convite=DOCUMENT_ID
 */
export function getInvitationIdFromUrl() {
  const params = new URLSearchParams(
    window.location.search
  );

  return String(
    params.get("convite") || ""
  ).trim();
}

/**
 * Carrega o cadastro do convidado para preencher o formulário público.
 */
export async function loadInvitationGuest() {
  const invitationId =
    getInvitationIdFromUrl();

  if (!invitationId) {
    return null;
  }

  const reference = doc(
    db,
    "invitationGuests",
    invitationId
  );

  const snapshot =
    await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

/**
 * Chame esta função APÓS salvar a confirmação na coleção rsvps.
 *
 * attendanceStatus:
 * - "confirmed"
 * - "declined"
 */
export async function syncInvitationConfirmation({
  invitationId = getInvitationIdFromUrl(),
  rsvpId = "",
  attendanceStatus = "confirmed",
  adults = 0,
  children = 0,
  totalGuests = 0,
  guestName = "",
  phone = ""
} = {}) {
  if (!invitationId) {
    return {
      updated: false,
      reason: "NO_INVITATION_ID"
    };
  }

  const status =
    attendanceStatus === "declined"
      ? "declined"
      : "confirmed";

  const payload = {
    confirmationStatus: status,
    rsvpId: String(rsvpId || ""),
    adults: Math.max(
      0,
      Number(adults || 0)
    ),
    children: Math.max(
      0,
      Number(children || 0)
    ),
    peopleCount: Math.max(
      0,
      Number(
        totalGuests ||
        Number(adults || 0) +
        Number(children || 0)
      )
    ),
    updatedAt: serverTimestamp()
  };

  if (guestName) {
    payload.name = String(
      guestName
    ).trim();
  }

  if (phone) {
    payload.confirmedPhone =
      String(phone).trim();
  }

  if (status === "confirmed") {
    payload.confirmedAt =
      serverTimestamp();
  } else {
    payload.declinedAt =
      serverTimestamp();
  }

  await updateDoc(
    doc(
      db,
      "invitationGuests",
      invitationId
    ),
    payload
  );

  return {
    updated: true,
    status
  };
}
