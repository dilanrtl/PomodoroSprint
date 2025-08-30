// src/services/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD9p7rJsg7JoPLdm_xa3xc_82XGWmXbnH4",
  authDomain: "pomodoro-sprint-75e7b.firebaseapp.com",
  projectId: "pomodoro-sprint-75e7b",
  storageBucket: "pomodoro-sprint-75e7b.appspot.com",
  messagingSenderId: "940255024340",
  appId: "1:940255024340:web:b57bec608da7d8a936d741",
  measurementId: "G-BPN5P0GMGF"
};

// Tek instance kuralım (hot reload güvenli)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// RN'de kalıcı oturum için persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);