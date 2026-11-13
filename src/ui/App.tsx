import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { replay, type TitleEvent } from '../logic/replay';
import type { AuthApi, Snapshot, Store } from '../data/store';
import { emptyGamesSnapshot, type GameStore, type GamesSnapshot } from '../data/games';
import type { Backend } from '../data';
import { TABS } from '../games/registry';
import type { AppData } from '../games/types';
import { YahtzeeImport } from '../games/yahtzee/Import';
import { decodePayload, type LegacyEntry } from '../games/yahtzee/legacy';
import { Login } from './Login';
import { Celebration } from './Celebration';

/** Celebrate titles completed this recently, so the other phone joins in but old titles never replay. */
const CELEBRATE_WINDOW_MS = 10 * 60 * 1000;

export interface Actions {
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
}

export function App({ store, games, auth }: Backend) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => auth.onChange(setSignedIn), [auth]);

  if (signedIn === null) return <div className="splash">🃏</div>;
  if (!signedIn) return <Login auth={auth} />;
  return <Main store={store} games={games} auth={auth} />;
}

const saved = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
};

function Main({ store, games: gameStore, auth }: { store: Store; games: GameStore; auth: AuthApi }) {
  const [snap, setSnap] = useState<Snapshot>({ matches: [], live: null, target: 3, ready: false });
  const [games, setGames] = useState<GamesSnapshot>(emptyGamesSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [tabId, setTabId] = useState(() => saved('tab', TABS[0].id));
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];
  const [views, setViews] = useState<Record<string, string>>({});
  const view = views[tab.id] ?? tab.views[0].id;
  const [celebrate, setCelebrate] = useState<TitleEvent | null>(null);
  const [legacy, setLegacy] = useState<LegacyEntry[] | null>(() => decodePayload(location.hash));

  useEffect(() => {
    const onHash = () => {
      const entries = decodePayload(location.hash);
      if (entries) setLegacy(entries);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => store.subscribe(setSnap, (e) => setError(e.message)), [store]);
  useEffect(() => gameStore.subscribe(setGames, (e) => setError(e.message)), [gameStore]);

  const cocState = useMemo(() => replay(snap.matches), [snap.matches]);

  // Fire the celebration for any title that wasn't there before and is fresh.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!snap.ready) return;
    const ids = new Set(cocState.titles.map((t) => t.matchId));
    if (seen.current) {
      const fresh = cocState.titles.filter((t) => !seen.current!.has(t.matchId) && Date.now() - t.at < CELEBRATE_WINDOW_MS);
      if (fresh.length) setCelebrate(fresh[fresh.length - 1]);
    }
    seen.current = ids;
  }, [cocState.titles, snap.ready]);

  const actions: Actions = useMemo(
    () => ({
      run: async (fn) => {
        try {
          await fn();
          return true;
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          return false;
        }
      },
    }),
    [],
  );

  const dismissError = useCallback(() => setError(null), []);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(dismissError, 5000);
    return () => clearTimeout(t);
  }, [error, dismissError]);

  const pickTab = (id: string) => {
    setTabId(id);
    remember('tab', id);
    window.scrollTo(0, 0);
  };
  const pickView = (id: string) => {
    setViews((v) => ({ ...v, [tab.id]: id }));
    window.scrollTo(0, 0);
  };

  const closeImport = () => {
    setLegacy(null);
    history.replaceState(null, '', location.pathname);
  };

  const data: AppData = { coc: snap, cocState, cocStore: store, games, gameStore, auth, actions };
  const ready = snap.ready && games.ready;

  return (
    <div className="app">
      <nav className="gamebar" aria-label="Games">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab.id ? 'active' : ''} onClick={() => pickTab(t.id)}>
            <span aria-hidden>{t.icon}</span> {t.short}
            {liveBadge(t.id, data) && <span className="live-dot" title="Game in progress" />}
          </button>
        ))}
      </nav>

      <main className="content">
        {!ready ? (
          <div className="loading">Loading…</div>
        ) : legacy ? (
          <YahtzeeImport entries={legacy} data={data} onDone={closeImport} />
        ) : (
          tab.render(view, data)
        )}
      </main>

      {error && (
        <div className="toast" role="alert" onClick={dismissError}>
          {error}
        </div>
      )}

      <nav className="tabs" style={{ gridTemplateColumns: `repeat(${tab.views.length}, 1fr)` }}>
        {tab.views.map((v) => (
          <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => pickView(v.id)}>
            <span className="tab-icon" aria-hidden>
              {v.icon}
            </span>
            {v.label}
          </button>
        ))}
      </nav>

      {celebrate && <Celebration event={celebrate} onClose={() => setCelebrate(null)} />}
    </div>
  );
}

/** A dot on a game's tab while it has a game in progress. */
function liveBadge(id: string, d: AppData): boolean {
  if (id === 'coc') return !!d.coc.live;
  return !!(d.games.live as Record<string, unknown>)[id];
}
