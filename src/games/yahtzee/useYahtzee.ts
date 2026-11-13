import { useRef } from 'react';
import type { AppData } from '../types';
import type { ResultDoc } from '../../data/games';
import { StaleError } from '../../data/store';
import { DEFAULT_SETTINGS, type YahtzeeSettings } from './scoring';
import { isFinished, newerTurn, outcome, turnFor, type Turn, type YGame } from './game';

/** What a finished Yahtzee game keeps in results/{id}.detail. Imported old games have only { legacy: true }. */
export interface YahtzeeDetail {
  game?: YGame;
  legacy?: boolean;
}

export type YahtzeeResult = ResultDoc<YahtzeeDetail>;

export function useYahtzee(d: AppData) {
  const live = d.games.live.yahtzee;
  const game = (live?.state as YGame | undefined) ?? null;
  const rev = live?.rev ?? 0;
  const turn = turnFor(live?.turn as Turn | null | undefined, rev);
  const settings: YahtzeeSettings = { ...DEFAULT_SETTINGS, ...(d.games.settings.yahtzee as Partial<YahtzeeSettings> | null) };
  const results = d.games.results.filter((r): r is YahtzeeResult => r.game === 'yahtzee');

  /** Apply a change to the game in progress. Resolves with the result id when it finished the game. */
  const change = (fn: (g: YGame) => YGame) =>
    d.gameStore.mutate<YGame, YahtzeeDetail>('yahtzee', rev, (cur) => {
      if (!cur) throw new StaleError();
      const next = fn(cur);
      if (!isFinished(next)) return { state: next };
      const o = outcome(next);
      return {
        state: null,
        result: { game: 'yahtzee', winner: o.winner, scores: o.scores, startedAt: next.startedAt, endedAt: Date.now(), detail: { game: next } },
      };
    });

  // Quick taps can land before the last one has come back from the store, so build on our own
  // latest write for a moment rather than on the (slightly older) snapshot.
  const mine = useRef<Turn | null>(null);
  const setTurn = (fn: (t: Turn) => Turn) => {
    const base = newerTurn(mine.current, turn);
    const next = { ...fn(base), seq: (base.seq ?? 0) + 1 };
    mine.current = next;
    return d.gameStore.setTurn('yahtzee', next);
  };

  return { game, rev, turn, settings, results, change, setTurn };
}
