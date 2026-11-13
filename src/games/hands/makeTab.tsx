import { useMemo, useState, type ReactNode } from 'react';
import { PLAYERS, PLAYER_NAME, other, type Player } from '../../logic/types';
import { formatDate, formatDateTime, type Period } from '../../logic/time';
import { Confirm } from '../../ui/Confirm';
import { DeviceCard } from '../../ui/DeviceCard';
import { PeriodPicker } from '../../ui/PeriodPicker';
import { StaleError } from '../../data/store';
import type { ResultDoc, SimpleGame } from '../../data/games';
import type { AppData, GameTab } from '../types';
import { resultStats } from '../master/master';
import {
  addHand, goBust, newMatch, reopen, score, switchDealer, ties, undoHand,
  type HandResult, type HandsCompleted, type HandsLive, type HandsSettings, type MatchMode,
} from './logic';

/** What makes one hand-by-hand game different from another. */
export interface HandsGame {
  id: SimpleGame;
  name: string;
  short: string;
  icon: string;
  /** What a tied hand is called: "Split pot", "Push". */
  tie: string;
  /** Chip shown next to the dealer's name. */
  dealerChip: string;
  /** One line about who does what this hand. */
  dealerNote: (dealer: Player) => string;
  defaults: HandsSettings;
  /** How each match mode reads in Settings. */
  modeText: Record<MatchMode, { label: string; description: string }>;
  rules: [string, string][];
}

type HandsResult = ResultDoc<{ match: HandsCompleted }>;

function useHands(g: HandsGame, d: AppData) {
  const live = d.games.live[g.id];
  const match = (live?.state as HandsLive | undefined) ?? null;
  const rev = live?.rev ?? 0;
  const settings: HandsSettings = { ...g.defaults, ...(d.games.settings[g.id] as Partial<HandsSettings> | null) };
  const results = d.games.results.filter((r): r is HandsResult => r.game === g.id);
  const last = [...results].sort((a, b) => b.endedAt - a.endedAt)[0];

  const finish = (c: HandsCompleted) => ({
    state: null,
    result: { game: g.id, winner: c.winner, scores: score(c.hands), startedAt: c.startedAt, endedAt: c.endedAt, detail: { match: c } },
  });

  const mutate = (fn: (m: HandsLive) => { state: HandsLive | null; result?: ReturnType<typeof finish>['result'] }) =>
    d.gameStore.mutate<HandsLive, { match: HandsCompleted }>(g.id, rev, (cur) => {
      if (!cur) throw new StaleError();
      return fn(cur);
    });

  return {
    match,
    rev,
    settings,
    results,
    suggestedDealer: last?.detail.match?.nextDealer ?? null,
    change: (fn: (m: HandsLive) => HandsLive) => mutate((m) => ({ state: fn(m) })),
    hand: (fn: (m: HandsLive) => HandResult) =>
      mutate((m) => {
        const r = fn(m);
        return r.live ? { state: r.live } : finish(r.completed);
      }),
    bust: (loser: Player) => mutate((m) => finish(goBust(m, loser, Date.now()))),
  };
}

type H = ReturnType<typeof useHands>;

function Play({ g, d }: { g: HandsGame; d: AppData }) {
  const h = useHands(g, d);
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const finished = finishedId ? h.results.find((r) => r.id === finishedId) : undefined;
  if (h.match) return <MatchView g={g} d={d} h={h} match={h.match} onFinished={setFinishedId} />;
  if (finished) return <ResultView g={g} d={d} result={finished} onDone={() => setFinishedId(null)} />;
  return <StartView g={g} d={d} h={h} />;
}

function describe(s: HandsSettings): string {
  return s.mode === 'bust' ? 'Play until someone runs out of chips.' : `First to ${s.target} hand${s.target === 1 ? '' : 's'} wins.`;
}

