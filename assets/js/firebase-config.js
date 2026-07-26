import {
  getApps,
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwn2pB-P8Vb-Z-qPGrpu7p01NTmxpa7Xs",
  authDomain: "iuna-e113d.firebaseapp.com",
  projectId: "iuna-e113d",
  storageBucket: "iuna-e113d.firebasestorage.app",
  messagingSenderId: "611255762922",
  appId: "1:611255762922:web:be70b6fd48bff0c4db3c93"
};

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log("[FIREBASE] Inicializado:", {
  projectId: app.options.projectId,
  authDomain: app.options.authDomain
});

export {
  app,
  auth,
  db,
  storage
};