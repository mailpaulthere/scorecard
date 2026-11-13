import { useMemo, useState } from 'react';
import { PLAYER_NAME } from '../../logic/types';
import { formatDateTime } from '../../logic/time';
import { Confirm } from '../../ui/Confirm';
import type { AppData } from '../types';
import { handWinner } from './logic';
import { useWhist, type WhistResult } from './useWhist';

export function WhistHistory({ d }: { d: AppData }) {
  const { results } = useWhist(d);
  const sorted = useMemo(() => [...results].sort((a, b) => b.endedAt - a.endedAt), [results]);
  const [open, setOpen] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<WhistResult | null>(null);

  if (!sorted.length) return <section className="card muted">No German Whist matches yet. Go deal!</section>;

  return (
    <section className="card">
      <h2>All matches ({sorted.length})</h2>
      <ul className="list">
        {sorted.map((r) => {
          const m = r.detail.match;
          return (
            <li key={r.id} className="list-row column">
              <button className="row-main" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <div>
                  <strong>{PLAYER_NAME[m.winner]} won</strong> {Math.max(r.scores.paul, r.scores.bex)}–{Math.min(r.scores.paul, r.scores.bex)}
                  <div className="muted small">{formatDateTime(r.endedAt)}</div>
                </div>
                <span className="muted">{open === r.id ? '▲' : '▼'}</span>
              </button>
              {open === r.id && (
                <div className="row-detail">
                  <ol className="hands">
                    {m.hands.map((h, i) => {
                      const w = handWinner(h);
                      return (
                        <li key={i}>
                          Hand {i + 1}: {w ? `${PLAYER_NAME[w]} won` : 'drawn'} {h.tricks.paul}–{h.tricks.bex}{' '}
                          <span className="muted">({PLAYER_NAME[h.dealer]} dealt)</span>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="muted small">
                    First to {m.target}. {m.countAll ? 'All 26 tricks counted.' : 'Stage-2 tricks counted.'} Tricks shown Paul–Beccs.
                  </p>
                  <button className="btn small danger" onClick={() => setToDelete(r)}>
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
            d.actions.run(() => d.gameStore.deleteResult(id));
          }}
        >
          <p>
            Won by {PLAYER_NAME[toDelete.detail.match.winner]} on {formatDateTime(toDelete.endedAt)}.
          </p>
          <p className="muted">It comes off the German Whist and Master leaderboards. This can't be undone.</p>
        </Confirm>
      )}
    </section>
  );
}
