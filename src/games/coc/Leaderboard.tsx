import { useMemo, useState } from 'react';
import { reignLabel, type ReplayState } from '../../logic/replay';
import { leaderboard } from '../../logic/stats';
import { formatDate, inPeriod, type Period } from '../../logic/time';
import { GAMES, GAME_NAME, PLAYERS, PLAYER_NAME, type CompletedMatch } from '../../logic/types';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
];

export function Leaderboard({ matches, state }: { matches: CompletedMatch[]; state: ReplayState }) {
  const [period, setPeriod] = useState<Period>('all');
  const now = Date.now();
  const lb = useMemo(() => leaderboard(matches, period, now, state), [matches, period, state, now]);
  const titles = state.titles.filter((t) => inPeriod(t.at, period, now)).reverse();

  return (
    <div className="stack">
      <div className="segmented" role="tablist">
        {PERIODS.map((p) => (
          <button key={p.id} className={period === p.id ? 'active' : ''} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <section className="card">
        <h2>Matches</h2>
        {lb.matchesPlayed === 0 ? (
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
              <tr>
                <td>Matches won</td>
                {PLAYERS.map((p) => (
                  <td key={p} className="num big">
                    {lb.players[p].matchesWon}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Win %</td>
                {PLAYERS.map((p) => (
                  <td key={p} className="num">
                    {lb.players[p].winPct === null ? '–' : `${Math.round(lb.players[p].winPct!)}%`}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Hands won</td>
                {PLAYERS.map((p) => (
                  <td key={p} className="num">
                    {lb.players[p].handsWon}
                  </td>
                ))}
              </tr>
              {GAMES.map((g) => (
                <tr key={g} className="sub">
                  <td>{GAME_NAME[g]}</td>
                  {PLAYERS.map((p) => (
                    <td key={p} className="num">
                      {lb.players[p].byGame[g].matchesWon}
                      <span className="muted small"> ({lb.players[p].byGame[g].handsWon} hands)</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Titles</h2>
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
            {period !== 'all' && (
              <tr>
                <td>Runs completed ({PERIODS.find((p) => p.id === period)!.label.toLowerCase()})</td>
                {PLAYERS.map((p) => (
                  <td key={p} className="num">
                    {lb.players[p].runsCompleted}
                  </td>
                ))}
              </tr>
            )}
            <tr>
              <td>Runs completed (all time)</td>
              {PLAYERS.map((p) => (
                <td key={p} className="num">
                  {lb.players[p].runsCompletedAllTime}
                </td>
              ))}
            </tr>
            <tr>
              <td>Took the title from the other</td>
              {PLAYERS.map((p) => (
                <td key={p} className="num">
                  {lb.players[p].titleTakes}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <dl className="facts">
          <dt>Longest reign (titles in a row)</dt>
          <dd>
            {lb.longestReignCount
              ? `${PLAYER_NAME[lb.longestReignCount.player]}: ${reignLabel(lb.longestReignCount.reign)}`
              : '–'}
          </dd>
          <dt>Longest reign (time held)</dt>
          <dd>
            {lb.longestReignDays
              ? `${PLAYER_NAME[lb.longestReignDays.player]}: ${lb.longestReignDays.days} day${lb.longestReignDays.days === 1 ? '' : 's'}${
                  lb.longestReignDays.current ? ' and counting' : ''
                }`
              : '–'}
          </dd>
        </dl>
      </section>

      <section className="card">
        <h2>Title history</h2>
        {titles.length === 0 ? (
          <p className="muted">No titles won in this period.</p>
        ) : (
          <ul className="list">
            {titles.map((t) => (
              <li key={t.matchId} className="list-row">
                <div>
                  <strong>{PLAYER_NAME[t.player]}</strong> · {reignLabel(t.reign)}
                  <div className="muted small">{formatDate(t.at)}</div>
                </div>
                <span className={`tag ${t.kind}`}>
                  {t.kind === 'first' ? 'First title' : t.kind === 'defence' ? 'Defence' : `Taken from ${PLAYER_NAME[t.from!]}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
