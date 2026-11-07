import { replay, type ReplayState } from './replay';
import { inPeriod, type Period } from './time';
import { GAMES, PLAYERS, type CompletedMatch, type Game, type Player } from './types';

export interface PlayerStats {
  matchesWon: number;
  handsWon: number;
  /** 0..100, null when no matches played */
  winPct: number | null;
  byGame: Record<Game, { matchesWon: number; handsWon: number }>;
  runsCompleted: number;
  runsCompletedAllTime: number;
  titleTakes: number;
}

export interface Leaderboard {
  matchesPlayed: number;
  players: Record<Player, PlayerStats>;
  runsCompleted: number;
  runsCompletedAllTime: number;
  longestReignCount: { player: Player; reign: number } | null;
  longestReignDays: { player: Player; days: number; current: boolean } | null;
}

const DAY = 24 * 60 * 60 * 1000;

export function leaderboard(matches: CompletedMatch[], period: Period, now: number, state: ReplayState = replay(matches)): Leaderboard {
  const inP = matches.filter((m) => inPeriod(m.endedAt, period, now));

  const blank = (): PlayerStats => ({
    matchesWon: 0,
    handsWon: 0,
    winPct: null,
    byGame: Object.fromEntries(GAMES.map((g) => [g, { matchesWon: 0, handsWon: 0 }])) as PlayerStats['byGame'],
    runsCompleted: 0,
    runsCompletedAllTime: 0,
    titleTakes: 0,
  });
  const players: Record<Player, PlayerStats> = { paul: blank(), bex: blank() };

  for (const m of inP) {
    players[m.winner].matchesWon++;
    players[m.winner].byGame[m.game].matchesWon++;
    for (const h of m.hands) {
      players[h.winner].handsWon++;
      players[h.winner].byGame[m.game].handsWon++;
    }
  }
  for (const p of PLAYERS) {
    players[p].winPct = inP.length ? (players[p].matchesWon / inP.length) * 100 : null;
  }

  for (const t of state.titles) {
    players[t.player].runsCompletedAllTime++;
    if (inPeriod(t.at, period, now)) players[t.player].runsCompleted++;
    if (t.kind === 'change') players[t.player].titleTakes++;
  }
  // Title takes are all-time by nature; "times taken from the other" ignores the first-ever title.

  let longestReignCount: Leaderboard['longestReignCount'] = null;
  let longestReignDays: Leaderboard['longestReignDays'] = null;
  for (const s of state.spells) {
    if (!longestReignCount || s.maxReign > longestReignCount.reign) longestReignCount = { player: s.player, reign: s.maxReign };
    const days = Math.floor(((s.end ?? now) - s.start) / DAY);
    if (!longestReignDays || days > longestReignDays.days) longestReignDays = { player: s.player, days, current: s.end === undefined };
  }

  return {
    matchesPlayed: inP.length,
    players,
    runsCompleted: state.titles.filter((t) => inPeriod(t.at, period, now)).length,
    runsCompletedAllTime: state.titles.length,
    longestReignCount,
    longestReignDays,
  };
}

