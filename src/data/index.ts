import type { GameStore } from './games';
import type { AuthApi, Store } from './store';

export interface Backend {
  store: Store;
  games: GameStore;
  auth: AuthApi;
}

/** Picks the backend: Firebase normally, an in-browser store for `npm run demo`. */
export async function loadBackend(): Promise<Backend> {
  if (import.meta.env.MODE === 'demo') {
    const m = await import('./memory');
    return { store: m.memoryStore, games: m.memoryGames, auth: m.memoryAuth };
  }
  const f = await import('./firebase');
  return { store: f.firebaseStore, games: f.firebaseGames, auth: f.firebaseAuth };
}
