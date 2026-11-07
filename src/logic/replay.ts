import { GAMES, GAME_NAME, PLAYER_NAME, type CompletedMatch, type Game, type Player } from './types';

export type TitleKind = 'first' | 'defence' | 'change';

export interface TitleEvent {
  matchId: string;
  at: number;
  player: Player;
  /** Reign count after this run */
  reign: number;
  kind: TitleKind;
  /** For a 'change', who lost the title */
  from?: Player;
  /** The three matches that made up the run, in order */
  runMatchIds: string[];
}

export interface Run {
  holder: Player;
  games: Game[];
  matchIds: string[];
}

export interface ReignSpell {
  player: Player;
  start: number;
  /** undefined while still held */
  end?: number;
  /** Highest reign count reached during this spell */
  maxReign: number;
}

export interface ReplayState {
  champion: Player | null;
  reign: Record<Player, number>;
  run: Run | null;
  titles: TitleEvent[];
  spells: ReignSpell[];
}

/** Stable chronological order: by end time, then id as a tiebreak. */
export function sortMatches<T extends CompletedMatch>(matches: T[]): T[] {
  return [...matches].sort((a, b) => a.endedAt - b.endedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Derive all run/title/reign state by replaying completed matches in order.
 * Nothing here is ever stored; deleting or undoing a match just changes the input.
 */
export function replay(matches: CompletedMatch[]): ReplayState {
  let champion: Player | null = null;
  const reign: Record<Player, number> = { paul: 0, bex: 0 };
  let run: Run | null = null;
  const titles: TitleEvent[] = [];
  const spells: ReignSpell[] = [];

  for (const m of sortMatches(matches)) {
    const w = m.winner;
    if (run && run.holder === w && !run.games.includes(m.game)) {
      // Extend the current run.
      run = { holder: w, games: [...run.games, m.game], matchIds: [...run.matchIds, m.id] };
    } else {
      // New run at 1: either the winner had no run (opponent's run is wiped),
      // or the history contains a repeat within the run (possible after a deletion),
      // which restarts the winner's run with this game.
      run = { holder: w, games: [m.game], matchIds: [m.id] };
    }

    if (run.games.length === GAMES.length) {
      let kind: TitleKind;
      let from: Player | undefined;
      if (champion === w) {
        kind = 'defence';
        reign[w] += 1;
        spells[spells.length - 1].maxReign = reign[w];
      } else {
        kind = champion === null ? 'first' : 'change';
        if (champion !== null) {
          from = champion;
          reign[champion] = 0;
          spells[spells.length - 1].end = m.endedAt;
        }
        champion = w;
        reign[w] = 1;
        spells.push({ player: w, start: m.endedAt, maxReign: 1 });
      }
      titles.push({ matchId: m.id, at: m.endedAt, player: w, reign: reign[w], kind, from, runMatchIds: run.matchIds });
      run = null; // both runs reset; any game may be chosen next
    }
  }

  return { champion, reign, run, titles, spells };
}

export interface GameOption {
  game: Game;
  allowed: boolean;
  reason?: string;
}

/** Which games may be started next. */
export function gameOptions(state: Pick<ReplayState, 'run'>): GameOption[] {
  return GAMES.map((game) => {
    if (state.run && state.run.games.includes(game)) {
      return { game, allowed: false, reason: `${GAME_NAME[game]} is already in ${PLAYER_NAME[state.run.holder]}'s run` };
    }
    return { game, allowed: true };
  });
}

export function allowedGames(state: Pick<ReplayState, 'run'>): Game[] {
  return gameOptions(state).filter((o) => o.allowed).map((o) => o.game);
}

const MULTIPLIER: Record<number, string> = { 2: 'Double', 3: 'Triple', 4: 'Quadruple' };

/** 1 = "Champion of Champions", 2 = "Double ...", 5 = "5x ..." */
export function reignLabel(n: number): string {
  if (n <= 0) return '';
  if (n === 1) return 'Champion of Champions';
  return `${MULTIPLIER[n] ?? `${n}x`} Champion of Champions`;
}

export function celebrationMessage(e: TitleEvent): string {
  const name = PLAYER_NAME[e.player];
  if (e.kind === 'change') return `${name} takes the crown from ${PLAYER_NAME[e.from!]}!`;
  if (e.reign === 1) return `${name} is Champion of Champions!`;
  const mult = MULTIPLIER[e.reign]?.toUpperCase() ?? `${e.reign}x`;
  return `${name} is ${mult} Champion of Champions!`;
}
