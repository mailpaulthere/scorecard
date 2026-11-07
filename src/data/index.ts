import type { AuthApi, Store } from './store';

/** Picks the backend: Firebase normally, an in-browser store for `npm run demo`. */
export async function loadBackend(): Promise<{ store: Store; auth: AuthApi }> {
  if (import.meta.env.MODE === 'demo') {
    const m = await import('./memory');
    return { store: m.memoryStore, auth: m.memoryAuth };
  }
  const f = await import('./firebase');
  return { store: f.firebaseStore, auth: f.firebaseAuth };
}
