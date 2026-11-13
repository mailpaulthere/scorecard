import { describe, expect, test } from 'vitest';
import {
  addDie, allDice, canRollAgain, canUndo, clearDice, commitTurn, currentPlayer, currentThrow, editEntry, emptyTurn,
  isFinished, keepDie, newGame, outcome, releaseDie, removeLastDie, rollAgain, round, standings, turnFor, undo,
  newerTurn, ROUNDS, type Turn, type YGame,
} from './game';
import { CATEGORIES, totals, type Category } from './scoring';

const play = (g: YGame, c: Category, dice: number[]) => commitTurn(g, c, { dice });
const enter = (t: Turn, values: number[]) => values.reduce(addDie, t);

describe('setup and turns', () => {
  test('the chosen player goes first, then turns alternate', () => {
    let g = newGame('bex', { now: 1 });
    expect(g.players.map((p) => p.id)).toEqual(['bex', 'paul']);
    expect(currentPlayer(g).id).toBe('bex');
    g = play(g, 'chance', [1, 2, 3, 4, 5]);
    expect(currentPlayer(g).id).toBe('paul');
    expect(round(g)).toBe(1);
    g = play(g, 'chance', [6, 6, 6, 6, 5]);
    expect(currentPlayer(g).id).toBe('bex');
    expect(round(g)).toBe(2);
  });

  test('a full game ends after 13 rounds each', () => {
    let g = newGame('paul');
    for (const c of CATEGORIES) {
      expect(isFinished(g)).toBe(false);
      g = play(g, c, [2, 2, 3, 3, 3]);
      g = play(g, c, [1, 2, 3, 4, 5]);
    }
    expect(isFinished(g)).toBe(true);
    expect(round(g)).toBe(ROUNDS);
    expect(() => play(g, 'chance', [1, 1, 1, 1, 1])).toThrow(/over/);
  });

  test('manual entry with a Yahtzee bonus', () => {
    let g = newGame('paul');
    g = commitTurn(g, 'yahtzee', { score: 50 });
    g = commitTurn(g, 'chance', { score: 20 });
    g = commitTurn(g, 'fours', { score: 20, yahtzeeBonus: true });
    expect(g.players[0].card.yahtzeeBonusCount).toBe(1);
  });
});

describe('undo and edit', () => {
  test('multi-step undo restores scores and turn', () => {
    let g = newGame('paul');
    g = play(g, 'chance', [1, 2, 3, 4, 5]);
    g = play(g, 'sixes', [6, 6, 6, 1, 2]);
    g = undo(g);
    expect(currentPlayer(g).id).toBe('bex');
    expect(g.players[1].card.sixes).toBeNull();
    g = undo(g);
    expect(currentPlayer(g).id).toBe('paul');
    expect(g.players[0].card.chance).toBeNull();
    expect(canUndo(g)).toBe(false);
    expect(undo(g)).toBe(g);
  });

  test('undo reopens a finished game', () => {
    let g = newGame('paul');
    for (const c of CATEGORIES) g = play(play(g, c, [1, 2, 3, 4, 5]), c, [1, 2, 3, 4, 5]);
    expect(isFinished(g)).toBe(true);
    g = undo(g);
    expect(isFinished(g)).toBe(false);
    expect(currentPlayer(g).id).toBe('bex');
  });

  test('editing a past entry is undoable', () => {
    let g = newGame('paul');
    g = play(g, 'chance', [1, 2, 3, 4, 5]);
    g = editEntry(g, 0, 'chance', 22);
    expect(g.players[0].card.chance).toBe(22);
    expect(currentPlayer(g).id).toBe('bex');
    g = undo(g);
    expect(g.players[0].card.chance).toBe(15);
    expect(() => editEntry(g, 0, 'ones', 3)).toThrow(/Only filled/);
    g = editEntry(g, 0, 'yahtzeeBonusCount', 2);
    expect(totals(g.players[0].card).yahtzeeBonusTotal).toBe(200);
  });

  test('undo does not alias earlier states', () => {
    const before = newGame('paul');
    play(before, 'chance', [1, 2, 3, 4, 5]);
    expect(before.players[0].card.chance).toBeNull();
  });
});

