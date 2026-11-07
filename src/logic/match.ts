import { other, type CompletedMatch, type Game, type LiveMatch, type Player } from './types';

export function score(hands: { winner: Player }[]): Record<Player, number> {
  const s = { paul: 0, bex: 0 };
  for (const h of hands) s[h.winner]++;
  return s;
}

/** Who deals the first hand of a new match: carries on rotating from the last completed match. */
export function dealerForNewMatch(matches: CompletedMatch[]): Player | null {
  let last: CompletedMatch | null = null;
  for (const m of matches) if (!last || m.endedAt > last.endedAt) last = m;
  return last ? last.nextDealer : null;
}

export function newMatch(game: Game, target: number, dealer: Player, now: number): LiveMatch {
  return { game, target, hands: [], startedAt: now, nextDealer: dealer };
}

export type HandResult = { live: LiveMatch; completed: null } | { live: null; completed: Omit<CompletedMatch, 'id'> };

/** Record a hand. Returns the completed match once someone reaches the target. */
export function addHand(live: LiveMatch, winner: Player, now: number): HandResult {
  const hands = [...live.hands, { winner, dealer: live.nextDealer, at: now }];
  const nextDealer = other(live.nextDealer);
  const s = score(hands);
  if (s[winner] >= live.target) {
    return {
      live: null,
      completed: { game: live.game, target: live.target, winner, hands, startedAt: live.startedAt, endedAt: now, nextDealer },
    };
  }
  return { live: { ...live, hands, nextDealer }, completed: null };
}

/** Undo the last hand of a live match. The dealer goes back to whoever dealt that hand. */
export function undoHand(live: LiveMatch): LiveMatch {
  const last = live.hands[live.hands.length - 1];
  if (!last) return live;
  return { ...live, hands: live.hands.slice(0, -1), nextDealer: last.dealer };
}

/** Reopen a completed match with its winning hand removed. */
export function reopen(m: CompletedMatch): LiveMatch {
  return undoHand({ game: m.game, target: m.target, hands: m.hands, startedAt: m.startedAt, nextDealer: m.nextDealer });
}

export function switchDealer(live: LiveMatch): LiveMatch {
  return { ...live, nextDealer: other(live.nextDealer) };
}
