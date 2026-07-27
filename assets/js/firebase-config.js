/**
 * ============================================================
 * Chá da Iúna
 * Firebase Configuration
 * ============================================================
 */

import { initializeApp, getApps } from "firebase/app";

import {
  getAuth
} from "firebase/auth";

import {
  getFirestore
} from "firebase/firestore";

import {
  getStorage
} from "firebase/storage";

/**
 * Firebase Project Configuration
 */

const firebaseConfig = {
  apiKey: "AIzaSyAALE9_lpduA61JhKrcqHTHrVTBBzPeMcw",
  authDomain: "cha-da-iuna.firebaseapp.com",
  projectId: "cha-da-iuna",
  storageBucket: "cha-da-iuna.firebasestorage.app",
  messagingSenderId: "399015772336",
  appId: "1:399015772336:web:e9e9dd0dfa07d4910ebb75"
};

/**
 * Evita múltiplas inicializações
 */

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

/**
 * Serviços Firebase
 */

const auth = getAuth(app);

const db = getFirestore(app);

const storage = getStorage(app);

/**
 * Ambiente
 */

const ENV = {
  project: firebaseConfig.projectId,
  production: location.hostname !== "localhost"
};

console.info("🧸 Chá da Iúna");

console.info("Firebase inicializado");

console.table({
  Projeto: ENV.project,
  Ambiente: ENV.production ? "Produção" : "Desenvolvimento"
});

/**
 * Exportações
 */

export {
  app,
  auth,
  db,
  storage,
  firebaseConfig,
  ENV
};