import { addHand, newMatch, reopen, switchDealer, undoHand } from '../logic/match';
import type { CompletedMatch, LiveMatch } from '../logic/types';
import { DEFAULT_TARGET, StaleError, type AuthApi, type Snapshot, type Store } from './store';

/**
 * In-browser store for `npm run demo`: no Firebase needed, data kept in localStorage.
 * Useful for trying the app and for UI testing. Never used in a production build.
 */
const KEY = 'scorecard-demo';

function load(): Omit<Snapshot, 'ready'> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { matches: [], live: null, target: DEFAULT_TARGET };
}

let state = load();
const listeners = new Set<(s: Snapshot) => void>();
let nextId = Date.now();

function commit(next: Omit<Snapshot, 'ready'>) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l({ ...state, ready: true }));
}

const liveOrStale = (seen?: number): LiveMatch => {
  if (!state.live || (seen !== undefined && state.live.hands.length !== seen)) throw new StaleError();
  return state.live;
};

export const memoryStore: Store = {
  subscribe(cb) {
    listeners.add(cb);
    cb({ ...state, ready: true });
    return () => listeners.delete(cb);
  },
  async startMatch(game, dealer) {
    if (state.live) throw new Error('A match is already in progress.');
    commit({ ...state, live: newMatch(game, state.target, dealer, Date.now()) });
  },
  async recordHand(winner, seen) {
    const r = addHand(liveOrStale(seen), winner, Date.now());
    if (r.completed) {
      const id = `demo${nextId++}`;
      commit({ ...state, live: null, matches: [...state.matches, { ...r.completed, id }] });
      return id;
    }
    commit({ ...state, live: r.live });
    return null;
  },
  async undoHand(seen) {
    commit({ ...state, live: undoHand(liveOrStale(seen)) });
  },
  async switchDealer() {
    commit({ ...state, live: switchDealer(liveOrStale()) });
  },
  async abandon() {
    commit({ ...state, live: null });
  },
  async reopenMatch(id) {
    if (state.live) throw new Error('Another match has already started.');
    const m = state.matches.find((x) => x.id === id);
    if (!m) throw new Error('That match no longer exists.');
    commit({ ...state, live: reopen(m), matches: state.matches.filter((x) => x.id !== id) });
  },
  async deleteMatch(id) {
    commit({ ...state, matches: state.matches.filter((x) => x.id !== id) });
  },
  async setTarget(n) {
    commit({ ...state, target: n });
  },
};

/** Test helper: replace all demo data. */
export function seedDemo(matches: CompletedMatch[]) {
  commit({ ...state, matches });
}

export const memoryAuth: AuthApi = {
  onChange(cb) {
    cb(sessionStorage.getItem('demo-auth') === '1');
    return () => {};
  },
  async signIn(passcode) {
    if (passcode !== 'demo123') throw new Error('Wrong passcode (demo passcode is demo123)');
    sessionStorage.setItem('demo-auth', '1');
    location.reload();
  },
  async signOut() {
    sessionStorage.removeItem('demo-auth');
    location.reload();
  },
};