function StartView({ g, d, h }: { g: HandsGame; d: AppData; h: H }) {
  const [dealer, setDealer] = useState<Player | null>(h.suggestedDealer);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (!dealer || busy) return;
    setBusy(true);
    await d.actions.run(() => d.gameStore.mutate<HandsLive, never>(g.id, 'none', () => ({ state: newMatch(h.settings, dealer, Date.now()) })));
    setBusy(false);
  };
  return (
    <section className="card">
      <h2>New {g.name} match</h2>
      <p className="muted">{describe(h.settings)}</p>
      <div className="dealer-pick">
        {dealer ? (
          <>
            <span>
              <strong>{PLAYER_NAME[dealer]}</strong> {g.dealerChip} first
            </span>
            <button className="btn small" onClick={() => setDealer(other(dealer))}>
              ⇄ Switch
            </button>
          </>
        ) : (
          <>
            <span>Who {g.dealerChip} first?</span>
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

function ResultView({ g, d, result, onDone }: { g: HandsGame; d: AppData; result: HandsResult; onDone: () => void }) {
  const m = result.detail.match;
  return (
    <section className="card result">
      <div className="result-emoji">🎉</div>
      <h2>
        {PLAYER_NAME[m.winner]} wins {g.name}
      </h2>
      {m.bust ? (
        <p>{PLAYER_NAME[m.bust]} went bust after {m.hands.length} hands.</p>
      ) : (
        <div className="result-score">
          {result.scores.paul}–{result.scores.bex}
        </div>
      )}
      <p className="muted">Match saved.</p>
      <div className="row">
        <button className="btn" onClick={() => d.actions.run(() => d.gameStore.reopen(g.id, result.id, reopen(m))).then((ok) => ok && onDone())}>
          ↩ {m.bust ? 'Undo bust' : 'Undo last hand'}
        </button>
        <button className="btn primary" onClick={onDone}>
          Next match
        </button>
      </div>
    </section>
  );
}

function MatchView({ g, d, h, match, onFinished }: { g: HandsGame; d: AppData; h: H; match: HandsLive; onFinished: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'abandon' | Player | null>(null);
  const s = score(match.hands);
  const t = ties(match.hands);

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
  const won = (w: Player | null) => go(() => h.hand((m) => addHand(m, w, Date.now())));

  return (
    <section className="card match">
      <div className="match-head">
        <h2>{g.name}</h2>
        <span className="muted">
          {match.mode === 'bust' ? 'Until someone is bust' : `First to ${match.target}`}
          {formatDate(match.startedAt) !== formatDate(Date.now()) && ` · started ${formatDate(match.startedAt)}`}
        </span>
      </div>

      <div className="scoreboard">
        {PLAYERS.map((p, i) => (
          <div key={p} className="score-side">
            <div className="score-name">
              {PLAYER_NAME[p]}
              {match.nextDealer === p && <span className="dealer-chip">{g.dealerChip}</span>}
            </div>
            <div className="score-num">{s[p]}</div>
            {i === 0 && <span className="score-dash">–</span>}
          </div>
        ))}
      </div>
      <p className="muted small center">
        Hands won{t > 0 && ` · ${t} ${g.tie.toLowerCase()}${t === 1 ? '' : 's'}`}. {g.dealerNote(match.nextDealer)}
      </p>

      <div className="hand-dots" aria-label="Hands so far">
        {match.hands.slice(-30).map((x, i) => (
          <span key={i} className={`dot ${x.winner ?? 'draw'}`}>
            {x.winner ? PLAYER_NAME[x.winner][0] : '='}
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
      <button className="btn full" disabled={busy} onClick={() => won(null)}>
        {g.tie}
      </button>

      {match.mode === 'bust' && (
        <div className="row match-tools">
          {PLAYERS.map((p) => (
            <button key={p} className="btn danger-outline" disabled={busy} onClick={() => setConfirm(p)}>
              {PLAYER_NAME[p]} is bust
            </button>
          ))}
        </div>
      )}

      <div className="row match-tools">
        <button className="btn" disabled={busy || match.hands.length === 0} onClick={() => go(() => h.change(undoHand))}>
          ↩ Undo last hand
        </button>
        <button className="btn" disabled={busy} onClick={() => go(() => h.change(switchDealer))}>
          ⇄ Switch dealer
        </button>
      </div>
      <button className="btn link danger-text" onClick={() => setConfirm('abandon')}>
        Abandon match
      </button>

      {confirm === 'abandon' && (
        <Confirm
          title="Abandon this match?"
          confirmLabel="Abandon"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            go(() => d.gameStore.mutate(g.id, h.rev, () => ({ state: null })));
          }}
        >
          <p>It will be deleted and won't count on any leaderboard.</p>
        </Confirm>
      )}
      {(confirm === 'paul' || confirm === 'bex') && (
        <Confirm
          title={`${PLAYER_NAME[confirm]} is out of chips?`}
          confirmLabel={`${PLAYER_NAME[other(confirm)]} wins`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const loser = confirm;
            setConfirm(null);
            go(() => h.bust(loser));
          }}
        >
          <p>
            This ends the match as a win for {PLAYER_NAME[other(confirm)]}. You can undo it straight after.
          </p>
        </Confirm>
      )}
    </section>
  );
}

function Board({ g, d }: { g: HandsGame; d: AppData }) {
  const { results } = useHands(g, d);
  const [period, setPeriod] = useState<Period>('all');
  const now = Date.now();
  const s = useMemo(() => resultStats(results, period, now), [results, period, now]);
  const hands = s.results.flatMap((r) => r.detail.match.hands);
  const handsWon = score(hands);
  const busts = { paul: 0, bex: 0 };
  for (const r of s.results) if (r.detail.match.bust) busts[r.detail.match.bust]++;
  const longest = s.results.reduce((a, r) => Math.max(a, r.detail.match.hands.length), 0);

  const row = (label: string, v: (p: Player) => ReactNode, big = false) => (
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
        <h2>{g.name}</h2>
        {s.played === 0 ? (
          <p className="muted">No matches finished in this period.</p>
        ) : (
          <>
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
                {row('Hand win %', (p) => (hands.length ? `${Math.round((handsWon[p] / hands.length) * 100)}%` : '–'))}
                {(busts.paul > 0 || busts.bex > 0) && row('Went bust', (p) => busts[p])}
              </tbody>
            </table>
            <p className="muted small">
              {hands.length} hands played, {ties(hands)} {g.tie.toLowerCase()}
              {ties(hands) === 1 ? '' : 's'}. Longest match: {longest} hands.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function History({ g, d }: { g: HandsGame; d: AppData }) {
  const { results } = useHands(g, d);
  const sorted = useMemo(() => [...results].sort((a, b) => b.endedAt - a.endedAt), [results]);
  const [open, setOpen] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<HandsResult | null>(null);

  if (!sorted.length) return <section className="card muted">No {g.name} matches yet.</section>;
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
                  <strong>{PLAYER_NAME[m.winner]} won</strong>{' '}
                  {m.bust ? `(${PLAYER_NAME[m.bust]} bust)` : `${Math.max(r.scores.paul, r.scores.bex)}–${Math.min(r.scores.paul, r.scores.bex)}`}
                  <div className="muted small">
                    {formatDateTime(r.endedAt)} · {m.hands.length} hands
                  </div>
                </div>
                <span className="muted">{open === r.id ? '▲' : '▼'}</span>
              </button>
              {open === r.id && (
                <div className="row-detail">
                  <p className="small">
                    Hands won: {PLAYER_NAME.paul} {r.scores.paul}, {PLAYER_NAME.bex} {r.scores.bex}
                    {ties(m.hands) > 0 && `, ${g.tie.toLowerCase()} ${ties(m.hands)}`}.
                  </p>
                  <div className="hand-dots left">
                    {m.hands.map((x, i) => (
                      <span key={i} className={`dot ${x.winner ?? 'draw'}`}>
                        {x.winner ? PLAYER_NAME[x.winner][0] : '='}
                      </span>
                    ))}
                  </div>
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
          <p className="muted">It comes off the {g.name} and Master leaderboards. This can't be undone.</p>
        </Confirm>
      )}
    </section>
  );
}

function Settings({ g, d }: { g: HandsGame; d: AppData }) {
  const h = useHands(g, d);
  const [mode, setMode] = useState(h.settings.mode);
  const [target, setTarget] = useState(h.settings.target);
  const changed = mode !== h.settings.mode || target !== h.settings.target;
  return (
    <div className="stack">
      <section className="card">
        <h2>How a match is won</h2>
        <p className="muted">Applies to new matches only.</p>
        {(['bust', 'race'] as MatchMode[]).map((m) => (
          <label key={m} className={`choice ${mode === m ? 'on' : ''}`}>
            <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
            <span>
              <strong>{g.modeText[m].label}</strong>
              <span className="muted block small">{g.modeText[m].description}</span>
            </span>
          </label>
        ))}
        {mode === 'race' && (
          <div className="stepper">
            <button className="btn" onClick={() => setTarget(Math.max(1, target - 1))} aria-label="Fewer">
              −
            </button>
            <span className="stepper-value">{target}</span>
            <button className="btn" onClick={() => setTarget(Math.min(50, target + 1))} aria-label="More">
              +
            </button>
          </div>
        )}
        <button className="btn primary full" disabled={!changed} onClick={() => d.actions.run(() => d.gameStore.setSettings(g.id, { mode, target }))}>
          Save
        </button>
      </section>
      <section className="card">
        <h2>How to play</h2>
        {g.rules.map(([title, body]) => (
          <div key={title} className="rule">
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </section>
      <DeviceCard auth={d.auth} actions={d.actions} />
    </div>
  );
}

export function makeHandsTab(g: HandsGame): GameTab {
  return {
    id: g.id,
    name: g.name,
    short: g.short,
    icon: g.icon,
    views: [
      { id: 'play', label: 'Play', icon: g.icon },
      { id: 'board', label: 'Leaderboard', icon: '🏆' },
      { id: 'history', label: 'History', icon: '📜' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ],
    render(view, d) {
      switch (view) {
        case 'board':
          return <Board g={g} d={d} />;
        case 'history':
          return <History g={g} d={d} />;
        case 'settings':
          return <Settings g={g} d={d} />;
        default:
          return <Play g={g} d={d} />;
      }
    },
  };
}
