import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import type { Item, Recipe } from '../utils/data';
import { STORES, BDEMO } from '../utils/data';

interface AppData {
  list: Item[];
  base: Item[];
  stock: Item[];
  messages: any[];
  stores: { name: string }[];
  ords: Record<number, string[]>;
  recipes: Recipe[];
}

const DEFAULT_DATA: AppData = {
  list: [],
  base: BDEMO,
  stock: [],
  messages: [],
  stores: STORES.map(s => ({ name: s.name })),
  ords: {
    0: [...STORES[0].ord],
    1: [...STORES[1].ord],
    2: [...STORES[2].ord]
  },
  recipes: []
};

export function useFirestoreData(uid: string | null) {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setData(null);
      return;
    }

    const userRef = doc(db, 'users', uid);
    
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setData(docSnap.data() as AppData);
      } else {
        // Initialize with default or localstorage migrated data
        setDoc(userRef, DEFAULT_DATA).catch(e => setError('Ошибка создания профиля: ' + e.message));
        setData(DEFAULT_DATA);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setError('Ошибка доступа к Firebase: ' + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const updateField = <K extends keyof AppData>(key: K, value: AppData[K] | ((prev: AppData[K]) => AppData[K])) => {
    if (!uid || !data) return;
    
    const newValue = typeof value === 'function' ? (value as any)(data[key]) : value;
    
    // Optimistic local update
    setData(prev => prev ? { ...prev, [key]: newValue } : prev);
    
    // Sync to Firestore
    setDoc(doc(db, 'users', uid), { [key]: newValue }, { merge: true });
  };

  return { data, updateField, loading, error };
}
