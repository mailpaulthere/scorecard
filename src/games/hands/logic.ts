// A head-to-head match scored hand by hand, shared by Texas Hold'em and Blackjack.
//
// Each hand is won by one player or is a tie (split pot / push), which counts for nobody.
// Two ways a match ends (a per-game setting):
//   'race': first to `target` hands won.
//   'bust': played with real chips; the match ends when someone goes bust, which is tapped in.
// The deal (Hold'em button, Blackjack dealer) swaps every hand and carries on across matches.

import { other, type Player } from '../../logic/types';

export type MatchMode = 'race' | 'bust';

export interface HandsSettings {
  mode: MatchMode;
  /** Hands to win, in 'race' mode. */
  target: number;
}

export interface Hand {
  /** null for a split pot / push */
  winner: Player | null;
  dealer: Player;
  at: number;
}

export interface HandsLive {
  mode: MatchMode;
  target: number;
  hands: Hand[];
  startedAt: number;
  nextDealer: Player;
}

export interface HandsCompleted extends HandsLive {
  winner: Player;
  endedAt: number;
  /** In 'bust' mode, who ran out of chips. */
  bust?: Player;
}

export function score(hands: Hand[]): Record<Player, number> {
  const s = { paul: 0, bex: 0 };
  for (const h of hands) if (h.winner) s[h.winner]++;
  return s;
}

export const ties = (hands: Hand[]) => hands.filter((h) => !h.winner).length;

export function newMatch(settings: HandsSettings, dealer: Player, now: number): HandsLive {
  return { mode: settings.mode, target: settings.target, hands: [], startedAt: now, nextDealer: dealer };
}

export type HandResult = { live: HandsLive; completed: null } | { live: null; completed: HandsCompleted };

export function addHand(live: HandsLive, winner: Player | null, now: number): HandResult {
  const hands = [...live.hands, { winner, dealer: live.nextDealer, at: now }];
  const next = { ...live, hands, nextDealer: other(live.nextDealer) };
  if (live.mode === 'race' && winner && score(hands)[winner] >= live.target) {
    return { live: null, completed: { ...next, winner, endedAt: now } };
  }
  return { live: next, completed: null };
}

/** 'bust' mode: `loser` is out of chips, so the other player wins the match. */
export function goBust(live: HandsLive, loser: Player, now: number): HandsCompleted {
  return { ...live, winner: other(loser), bust: loser, endedAt: now };
}

export function undoHand(live: HandsLive): HandsLive {
  const last = live.hands[live.hands.length - 1];
  if (!last) return live;
  return { ...live, hands: live.hands.slice(0, -1), nextDealer: last.dealer };
}

/** Put a finished match back in play: undo the bust, or the winning hand of a race. */
export function reopen(m: HandsCompleted): HandsLive {
  const { winner: _w, endedAt: _e, bust, ...live } = m;
  return bust ? live : undoHand(live);
}

export function switchDealer(live: HandsLive): HandsLive {
  return { ...live, nextDealer: other(live.nextDealer) };
}
