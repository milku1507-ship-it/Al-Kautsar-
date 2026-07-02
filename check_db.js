import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  console.log("Checking articles...");
  try {
    const snap = await getDocs(collection(db, 'articles'));
    console.log("Docs count:", snap.size);
    snap.forEach((doc) => {
        console.log("---");
        console.log("ID:", doc.id);
        console.log("Data:", JSON.stringify(doc.data(), null, 2));
    });
  } catch (e) {
    console.error("Error:", e);
  } finally {
    process.exit(0);
  }
}

check();
