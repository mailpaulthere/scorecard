import type { CompletedMatch, Game, LiveMatch, Player } from '../logic/types';

export interface Snapshot {
  matches: CompletedMatch[];
  live: LiveMatch | null;
  /** Hands needed to win a new match */
  target: number;
  /** false until the first data has arrived */
  ready: boolean;
}

export const DEFAULT_TARGET = 3;

/**
 * Everything the UI needs from storage. Writes that depend on the current score take the
 * number of hands the caller saw, so two phones tapping at once can't double-record a hand.
 */
export interface Store {
  subscribe(cb: (s: Snapshot) => void, onError: (e: Error) => void): () => void;
  startMatch(game: Game, dealer: Player): Promise<void>;
  /** Returns the new match id when this hand finished the match. */
  recordHand(winner: Player, seenHands: number): Promise<string | null>;
  undoHand(seenHands: number): Promise<void>;
  switchDealer(): Promise<void>;
  abandon(): Promise<void>;
  /** Undo the winning hand of a just-finished match: it becomes the live match again. */
  reopenMatch(id: string): Promise<void>;
  deleteMatch(id: string): Promise<void>;
  setTarget(n: number): Promise<void>;
}

export interface AuthApi {
  onChange(cb: (signedIn: boolean) => void): () => void;
  signIn(passcode: string): Promise<void>;
  signOut(): Promise<void>;
}

export class StaleError extends Error {
  constructor() {
    super('The score changed on the other phone. Check it and try again.');
  }
}
