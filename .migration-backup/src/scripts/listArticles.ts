
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listArticles() {
  const querySnapshot = await getDocs(collection(db, 'articles'));
  querySnapshot.forEach((doc) => {
    console.log(`ID: ${doc.id} | Title: ${doc.data().title}`);
  });
}

listArticles().catch(console.error);
