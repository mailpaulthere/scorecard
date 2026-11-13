import { useMemo, useState } from 'react';
import { PLAYER_NAME } from '../../logic/types';
import { formatDateTime } from '../../logic/time';
import { Confirm } from '../../ui/Confirm';
import type { AppData } from '../types';
import { LABELS, LOWER, UPPER, totals } from './scoring';
import { useYahtzee, type YahtzeeResult } from './useYahtzee';

export function YahtzeeHistory({ d }: { d: AppData }) {
  const { results } = useYahtzee(d);
  const sorted = useMemo(() => [...results].sort((a, b) => b.endedAt - a.endedAt), [results]);
  const [open, setOpen] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<YahtzeeResult | null>(null);

  if (!sorted.length) return <section className="card muted">No Yahtzee games yet. Go roll!</section>;

  return (
    <section className="card">
      <h2>All games ({sorted.length})</h2>
      <ul className="list">
        {sorted.map((r) => (
          <li key={r.id} className="list-row column">
            <button className="row-main" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <div>
                <strong>{r.winner ? `${PLAYER_NAME[r.winner]} won` : 'Tie'}</strong> · {r.scores.paul}–{r.scores.bex}
                {r.detail.legacy && <span className="tag"> imported</span>}
                <div className="muted small">{formatDateTime(r.endedAt)}</div>
              </div>
              <span className="muted">{open === r.id ? '▲' : '▼'}</span>
            </button>
            {open === r.id && (
              <div className="row-detail">
                {r.detail.game ? (
                  <table className="yboard compact">
                    <thead>
                      <tr>
                        <th />
                        {r.detail.game.players.map((p) => (
                          <th key={p.id} className={p.id}>
                            {PLAYER_NAME[p.id]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...UPPER, ...LOWER].map((c) => (
                        <tr key={c}>
                          <th scope="row">{LABELS[c]}</th>
                          {r.detail.game!.players.map((p) => (
                            <td key={p.id}>{p.card[c]}</td>
                          ))}
                        </tr>
                      ))}
                      <tr className="total">
                        <th scope="row">Bonuses</th>
                        {r.detail.game.players.map((p) => {
                          const t = totals(p.card);
                          return <td key={p.id}>{t.upperBonus + t.yahtzeeBonusTotal}</td>;
                        })}
                      </tr>
                      <tr className="total grand">
                        <th scope="row">Total</th>
                        {r.detail.game.players.map((p) => (
                          <td key={p.id}>{totals(p.card).grandTotal}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="muted small">Imported from the old Yahtzee app: totals only.</p>
                )}
                <button className="btn small danger" onClick={() => setToDelete(r)}>
                  Delete game
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {toDelete && (
        <Confirm
          title="Delete this game?"
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
            {PLAYER_NAME.paul} {toDelete.scores.paul}, {PLAYER_NAME.bex} {toDelete.scores.bex} on {formatDateTime(toDelete.endedAt)}.
          </p>
          <p className="muted">It comes off the Yahtzee and Master leaderboards. This can't be undone.</p>
        </Confirm>
      )}
    </section>
  );
}
