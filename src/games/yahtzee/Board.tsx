import { useMemo, useState } from 'react';
import { PLAYERS, PLAYER_NAME } from '../../logic/types';
import { formatDate, type Period } from '../../logic/time';
import { PeriodPicker } from '../../ui/PeriodPicker';
import type { AppData } from '../types';
import { resultStats } from '../master/master';
import { totals } from './scoring';
import { useYahtzee } from './useYahtzee';

export function YahtzeeBoard({ d }: { d: AppData }) {
  const { results } = useYahtzee(d);
  const [period, setPeriod] = useState<Period>('all');
  const now = Date.now();
  const s = useMemo(() => resultStats(results, period, now), [results, period, now]);

  const per = PLAYERS.map((p) => {
    const mine = s.results.map((r) => r.scores[p]);
    const best = mine.length ? Math.max(...mine) : null;
    const bestAt = best === null ? null : s.results.find((r) => r.scores[p] === best)!.endedAt;
    const avg = mine.length ? Math.round(mine.reduce((a, b) => a + b, 0) / mine.length) : null;
    // Only games played in this app keep full cards; imported ones have totals only.
    const cards = s.results.flatMap((r) => r.detail.game?.players.filter((x) => x.id === p).map((x) => x.card) ?? []);
    const yahtzees = cards.reduce((a, c) => a + (c.yahtzee === 50 ? 1 : 0) + c.yahtzeeBonusCount, 0);
    const bonuses = cards.filter((c) => totals(c).upperBonus > 0).length;
    return { p, best, bestAt, avg, yahtzees, bonuses, cards: cards.length };
  });
  const cardGames = per[0].cards;

  return (
    <div className="stack">
      <PeriodPicker value={period} onChange={setPeriod} />
      <section className="card">
        <h2>Yahtzee</h2>
        {s.played === 0 ? (
          <p className="muted">No games finished in this period.</p>
        ) : (
          <table className="stats">
            <thead>
              <tr>
                <th></th>
                {PLAYERS.map((p) => (
                  <th key={p}>{PLAYER_NAME[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Games won</td>
                {PLAYERS.map((p) => (
                  <td key={p} className="num big">
                    {s.wins[p]}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Win %</td>
                {PLAYERS.map((p) => (
                  <td key={p} className="num">
                    {s.winPct[p] === null ? '–' : `${Math.round(s.winPct[p]!)}%`}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Average score</td>
                {per.map((x) => (
                  <td key={x.p} className="num">
                    {x.avg ?? '–'}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Best score</td>
                {per.map((x) => (
                  <td key={x.p} className="num">
                    {x.best ?? '–'}
                    {x.bestAt && <div className="muted small">{formatDate(x.bestAt)}</div>}
                  </td>
                ))}
              </tr>
              {cardGames > 0 && (
                <>
                  <tr>
                    <td>Yahtzees rolled</td>
                    {per.map((x) => (
                      <td key={x.p} className="num">
                        {x.yahtzees}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Upper bonus made</td>
                    {per.map((x) => (
                      <td key={x.p} className="num">
                        {x.bonuses}
                      </td>
                    ))}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}
        {s.draws > 0 && (
          <p className="muted small">
            {s.draws} tied game{s.draws === 1 ? '' : 's'}.
          </p>
        )}
        {cardGames > 0 && cardGames < s.played && (
          <p className="muted small">Yahtzees and bonuses only count games played here since the merge ({cardGames} so far). Imported games kept totals only.</p>
        )}
      </section>
    </div>
  );
}
