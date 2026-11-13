import type { AppData } from '../types';
import type { ResultDoc } from '../../data/games';
import { StaleError } from '../../data/store';
import { DEFAULT_WHIST, score, type WhistCompleted, type WhistLive, type WhistSettings, type HandResult } from './logic';

export type WhistResult = ResultDoc<{ match: WhistCompleted }>;

export function useWhist(d: AppData) {
  const live = d.games.live.whist;
  const match = (live?.state as WhistLive | undefined) ?? null;
  const rev = live?.rev ?? 0;
  const settings: WhistSettings = { ...DEFAULT_WHIST, ...(d.games.settings.whist as Partial<WhistSettings> | null) };
  const results = d.games.results.filter((r): r is WhistResult => r.game === 'whist');

  /** Who deals first in a new match: the deal carries on alternating from the last match. */
  const last = [...results].sort((a, b) => b.endedAt - a.endedAt)[0];
  const suggestedDealer = last?.detail.match?.nextDealer ?? null;

  const change = (fn: (m: WhistLive) => WhistLive) =>
    d.gameStore.mutate<WhistLive, never>('whist', rev, (cur) => {
      if (!cur) throw new StaleError();
      return { state: fn(cur) };
    });

  /** Record a hand; resolves with the result id if it won the match. */
  const hand = (fn: (m: WhistLive) => HandResult) =>
    d.gameStore.mutate<WhistLive, { match: WhistCompleted }>('whist', rev, (cur) => {
      if (!cur) throw new StaleError();
      const r = fn(cur);
      if (r.live) return { state: r.live };
      const c = r.completed;
      return {
        state: null,
        result: { game: 'whist', winner: c.winner, scores: score(c.hands), startedAt: c.startedAt, endedAt: c.endedAt, detail: { match: c } },
      };
    });

  return { match, rev, settings, results, suggestedDealer, change, hand };
}
