import { describe, expect, test } from 'vitest';
import type { CompletedMatch } from '../../logic/types';
import type { ResultDoc } from '../../data/games';
import { masterBoard, masterEntries } from './master';

const NOW = Date.UTC(2026, 10, 13, 2); // Fri 13 Nov 2026, midday Brisbane
const DAY = 86_400_000;

const match = (id: string, game: CompletedMatch['game'], winner: 'paul' | 'bex', at: number): CompletedMatch => ({
  id, game, winner, target: 3, startedAt: at - 1000, endedAt: at, nextDealer: 'paul',
  hands: [{ winner, dealer: 'paul', at }],
});
const result = (id: string, game: ResultDoc['game'], winner: 'paul' | 'bex' | null, at: number): ResultDoc => ({
  id, game, winner, scores: { paul: 1, bex: 1 }, startedAt: at - 1000, endedAt: at, detail: null,
});

describe('Master leaderboard', () => {
  const entries = masterEntries(
    [match('m1', 'bastard', 'paul', NOW - DAY), match('m2', 'switch', 'bex', NOW - 40 * DAY)],
    [result('y1', 'yahtzee', 'bex', NOW - 2 * DAY), result('y2', 'yahtzee', null, NOW - 3 * DAY), result('w1', 'whist', 'bex', NOW - 1000)],
  );

  test('merges every game newest first', () => {
    expect(entries.map((e) => e.id)).toEqual(['w1', 'm1', 'y1', 'y2', 'm2']);
  });

  test('one point per win in any game, draws score nothing', () => {
    const all = masterBoard(entries, 'all', NOW);
    expect(all.points).toEqual({ paul: 1, bex: 3 });
    expect(all.played).toBe(5);
    expect(all.draws).toBe(1);
    expect(all.leader).toBe('bex');
    expect(all.byKind.yahtzee).toEqual({ played: 2, draws: 1, wins: { paul: 0, bex: 1 } });
    expect(all.byKind.rummy.played).toBe(0);
  });

  test('respects the period', () => {
    const month = masterBoard(entries, 'month', NOW);
    expect(month.points).toEqual({ paul: 1, bex: 2 });
    expect(month.byKind.switch.played).toBe(0);
  });
});
