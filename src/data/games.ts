import type { Player } from '../logic/types';

/**
 * Storage for every game except Champion of Champions (which keeps its original
 * `matches` / `live/current` / `settings/app` documents untouched).
 *
 *   live/{game}      the game in progress: { rev, state, turn? }
 *   results/{id}     finished games of every kind: { game, winner, scores, startedAt, endedAt, detail }
 *   settings/{game}  per-game settings
 *
 * Every change to a game in progress goes through `mutate`, a transaction that checks the
 * revision the caller saw. If the other phone changed the game first, the write is refused
 * (StaleError) instead of overwriting it. Both phones listen to these documents, so every
 * change shows up on the other phone straight away.
 */

/** Ids of the games stored here. Add a new game's id to this list and to firestore.rules. */
export const SIMPLE_GAMES = ['yahtzee', 'whist', 'holdem', 'blackjack'] as const;
export type SimpleGame = (typeof SIMPLE_GAMES)[number];

export interface LiveDoc<S = unknown, T = unknown> {
  /** Bumped on every committed change. */
  rev: number;
  state: S;
  /** Optional scratch data written without a transaction (Yahtzee dice). */
  turn?: T | null;
}

export interface ResultDoc<D = unknown> {
  id: string;
  game: SimpleGame;
  /** null for a draw */
  winner: Player | null;
  /** Headline numbers for lists: Yahtzee grand totals, Whist hands won. */
  scores: Record<Player, number>;
  startedAt: number;
  endedAt: number;
  detail: D;
}

export type NewResult<D = unknown> = Omit<ResultDoc<D>, 'id'>;

export interface Mutation<S, D = unknown> {
  /** The new state, or null to end the game in progress. */
  state: S | null;
  /** A finished game to save. */
  result?: NewResult<D>;
}

export interface GamesSnapshot {
  live: Record<SimpleGame, LiveDoc | null>;
  results: ResultDoc[];
  settings: Record<SimpleGame, Record<string, unknown> | null>;
  ready: boolean;
}

const nulls = () => Object.fromEntries(SIMPLE_GAMES.map((g) => [g, null])) as Record<SimpleGame, null>;

export const emptyGamesSnapshot = (): GamesSnapshot => ({ live: nulls(), results: [], settings: nulls(), ready: false });

export interface GameStore {
  subscribe(cb: (s: GamesSnapshot) => void, onError: (e: Error) => void): () => void;
  /**
   * Change the game in progress. `expect` is the revision the caller saw, or 'none' when
   * starting a new game. Resolves with the new result's id if a result was saved.
   */
  mutate<S, D>(game: SimpleGame, expect: number | 'none', fn: (cur: S | null) => Mutation<S, D>): Promise<string | null>;
  /** Write the scratch `turn` field. Ignored if the game is no longer at revision `turn.rev`. */
  setTurn(game: SimpleGame, turn: { rev: number }): Promise<void>;
  /** Put a finished game back in play as `state` and delete its result. */
  reopen<S>(game: SimpleGame, resultId: string, state: S): Promise<void>;
  deleteResult(id: string): Promise<void>;
  setSettings(game: SimpleGame, data: Record<string, unknown>): Promise<void>;
  /** Save results with fixed ids (re-importing the same game just overwrites it). */
  importResults(results: ResultDoc[]): Promise<void>;
}
