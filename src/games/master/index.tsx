import { useMemo, useState } from 'react';
import { PLAYERS, PLAYER_NAME } from '../../logic/types';
import { formatDateTime, inPeriod, type Period } from '../../logic/time';
import { reignLabel } from '../../logic/replay';
import { PeriodPicker } from '../../ui/PeriodPicker';
import type { AppData, GameTab } from '../types';
import { KIND_NAME, MASTER_KINDS, masterBoard, masterEntries } from './master';

function MasterBoard({ d }: { d: AppData }) {
  const [period, setPeriod] = useState<Period>('all');
  const now = Date.now();
  const entries = useMemo(() => masterEntries(d.coc.matches, d.games.results), [d.coc.matches, d.games.results]);
  const b = useMemo(() => masterBoard(entries, period, now), [entries, period, now]);
  const titles = d.cocState.titles.filter((t) => inPeriod(t.at, period, now));
  const titleCount = { paul: 0, bex: 0 };
  for (const t of titles) titleCount[t.player]++;

  return (
    <div className="stack">
      <PeriodPicker value={period} onChange={setPeriod} />
      <section className="status master-head">
        <div className="champ">
          <span className="champ-crown" aria-hidden>
            🏅
          </span>
          <div>
            <div className="champ-name">{b.leader ? `${PLAYER_NAME[b.leader]} leads` : b.played ? 'All square' : 'No games yet'}</div>
            <div className="champ-label">
              {PLAYER_NAME.paul} {b.points.paul} · {PLAYER_NAME.bex} {b.points.bex}
            </div>
          </div>
        </div>
        <p className="muted small">1 point for every win in any game. Draws score nothing.</p>
      </section>

      <section className="card">
        <h2>Points by game</h2>
        {b.played === 0 ? (
          <p className="muted">Nothing finished in this period.</p>
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
                <td>Total points</td>
                {PLAYERS.map((p) => (
                  <td key={p} className="num big">
                    {b.points[p]}
                  </td>
                ))}
              </tr>
              {MASTER_KINDS.map((k) => (
                <tr key={k} className="sub">
                  <td>
                    {KIND_NAME[k]}
                    {b.byKind[k].draws > 0 && <span className="muted small"> ({b.byKind[k].draws} drawn)</span>}
                  </td>
                  {PLAYERS.map((p) => (
                    <td key={p} className="num">
                      {b.byKind[k].wins[p]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>Champion of Champions titles</td>
                {PLAYERS.map((p) => (
                  <td key={p} className="num">
                    {titleCount[p]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
        <p className="muted small">Titles are shown for interest and don't add points.</p>
        {d.cocState.champion && (
          <p className="small">
            👑 {PLAYER_NAME[d.cocState.champion]} is {reignLabel(d.cocState.reign[d.cocState.champion])}.
          </p>
        )}
      </section>
    </div>
  );
}

function MasterHistory({ d }: { d: AppData }) {
  const entries = useMemo(() => masterEntries(d.coc.matches, d.games.results), [d.coc.matches, d.games.results]);
  const [limit, setLimit] = useState(50);
  if (!entries.length) return <section className="card muted">Nothing played yet.</section>;
  return (
    <section className="card">
      <h2>Every game ({entries.length})</h2>
      <ul className="list">
        {entries.slice(0, limit).map((e) => (
          <li key={e.id} className="list-row">
            <div>
              <strong>{KIND_NAME[e.kind]}</strong> · {e.winner ? `${PLAYER_NAME[e.winner]} won` : 'Draw'}{' '}
              <span className="muted">
                {Math.max(e.scores.paul, e.scores.bex)}–{Math.min(e.scores.paul, e.scores.bex)}
              </span>
              <div className="muted small">{formatDateTime(e.at)}</div>
            </div>
            {e.winner && <span className={`dot ${e.winner}`}>{PLAYER_NAME[e.winner][0]}</span>}
          </li>
        ))}
      </ul>
      {entries.length > limit && (
        <button className="btn full" onClick={() => setLimit(limit + 50)}>
          Show more
        </button>
      )}
      <p className="muted small">To delete a game, use the History in that game's tab.</p>
    </section>
  );
}

export const masterTab: GameTab = {
  id: 'master',
  name: 'Master leaderboard',
  short: 'Master',
  icon: '🏅',
  views: [
    { id: 'board', label: 'Leaderboard', icon: '🏅' },
    { id: 'history', label: 'All games', icon: '📜' },
  ],
  render(view, d) {
    return view === 'history' ? <MasterHistory d={d} /> : <MasterBoard d={d} />;
  },
};
