import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'windy-flames-t5xj8',
  appId: '1:1090034804909:web:9fe5c8d6aff2cdfd0d7e24',
  apiKey: 'AIzaSyB50i566-pwxuAc2dOlg7EYTw8Xp_BvlA8',
  authDomain: 'windy-flames-t5xj8.firebaseapp.com',
  storageBucket: 'windy-flames-t5xj8.firebasestorage.app',
  messagingSenderId: '1090034804909',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, 'ai-studio-95fa8d1e-2a90-437d-a23e-7585f00d8428');
