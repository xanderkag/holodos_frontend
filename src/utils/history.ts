import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { uid, now } from './data';

export type EventType = 
  | 'item_added' 
  | 'item_checked' 
  | 'item_deleted' 
  | 'item_restored'
  | 'baseline_added'
  | 'stock_added'
  | 'ai_vision'
  | 'recipe_opened'
  | 'list_cleared';

export async function logSystemEvent(uid_str: string, content: string, type: EventType, metadata?: any) {
  if (!uid_str) return;

  const eventMsg = {
    id: uid(),
    role: 'system',
    content,
    type: 'text', // fallback for components expecting this
    eventType: type,
    time: now(),
    timestamp: new Date().toISOString(),
    ...metadata
  };

  const userRef = doc(db, 'users', uid_str);
  try {
    await updateDoc(userRef, {
      messages: arrayUnion(eventMsg)
    });
  } catch (err) {
    console.error("Error logging system event:", err);
  }
}
