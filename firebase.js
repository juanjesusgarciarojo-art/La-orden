// Firebase CDN imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDC93yT8bBGZvzz6TTjngY7rTX-vgT-rTw",
  authDomain: "el-reto-de-tu-vida.firebaseapp.com",
  projectId: "el-reto-de-tu-vida",
  storageBucket: "el-reto-de-tu-vida.firebasestorage.app",
  messagingSenderId: "436879361667",
  appId: "1:436879361667:web:94dffea44b14787d057db6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
