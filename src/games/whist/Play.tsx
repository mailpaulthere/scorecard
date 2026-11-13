import { useState } from 'react';
import { PLAYERS, PLAYER_NAME, other, type Player } from '../../logic/types';
import { formatDate } from '../../logic/time';
import { Confirm } from '../../ui/Confirm';
import type { AppData } from '../types';
import { addHand, handWinner, newMatch, reopen, score, switchDealer, tricksPerHand, undoHand, type WhistLive } from './logic';
import { useWhist, type WhistResult } from './useWhist';

type W = ReturnType<typeof useWhist>;

export function WhistPlay({ d }: { d: AppData }) {
  const w = useWhist(d);
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const finished = finishedId ? w.results.find((r) => r.id === finishedId) : undefined;

  if (w.match) return <MatchView d={d} w={w} match={w.match} onFinished={setFinishedId} />;
  if (finished) return <ResultView d={d} result={finished} onDone={() => setFinishedId(null)} />;
  return <StartView d={d} w={w} />;
}

function StartView({ d, w }: { d: AppData; w: W }) {
  const [dealer, setDealer] = useState<Player | null>(w.suggestedDealer);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!dealer || busy) return;
    setBusy(true);
    await d.actions.run(() => d.gameStore.mutate<WhistLive, never>('whist', 'none', () => ({ state: newMatch(w.settings, dealer, Date.now()) })));
    setBusy(false);
  };

  return (
    <section className="card">
      <h2>New German Whist match</h2>
      <p className="muted">
        First to {w.settings.target} hand{w.settings.target === 1 ? '' : 's'} wins.{' '}
        {w.settings.countAll ? 'Counting all 26 tricks.' : 'Only the 13 tricks after the stock runs out count.'}
      </p>
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
      <button className="btn primary big full" disabled={!dealer || busy} onClick={start}>
        Start match
      </button>
    </section>
  );
}

function ResultView({ d, result, onDone }: { d: AppData; result: WhistResult; onDone: () => void }) {
  const m = result.detail.match;
  return (
    <section className="card result">
      <div className="result-emoji">🎉</div>
      <h2>{PLAYER_NAME[m.winner]} wins German Whist</h2>
      <div className="result-score">
        {result.scores.paul}–{result.scores.bex}
      </div>
      <p className="muted">Match saved.</p>
      <div className="row">
        <button className="btn" onClick={() => d.actions.run(() => d.gameStore.reopen('whist', result.id, reopen(m))).then((ok) => ok && onDone())}>
          ↩ Undo last hand
        </button>
        <button className="btn primary" onClick={onDone}>
          Next match
        </button>
      </div>
    </section>
  );
}

function MatchView({ d, w, match, onFinished }: { d: AppData; w: W; match: WhistLive; onFinished: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState<Player | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const s = score(match.hands);
  const total = tricksPerHand(match.countAll);
  const leader = other(match.nextDealer);

  const go = async (fn: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    let id: string | null = null;
    await d.actions.run(async () => {
      id = await fn();
    });
    setBusy(false);
    if (id) onFinished(id);
  };

  const record = (player: Player, tricks: number) => {
    setEntry(null);
    go(() => w.hand((m) => addHand(m, player, tricks, Date.now())));
  };

  return (
    <section className="card match">
      <div className="match-head">
        <h2>German Whist</h2>
        <span className="muted">
          First to {match.target}
          {formatDate(match.startedAt) !== formatDate(Date.now()) && ` · started ${formatDate(match.startedAt)}`}
        </span>
      </div>

      <div className="scoreboard">
        {PLAYERS.map((p, i) => (
          <div key={p} className="score-side">
            <div className="score-name">
              {PLAYER_NAME[p]}
              {match.nextDealer === p && <span className="dealer-chip">deals</span>}
            </div>
            <div className="score-num">{s[p]}</div>
            {i === 0 && <span className="score-dash">–</span>}
          </div>
        ))}
      </div>
      <p className="muted small center">
        {PLAYER_NAME[leader]} leads the first trick. Turn up the top card of the stock for trumps.
      </p>

      <div className="hand-dots" aria-label="Hands so far">
        {match.hands.map((h, i) => {
          const win = handWinner(h);
          return (
            <span key={i} className={`dot ${win ?? 'draw'}`} title={`${h.tricks.paul}–${h.tricks.bex}`}>
              {win ? PLAYER_NAME[win][0] : '='}
            </span>
          );
        })}
      </div>

      {entry ? (
        <div className="trick-entry">
          <p>
            How many {match.countAll ? '' : 'stage-2 '}tricks did <strong>{PLAYER_NAME[entry]}</strong> take? (out of {total})
          </p>
          <div className="trick-grid">
            {Array.from({ length: total + 1 }, (_, n) => n)
              .filter((n) => (match.countAll ? true : n >= 7))
              .map((n) => (
                <button key={n} className={`btn trick ${entry}`} disabled={busy} onClick={() => record(entry, n)}>
                  {n}
                  <span className="small">{total - n}</span>
                </button>
              ))}
          </div>
          <p className="muted small">
            Small number: {PLAYER_NAME[other(entry)]}'s tricks.
            {match.countAll && ' 13 each is a drawn hand.'}
          </p>
          <button className="btn link" onClick={() => setEntry(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="win-buttons">
          {PLAYERS.map((p) => (
            <button key={p} className={`btn win ${p}`} disabled={busy} onClick={() => setEntry(p)}>
              {match.countAll ? `Enter ${PLAYER_NAME[p]}'s tricks` : `${PLAYER_NAME[p]} won hand`}
            </button>
          ))}
        </div>
      )}

      <div className="row match-tools">
        <button className="btn" disabled={busy || match.hands.length === 0} onClick={() => go(() => w.change(undoHand))}>
          ↩ Undo last hand
        </button>
        <button className="btn" disabled={busy} onClick={() => go(() => w.change(switchDealer))}>
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
            go(() => d.gameStore.mutate('whist', w.rev, () => ({ state: null })));
          }}
        >
          <p>
            The {s.paul}–{s.bex} score will be deleted and won't count on any leaderboard.
          </p>
        </Confirm>
      )}
    </section>
  );
}
