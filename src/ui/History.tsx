import { useMemo, useState } from 'react';
import { score } from '../logic/match';
import { sortMatches, type ReplayState } from '../logic/replay';
import { formatDateTime } from '../logic/time';
import { GAME_NAME, PLAYER_NAME, type CompletedMatch } from '../logic/types';
import type { Store } from '../data/store';
import type { Actions } from './App';
import { Confirm } from './Confirm';

export function History({
  store,
  matches,
  state,
  actions,
}: {
  store: Store;
  matches: CompletedMatch[];
  state: ReplayState;
  actions: Actions;
}) {
  const sorted = useMemo(() => sortMatches(matches).reverse(), [matches]);
  const titleMatches = useMemo(() => new Map(state.titles.map((t) => [t.matchId, t])), [state.titles]);
  const [toDelete, setToDelete] = useState<CompletedMatch | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  if (!sorted.length) return <section className="card muted">No matches yet. Go play!</section>;

  return (
    <section className="card">
      <h2>All matches ({sorted.length})</h2>
      <ul className="list">
        {sorted.map((m) => {
          const s = score(m.hands);
          const title = titleMatches.get(m.id);
          return (
            <li key={m.id} className="list-row column">
              <button className="row-main" onClick={() => setOpen(open === m.id ? null : m.id)}>
                <div>
                  <strong>{GAME_NAME[m.game]}</strong> · {PLAYER_NAME[m.winner]} won {Math.max(s.paul, s.bex)}–{Math.min(s.paul, s.bex)}
                  {title && <span className="tag first"> 👑 title</span>}
                  <div className="muted small">{formatDateTime(m.endedAt)}</div>
                </div>
                <span className="muted">{open === m.id ? '▲' : '▼'}</span>
              </button>
              {open === m.id && (
                <div className="row-detail">
                  <ol className="hands">
                    {m.hands.map((h, i) => (
                      <li key={i}>
                        Hand {i + 1}: {PLAYER_NAME[h.winner]} won <span className="muted">({PLAYER_NAME[h.dealer]} dealt)</span>
                      </li>
                    ))}
                  </ol>
                  <p className="muted small">First to {m.target}. Paul {s.paul}, Bex {s.bex}.</p>
                  <button className="btn small danger" onClick={() => setToDelete(m)}>
                    Delete match
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {toDelete && (
        <Confirm
          title="Delete this match?"
          confirmLabel="Delete"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const id = toDelete.id;
            setToDelete(null);
            actions.run(() => store.deleteMatch(id));
          }}
        >
          <p>
            {GAME_NAME[toDelete.game]}, won by {PLAYER_NAME[toDelete.winner]} on {formatDateTime(toDelete.endedAt)}.
          </p>
          <p className="muted">Runs, titles and stats will be recalculated. This can't be undone.</p>
        </Confirm>
      )}
    </section>
  );
}
