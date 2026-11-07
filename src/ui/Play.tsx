import { useState } from 'react';
import { dealerForNewMatch, score } from '../logic/match';
import { gameOptions, type ReplayState } from '../logic/replay';
import { formatDate } from '../logic/time';
import { GAME_NAME, PLAYERS, PLAYER_NAME, other, type Game, type LiveMatch, type Player } from '../logic/types';
import type { Snapshot, Store } from '../data/store';
import type { Actions } from './App';
import { Confirm } from './Confirm';

interface Props {
  store: Store;
  snap: Snapshot;
  state: ReplayState;
  actions: Actions;
}

export function Play({ store, snap, state, actions }: Props) {
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const finished = finishedId ? snap.matches.find((m) => m.id === finishedId) : undefined;

  if (snap.live) return <MatchView store={store} live={snap.live} actions={actions} onFinished={setFinishedId} />;

  if (finished) {
    const s = score(finished.hands);
    return (
      <section className="card result">
        <div className="result-emoji">🎉</div>
        <h2>
          {PLAYER_NAME[finished.winner]} wins {GAME_NAME[finished.game]}
        </h2>
        <div className="result-score">
          {s.paul}–{s.bex}
        </div>
        <p className="muted">Match saved.</p>
        <div className="row">
          <button
            className="btn"
            onClick={() => actions.run(() => store.reopenMatch(finished.id)).then((ok) => ok && setFinishedId(null))}
          >
            ↩ Undo last hand
          </button>
          <button className="btn primary" onClick={() => setFinishedId(null)}>
            Next match
          </button>
        </div>
      </section>
    );
  }

  return <StartView store={store} snap={snap} state={state} actions={actions} />;
}

function StartView({ store, snap, state, actions }: Props) {
  const suggested = dealerForNewMatch(snap.matches);
  const [dealer, setDealer] = useState<Player | null>(suggested);
  const [busy, setBusy] = useState(false);
  const options = gameOptions(state);

  const start = async (game: Game) => {
    if (!dealer || busy) return;
    setBusy(true);
    await actions.run(() => store.startMatch(game, dealer));
    setBusy(false);
  };

  return (
    <section className="card">
      <h2>Start a match</h2>
      <p className="muted">First to {snap.target} hands wins.</p>

      <div className="dealer-pick">
        {dealer ? (
          <>
            <span>
              <span aria-hidden>🂠</span> <strong>{PLAYER_NAME[dealer]}</strong> deals first
            </span>
            <button className="btn small" onClick={() => setDealer(other(dealer))}>
              ⇄ Switch
            </button>
          </>
        ) : (
          <>
            <span>Who deals first?</span>
            <div className="row">
              {PLAYERS.map((p) => (
                <button key={p} className="btn small" onClick={() => setDealer(p)}>
                  {PLAYER_NAME[p]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="games">
        {options.map((o) => (
          <button key={o.game} className="btn game" disabled={!o.allowed || !dealer || busy} onClick={() => start(o.game)}>
            <span className="game-name">{GAME_NAME[o.game]}</span>
            {o.reason && <span className="game-reason">{o.reason}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function MatchView({
  store,
  live,
  actions,
  onFinished,
}: {
  store: Store;
  live: LiveMatch;
  actions: Actions;
  onFinished: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const s = score(live.hands);
  const n = live.hands.length;

  const go = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    await actions.run(fn);
    setBusy(false);
  };

  const won = (p: Player) =>
    go(async () => {
      const id = await store.recordHand(p, n);
      if (id) onFinished(id);
    });

  const startedToday = formatDate(live.startedAt) === formatDate(Date.now());

  return (
    <section className="card match">
      <div className="match-head">
        <h2>{GAME_NAME[live.game]}</h2>
        <span className="muted">
          First to {live.target}
          {!startedToday && ` · started ${formatDate(live.startedAt)}`}
        </span>
      </div>

      <div className="scoreboard">
        {PLAYERS.map((p, i) => (
          <div key={p} className="score-side">
            <div className="score-name">
              {PLAYER_NAME[p]}
              {live.nextDealer === p && (
                <span className="dealer-chip" title="Deals this hand">
                  deals
                </span>
              )}
            </div>
            <div className="score-num">{s[p]}</div>
            {i === 0 && <span className="score-dash">–</span>}
          </div>
        ))}
      </div>

      <div className="hand-dots" aria-label="Hands so far">
        {live.hands.map((h, i) => (
          <span key={i} className={`dot ${h.winner}`}>
            {PLAYER_NAME[h.winner][0]}
          </span>
        ))}
      </div>

      <div className="win-buttons">
        {PLAYERS.map((p) => (
          <button key={p} className={`btn win ${p}`} disabled={busy} onClick={() => won(p)}>
            {PLAYER_NAME[p]} won hand
          </button>
        ))}
      </div>

      <div className="row match-tools">
        <button className="btn" disabled={busy || n === 0} onClick={() => go(() => store.undoHand(n))}>
          ↩ Undo last hand
        </button>
        <button className="btn" disabled={busy} onClick={() => go(() => store.switchDealer())}>
          ⇄ Switch dealer
        </button>
      </div>
      <button className="btn link danger-text" onClick={() => setConfirmAbandon(true)}>
        Abandon match
      </button>

      {confirmAbandon && (
        <Confirm
          title="Abandon this match?"
          confirmLabel="Abandon"
          danger
          onCancel={() => setConfirmAbandon(false)}
          onConfirm={() => {
            setConfirmAbandon(false);
            go(() => store.abandon());
          }}
        >
          <p>
            The {s.paul}–{s.bex} score will be deleted and won't count towards stats or runs.
          </p>
        </Confirm>
      )}
    </section>
  );
}
