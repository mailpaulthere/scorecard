import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { replay, type TitleEvent } from '../logic/replay';
import type { AuthApi, Snapshot, Store } from '../data/store';
import { Login } from './Login';
import { Play } from './Play';
import { Leaderboard } from './Leaderboard';
import { History } from './History';
import { Settings } from './Settings';
import { Celebration } from './Celebration';
import { StatusCard } from './StatusCard';

type Tab = 'play' | 'board' | 'history' | 'settings';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'play', label: 'Play', icon: '🃏' },
  { id: 'board', label: 'Leaderboard', icon: '🏆' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

/** Celebrate titles completed this recently, so the other phone joins in but old titles never replay. */
const CELEBRATE_WINDOW_MS = 10 * 60 * 1000;

export interface Actions {
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
}

export function App({ store, auth }: { store: Store; auth: AuthApi }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => auth.onChange(setSignedIn), [auth]);

  if (signedIn === null) return <div className="splash">🃏</div>;
  if (!signedIn) return <Login auth={auth} />;
  return <Main store={store} auth={auth} />;
}

function Main({ store, auth }: { store: Store; auth: AuthApi }) {
  const [snap, setSnap] = useState<Snapshot>({ matches: [], live: null, target: 3, ready: false });
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('play');
  const [celebrate, setCelebrate] = useState<TitleEvent | null>(null);

  useEffect(() => store.subscribe(setSnap, (e) => setError(e.message)), [store]);

  const state = useMemo(() => replay(snap.matches), [snap.matches]);

  // Fire the celebration for any title that wasn't there before and is fresh.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!snap.ready) return;
    const ids = new Set(state.titles.map((t) => t.matchId));
    if (seen.current) {
      const fresh = state.titles.filter((t) => !seen.current!.has(t.matchId) && Date.now() - t.at < CELEBRATE_WINDOW_MS);
      if (fresh.length) setCelebrate(fresh[fresh.length - 1]);
    }
    seen.current = ids;
  }, [state.titles, snap.ready]);

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

  return (
    <div className="app">
      <main className="content">
        {!snap.ready ? (
          <div className="loading">Loading…</div>
        ) : tab === 'play' ? (
          <>
            <StatusCard state={state} />
            <Play store={store} snap={snap} state={state} actions={actions} />
          </>
        ) : tab === 'board' ? (
          <Leaderboard matches={snap.matches} state={state} />
        ) : tab === 'history' ? (
          <History store={store} matches={snap.matches} state={state} actions={actions} />
        ) : (
          <Settings store={store} auth={auth} snap={snap} actions={actions} />
        )}
      </main>

      {error && (
        <div className="toast" role="alert" onClick={dismissError}>
          {error}
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>

      {celebrate && <Celebration event={celebrate} onClose={() => setCelebrate(null)} />}
    </div>
  );
}
