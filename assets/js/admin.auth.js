import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase-config.js";

const logoutButton = document.querySelector("#logoutButton");
const adminPage = document.querySelector(".admin-page");

if (adminPage) {
  adminPage.style.visibility = "hidden";
}

async function getAuthorizedAdmin(user) {
  const adminReference = doc(db, "admins", user.uid);
  const adminSnapshot = await getDoc(adminReference);

  if (!adminSnapshot.exists()) {
    return null;
  }

  const admin = adminSnapshot.data();

  const allowedRoles = [
    "owner",
    "admin",
    "editor"
  ];

  if (
    admin.active !== true ||
    !allowedRoles.includes(admin.role)
  ) {
    return null;
  }

  return {
    id: adminSnapshot.id,
    ...admin
  };
}

function updateAdminProfile(user, admin) {
  const profileName = document.querySelector(
    ".profile-copy strong"
  );

  const profileRole = document.querySelector(
    ".profile-copy small"
  );

  const profileInitials = document.querySelector(
    ".profile-button > span:first-child"
  );

  const name =
    admin.name ||
    user.displayName ||
    "Pais da Iúna";

  if (profileName) {
    profileName.textContent = name;
  }

  if (profileRole) {
    const roleNames = {
      owner: "Proprietários",
      admin: "Administradores",
      editor: "Editores"
    };

    profileRole.textContent =
      roleNames[admin.role] ||
      "Administradores";
  }

  if (profileInitials) {
    profileInitials.textContent = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join("");
  }
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("./login.html");
    return;
  }

  try {
    const admin = await getAuthorizedAdmin(user);

    if (!admin) {
      await signOut(auth);
      window.location.replace("./login.html");
      return;
    }

    updateAdminProfile(user, admin);

    if (adminPage) {
      adminPage.style.visibility = "visible";
    }
  } catch (error) {
    console.error(
      "Erro ao validar administrador:",
      error
    );

    await signOut(auth);
    window.location.replace("./login.html");
  }
});

logoutButton?.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await signOut(auth);
    window.location.replace("./login.html");
  } catch (error) {
    console.error("Erro ao sair:", error);
    logoutButton.disabled = false;
  }
});