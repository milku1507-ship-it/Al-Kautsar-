
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fetchArticles() {
  const querySnapshot = await getDocs(collection(db, 'articles'));
  querySnapshot.forEach((doc) => {
    console.log(`--- Article: ${doc.data().title} ---`);
    console.log(doc.data().content);
    console.log('--- End Article ---\n');
  });
}

fetchArticles().catch(console.error);
