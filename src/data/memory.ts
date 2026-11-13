import { addHand, newMatch, reopen, switchDealer, undoHand } from '../logic/match';
import type { CompletedMatch, LiveMatch } from '../logic/types';
import { DEFAULT_TARGET, StaleError, type AuthApi, type Snapshot, type Store } from './store';
import { emptyGamesSnapshot, type GameStore, type GamesSnapshot, type LiveDoc, type ResultDoc } from './games';

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

// ---- Other games ----

const GKEY = 'scorecard-demo-games';
function loadGames(): GamesSnapshot {
  try {
    const raw = localStorage.getItem(GKEY);
    if (raw) return { ...emptyGamesSnapshot(), ...JSON.parse(raw), ready: true };
  } catch {
    /* ignore */
  }
  return { ...emptyGamesSnapshot(), ready: true };
}
let games = loadGames();
const gameListeners = new Set<(s: GamesSnapshot) => void>();

function commitGames(next: GamesSnapshot) {
  games = next;
  try {
    localStorage.setItem(GKEY, JSON.stringify(games));
  } catch {
    /* ignore */
  }
  gameListeners.forEach((l) => l(structuredClone(games)));
}

// Other tabs of the demo stand in for "the other phone".
window.addEventListener('storage', (e) => {
  if (e.key === GKEY) {
    games = loadGames();
    gameListeners.forEach((l) => l(structuredClone(games)));
  }
});

export const memoryGames: GameStore = {
  subscribe(cb) {
    gameListeners.add(cb);
    cb(structuredClone(games));
    return () => gameListeners.delete(cb);
  },
  async mutate(game, expect, fn) {
    const cur = games.live[game];
    if (expect === 'none' ? cur !== null : cur === null || cur.rev !== expect) {
      throw expect === 'none' ? new Error('A game is already in progress.') : new StaleError();
    }
    const m = fn(structuredClone((cur?.state ?? null) as never));
    const live: LiveDoc | null = m.state === null ? null : { rev: (cur?.rev ?? 0) + 1, state: m.state, turn: null };
    let id: string | null = null;
    let results = games.results;
    if (m.result) {
      id = `demo${nextId++}`;
      results = [...results, { ...(m.result as Omit<ResultDoc, 'id'>), id }];
    }
    commitGames({ ...games, live: { ...games.live, [game]: live }, results });
    return id;
  },
  async setTurn(game, turn) {
    const cur = games.live[game];
    if (!cur) return;
    commitGames({ ...games, live: { ...games.live, [game]: { ...cur, turn } } });
  },
  async reopen(game, resultId, state) {
    if (games.live[game]) throw new Error('Another game has already started.');
    if (!games.results.some((r) => r.id === resultId)) throw new Error('That game no longer exists.');
    commitGames({
      ...games,
      live: { ...games.live, [game]: { rev: Date.now(), state, turn: null } },
      results: games.results.filter((r) => r.id !== resultId),
    });
  },
  async deleteResult(id) {
    commitGames({ ...games, results: games.results.filter((r) => r.id !== id) });
  },
  async setSettings(game, data) {
    commitGames({ ...games, settings: { ...games.settings, [game]: { ...games.settings[game], ...data } } });
  },
  async importResults(list) {
    const ids = new Set(list.map((r) => r.id));
    commitGames({ ...games, results: [...games.results.filter((r) => !ids.has(r.id)), ...list] });
  },
};

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
