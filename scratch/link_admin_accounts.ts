/**
 * Migration Script: Admin Account Unification
 * Run this to link xanderkage and a.u.lyapustin@yandex.ru to the primary liapustin@gmail.com account metadata.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDgvHci7w8Nr36i4H2Nk1h9u0m1mJ36GCs",
  projectId: "holodos-6ff24",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADMIN_EMAILS = ['liapustin@gmail.com', 'a.u.lyapustin@yandex.ru'];
const ADMIN_HANDLES = ['xanderkage'];

async function unifyAdmins() {
  console.log('--- Starting Admin Unification ---');
  
  const usersRef = collection(db, 'users');
  
  for (const email of ADMIN_EMAILS) {
    const q = query(usersRef, where('email', '==', email));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      console.log(`Setting is_primary_admin: true for ${email} (UID: ${d.id})`);
      await setDoc(doc(db, 'users', d.id), { is_primary_admin: true, isAdmin: true }, { merge: true });
    }
  }

  for (const handle of ADMIN_HANDLES) {
    const q = query(usersRef, where('telegramHandle', '==', handle));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      console.log(`Setting is_primary_admin: true for @${handle} (UID: ${d.id})`);
      await setDoc(doc(db, 'users', d.id), { is_primary_admin: true, isAdmin: true }, { merge: true });
    }
  }
  
  console.log('--- Done ---');
}

unifyAdmins().catch(console.error);
