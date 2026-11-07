export type Player = 'paul' | 'bex';
export type Game = 'bastard' | 'switch' | 'rummy';

export const PLAYERS: Player[] = ['paul', 'bex'];
export const GAMES: Game[] = ['bastard', 'switch', 'rummy'];

export const PLAYER_NAME: Record<Player, string> = { paul: 'Paul', bex: 'Bex' };
export const GAME_NAME: Record<Game, string> = { bastard: 'Bastard', switch: 'Switch', rummy: 'Rummy' };

export const other = (p: Player): Player => (p === 'paul' ? 'bex' : 'paul');

export interface Hand {
  winner: Player;
  dealer: Player;
  /** epoch ms */
  at: number;
}

/** A finished match, as stored in the `matches` collection. */
export interface CompletedMatch {
  id: string;
  game: Game;
  /** Hands needed to win this match (recorded per match, so changing the setting never rewrites history). */
  target: number;
  winner: Player;
  hands: Hand[];
  /** epoch ms */
  startedAt: number;
  /** epoch ms; the match counts in stats by this date */
  endedAt: number;
  /** Who deals the next hand after this match (keeps the dealer rotating across matches). */
  nextDealer: Player;
}

/** The single in-progress match (stored at `live/current`). */
export interface LiveMatch {
  game: Game;
  target: number;
  hands: Hand[];
  startedAt: number;
  nextDealer: Player;
}
