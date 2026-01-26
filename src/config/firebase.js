import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Reemplaza estos valores con los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Verificar si Firebase está configurado
const isFirebaseConfigured = Object.values(firebaseConfig).every(val => val !== '');

let app;
let auth;
let db;

if (isFirebaseConfigured) {
  // Inicializar Firebase solo si está configurado
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log('✅ Firebase inicializado correctamente');
} else {
  console.warn('⚠️ Firebase no está configurado. Por favor, añade las variables de entorno en .env.local');
}

export { auth, db };
export default app;
