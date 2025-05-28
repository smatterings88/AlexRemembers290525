import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('Initializing Firebase with config:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasProjectId: !!firebaseConfig.projectId,
  hasAuthDomain: !!firebaseConfig.authDomain
});

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db)
    .catch((err) => {
      // Handle expected scenarios with warnings
      if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        return; // Exit early to avoid logging as error
      } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support persistence.');
        return; // Exit early to avoid logging as error
      }
      // Only log unexpected errors as console.error
      console.error('Unexpected Firebase persistence error:', err);
    });
}