describe('result', () => {
  test('standings and winner', () => {
    let g = newGame('paul');
    g = commitTurn(g, 'chance', { score: 20 });
    g = commitTurn(g, 'chance', { score: 25 });
    expect(standings(g).map((s) => [s.player, s.rank])).toEqual([['bex', 1], ['paul', 2]]);
    expect(outcome(g)).toEqual({ scores: { paul: 20, bex: 25 }, winner: 'bex' });
  });

  test('a tie has no winner', () => {
    let g = newGame('paul');
    g = commitTurn(g, 'chance', { score: 20 });
    g = commitTurn(g, 'chance', { score: 20 });
    expect(outcome(g).winner).toBeNull();
    expect(standings(g).map((s) => s.rank)).toEqual([1, 1]);
  });
});

describe('dice for the current turn', () => {
  test('a turn only applies to the game revision it was entered for', () => {
    const t = enter(emptyTurn(3), [1, 2]);
    expect(turnFor(t, 3)).toBe(t);
    expect(allDice(turnFor(t, 4))).toEqual([]);
    expect(allDice(turnFor(null, 4))).toEqual([]);
  });

  test('kept dice carry into the next throw and only the rest are entered again', () => {
    let t = enter(emptyTurn(0), [2, 5, 2, 6, 2]);
    expect(currentThrow(t)).toBe(1);
    t = keepDie(keepDie(keepDie(t, 0), 1), 2);
    expect([t.kept, t.fresh]).toEqual([[2, 2, 2], [5, 6]]);
    t = rollAgain(t);
    expect(currentThrow(t)).toBe(2);
    expect([t.kept, t.fresh]).toEqual([[2, 2, 2], []]);
    t = enter(t, [4, 2]);
    expect(allDice(t).sort()).toEqual([2, 2, 2, 2, 4]);
  });

  test('a kept die can be released after the next throw', () => {
    let t = enter(emptyTurn(0), [2, 2, 3, 4, 6]);
    t = rollAgain(keepDie(keepDie(t, 0), 0));
    t = enter(t, [5, 5, 5]);
    t = releaseDie(releaseDie(t, 0), 0);
    t = keepDie(keepDie(keepDie(t, 0), 0), 0);
    expect([t.kept, t.fresh]).toEqual([[5, 5, 5], [2, 2]]);
    t = rollAgain(t);
    expect(currentThrow(t)).toBe(3);
    expect(allDice(t)).toEqual([5, 5, 5]);
  });

  test('no fourth throw, and nothing to roll when all 5 are kept', () => {
    let t = enter(emptyTurn(0), [1, 2, 3, 4, 5]);
    expect(canRollAgain(t)).toBe(true);
    t = enter(rollAgain(t), [1, 2, 3, 4, 5]);
    t = enter(rollAgain(t), [1, 2, 3, 4, 5]);
    expect(currentThrow(t)).toBe(3);
    expect(canRollAgain(t)).toBe(false);
    expect(rollAgain(t)).toBe(t);
    const h = [0, 0, 0, 0, 0].reduce(keepDie, enter(emptyTurn(0), [6, 6, 6, 6, 6]));
    expect(canRollAgain(h)).toBe(false);
  });

  test('entry is capped at 5, backspace only takes back fresh dice', () => {
    let t = enter(emptyTurn(0), [1, 2, 3, 4, 5, 6]);
    expect(allDice(t)).toHaveLength(5);
    t = removeLastDie(rollAgain(keepDie(t, 0)));
    expect([t.kept, t.fresh]).toEqual([[1], []]);
    t = removeLastDie(enter(t, [6, 4]));
    expect([t.kept, t.fresh]).toEqual([[1], [6]]);
    expect(allDice(clearDice(t))).toEqual([]);
    expect(() => addDie(t, 7)).toThrow();
  });
});

test('newerTurn prefers the copy with more edits, the stored one on a tie', () => {
  const a = { ...emptyTurn(1), seq: 3 };
  const b = { ...emptyTurn(1), seq: 2 };
  expect(newerTurn(a, b)).toBe(a);
  expect(newerTurn(b, { ...b })).not.toBe(b);
  expect(newerTurn({ ...a, rev: 0 }, b)).toBe(b);
  expect(newerTurn(null, b)).toBe(b);
});
