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

const firebaseConfig = {
  apiKey: "AIzaSyAALE9_lpduA61JhKrcqHTHrVTBBzPeMcw",
  authDomain: "cha-da-iuna.firebaseapp.com",
  projectId: "cha-da-iuna",
  storageBucket: "cha-da-iuna.firebasestorage.app",
  messagingSenderId: "399015772336",
  appId: "1:399015772336:web:e9e9dd0dfa07d4910ebb75"
};

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

console.log("[FIREBASE] Inicializado:", {
  projectId: app.options.projectId,
  authDomain: app.options.authDomain
});

export {
  app,
  auth,
  db
};
