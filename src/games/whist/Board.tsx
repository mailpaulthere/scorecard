import { useMemo, useState } from 'react';
import { PLAYERS, PLAYER_NAME } from '../../logic/types';
import type { Period } from '../../logic/time';
import { PeriodPicker } from '../../ui/PeriodPicker';
import type { AppData } from '../types';
import { resultStats } from '../master/master';
import { score, totalTricks } from './logic';
import { useWhist } from './useWhist';

export function WhistBoard({ d }: { d: AppData }) {
  const { results } = useWhist(d);
  const [period, setPeriod] = useState<Period>('all');
  const now = Date.now();
  const s = useMemo(() => resultStats(results, period, now), [results, period, now]);
  const hands = s.results.flatMap((r) => r.detail.match.hands);
  const handsWon = score(hands);
  const tricks = totalTricks(hands);
  const slams = { paul: 0, bex: 0 };
  for (const h of hands) for (const p of PLAYERS) if (h.tricks[p] === 13 && h.tricks[p] > h.tricks[p === 'paul' ? 'bex' : 'paul']) slams[p]++;

  const row = (label: string, v: (p: (typeof PLAYERS)[number]) => string | number, big = false) => (
    <tr>
      <td>{label}</td>
      {PLAYERS.map((p) => (
        <td key={p} className={`num ${big ? 'big' : ''}`}>
          {v(p)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="stack">
      <PeriodPicker value={period} onChange={setPeriod} />
      <section className="card">
        <h2>German Whist</h2>
        {s.played === 0 ? (
          <p className="muted">No matches finished in this period.</p>
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
              {row('Matches won', (p) => s.wins[p], true)}
              {row('Win %', (p) => (s.winPct[p] === null ? '–' : `${Math.round(s.winPct[p]!)}%`))}
              {row('Hands won', (p) => handsWon[p])}
              {row('Tricks taken', (p) => tricks[p])}
              {row('Average tricks a hand', (p) => (hands.length ? (tricks[p] / hands.length).toFixed(1) : '–'))}
              {row('Grand slams (all 13)', (p) => slams[p])}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
