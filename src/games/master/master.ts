import { inPeriod, type Period } from '../../logic/time';
import { GAMES, GAME_NAME, PLAYERS, type CompletedMatch, type Player } from '../../logic/types';
import type { ResultDoc, SimpleGame } from '../../data/games';

/** Everything that can appear on the Master leaderboard: each Champion of Champions game, then the other games. */
export type MasterKind = CompletedMatch['game'] | SimpleGame;

export const SIMPLE_GAME_NAME: Record<SimpleGame, string> = { yahtzee: 'Yahtzee', whist: 'German Whist' };
export const MASTER_KINDS: MasterKind[] = [...GAMES, 'yahtzee', 'whist'];
export const KIND_NAME: Record<MasterKind, string> = { ...GAME_NAME, ...SIMPLE_GAME_NAME };

/** Paul's rule (Nov 2026): every win in any game is worth 1 point. Draws score nothing. */
export const POINTS_PER_WIN = 1;

export interface MasterEntry {
  id: string;
  kind: MasterKind;
  winner: Player | null;
  at: number;
  scores: Record<Player, number>;
}

export function masterEntries(matches: CompletedMatch[], results: ResultDoc[]): MasterEntry[] {
  const coc = matches.map((m) => {
    const scores = { paul: 0, bex: 0 };
    for (const h of m.hands) scores[h.winner]++;
    return { id: m.id, kind: m.game, winner: m.winner, at: m.endedAt, scores };
  });
  const rest = results.map((r) => ({ id: r.id, kind: r.game, winner: r.winner, at: r.endedAt, scores: r.scores }));
  return [...coc, ...rest].sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1));
}

export interface KindStats {
  played: number;
  draws: number;
  wins: Record<Player, number>;
}

export interface MasterBoard {
  played: number;
  draws: number;
  points: Record<Player, number>;
  wins: Record<Player, number>;
  byKind: Record<MasterKind, KindStats>;
  leader: Player | null;
}

export function masterBoard(entries: MasterEntry[], period: Period, now: number): MasterBoard {
  const blank = (): KindStats => ({ played: 0, draws: 0, wins: { paul: 0, bex: 0 } });
  const byKind = Object.fromEntries(MASTER_KINDS.map((k) => [k, blank()])) as Record<MasterKind, KindStats>;
  const total = blank();
  for (const e of entries) {
    if (!inPeriod(e.at, period, now)) continue;
    const k = (byKind[e.kind] ??= blank());
    k.played++;
    total.played++;
    if (e.winner) {
      k.wins[e.winner]++;
      total.wins[e.winner]++;
    } else {
      k.draws++;
      total.draws++;
    }
  }
  const points = Object.fromEntries(PLAYERS.map((p) => [p, total.wins[p] * POINTS_PER_WIN])) as Record<Player, number>;
  const leader = points.paul === points.bex ? null : points.paul > points.bex ? 'paul' : 'bex';
  return { played: total.played, draws: total.draws, points, wins: total.wins, byKind, leader };
}

/** Simple win/draw stats for one results-based game in a period. */
export function resultStats<R extends ResultDoc<unknown>>(results: R[], period: Period, now: number) {
  const inP = results.filter((r) => inPeriod(r.endedAt, period, now));
  const wins = { paul: 0, bex: 0 };
  let draws = 0;
  for (const r of inP) {
    if (r.winner) wins[r.winner]++;
    else draws++;
  }
  const winPct = Object.fromEntries(PLAYERS.map((p) => [p, inP.length ? (wins[p] / inP.length) * 100 : null])) as Record<Player, number | null>;
  return { played: inP.length, wins, draws, winPct, results: inP };
}
