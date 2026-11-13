// German Whist (pagat.com/whist/german_whist.html), two players.
//
// Each hand: 13 tricks are played while the stock lasts (stage 1), then 13 more (stage 2).
// Standard rule: whoever takes the majority of the 13 stage-2 tricks wins the hand.
// Variant: count all 26 tricks; 13-13 is a drawn hand.
// pagat gives no rule for a longer game, so a match here is first to N hands won (a setting),
// like the Champion of Champions matches. The deal alternates every hand and carries on across matches.

import { other, type Player } from '../../logic/types';

export interface WhistSettings {
  /** Hands to win a match. */
  target: number;
  /** true = count all 26 tricks; false (standard) = only the 13 stage-2 tricks. */
  countAll: boolean;
}

export const DEFAULT_WHIST: WhistSettings = { target: 3, countAll: false };

export interface WhistHand {
  /** Tricks that counted, per player. They add up to tricksPerHand. */
  tricks: Record<Player, number>;
  dealer: Player;
  at: number;
}

export interface WhistLive {
  target: number;
  countAll: boolean;
  hands: WhistHand[];
  startedAt: number;
  /** Who deals the next hand. The other player leads. */
  nextDealer: Player;
}

export interface WhistCompleted extends WhistLive {
  winner: Player;
  endedAt: number;
}

export const tricksPerHand = (countAll: boolean) => (countAll ? 26 : 13);

export function handWinner(h: WhistHand): Player | null {
  if (h.tricks.paul === h.tricks.bex) return null;
  return h.tricks.paul > h.tricks.bex ? 'paul' : 'bex';
}

/** Hands won by each player. Drawn hands count for nobody. */
export function score(hands: WhistHand[]): Record<Player, number> {
  const s = { paul: 0, bex: 0 };
  for (const h of hands) {
    const w = handWinner(h);
    if (w) s[w]++;
  }
  return s;
}

export function totalTricks(hands: WhistHand[]): Record<Player, number> {
  const s = { paul: 0, bex: 0 };
  for (const h of hands) {
    s.paul += h.tricks.paul;
    s.bex += h.tricks.bex;
  }
  return s;
}

export function newMatch(settings: WhistSettings, dealer: Player, now: number): WhistLive {
  return { target: settings.target, countAll: settings.countAll, hands: [], startedAt: now, nextDealer: dealer };
}

export type HandResult = { live: WhistLive; completed: null } | { live: null; completed: WhistCompleted };

/** Record a hand from one player's trick count; the other player gets the rest. */
export function addHand(live: WhistLive, player: Player, tricks: number, now: number): HandResult {
  const total = tricksPerHand(live.countAll);
  if (!Number.isInteger(tricks) || tricks < 0 || tricks > total) throw new Error(`Tricks must be 0 to ${total}`);
  const hand: WhistHand = { tricks: { [player]: tricks, [other(player)]: total - tricks } as Record<Player, number>, dealer: live.nextDealer, at: now };
  const hands = [...live.hands, hand];
  const nextDealer = other(live.nextDealer);
  const s = score(hands);
  const w = handWinner(hand);
  if (w && s[w] >= live.target) {
    return { live: null, completed: { ...live, hands, nextDealer, winner: w, endedAt: now } };
  }
  return { live: { ...live, hands, nextDealer }, completed: null };
}

/** Undo the last hand. The deal goes back to whoever dealt it. */
export function undoHand(live: WhistLive): WhistLive {
  const last = live.hands[live.hands.length - 1];
  if (!last) return live;
  return { ...live, hands: live.hands.slice(0, -1), nextDealer: last.dealer };
}

/** A finished match back in play with its winning hand removed. */
export function reopen(m: WhistCompleted): WhistLive {
  const { winner: _w, endedAt: _e, ...live } = m;
  return undoHand(live);
}

export function switchDealer(live: WhistLive): WhistLive {
  return { ...live, nextDealer: other(live.nextDealer) };
}
