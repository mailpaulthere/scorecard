// Ported from the original Yahtzee Scorecard app's node:test suite.
// @ts-nocheck
import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import {
  scoreFor, options, commit, totals, upperProgress, emptyCard,
  validateManual, yahtzeeBonusEarned, UPPER, LOWER,
} from './scoring';

const card = (filled = {}) => ({ ...emptyCard(), ...filled });
const opt = (result, category) => result.options.find((o) => o.category === category);
const allowedOf = (result) => result.options.filter((o) => o.allowed).map((o) => o.category).sort();
const fillAll = (cats, value = 0) => Object.fromEntries(cats.map((c) => [c, value]));

describe('upper section', () => {
  test('sums matching dice for each face', () => {
    const dice = [1, 2, 2, 6, 6];
    assert.equal(scoreFor('ones', dice), 1);
    assert.equal(scoreFor('twos', dice), 4);
    assert.equal(scoreFor('threes', dice), 0);
    assert.equal(scoreFor('fours', dice), 0);
    assert.equal(scoreFor('fives', dice), 0);
    assert.equal(scoreFor('sixes', dice), 12);
  });
  test('five of a face', () => {
    assert.equal(scoreFor('fives', [5, 5, 5, 5, 5]), 25);
  });
});

describe('lower section', () => {
  test('3 of a Kind scores the total or 0', () => {
    assert.equal(scoreFor('threeKind', [4, 4, 4, 1, 2]), 15);
    assert.equal(scoreFor('threeKind', [4, 4, 4, 4, 2]), 18);
    assert.equal(scoreFor('threeKind', [4, 4, 3, 1, 2]), 0);
  });
  test('4 of a Kind scores the total or 0', () => {
    assert.equal(scoreFor('fourKind', [3, 3, 3, 3, 6]), 18);
    assert.equal(scoreFor('fourKind', [3, 3, 3, 3, 3]), 15);
    assert.equal(scoreFor('fourKind', [3, 3, 3, 6, 6]), 0);
  });
  test('Full House', () => {
    assert.equal(scoreFor('fullHouse', [2, 2, 5, 5, 5]), 25);
    assert.equal(scoreFor('fullHouse', [2, 2, 5, 5, 6]), 0);
    assert.equal(scoreFor('fullHouse', [5, 5, 5, 5, 2]), 0);
  });
  test('five of a kind is not a natural Full House', () => {
    assert.equal(scoreFor('fullHouse', [5, 5, 5, 5, 5]), 0);
  });
  test('Small Straight', () => {
    assert.equal(scoreFor('smallStraight', [1, 2, 3, 4, 4]), 30);
    assert.equal(scoreFor('smallStraight', [3, 4, 5, 6, 1]), 30);
    assert.equal(scoreFor('smallStraight', [2, 3, 4, 5, 6]), 30);
    assert.equal(scoreFor('smallStraight', [1, 2, 3, 5, 6]), 0);
  });
  test('Large Straight', () => {
    assert.equal(scoreFor('largeStraight', [1, 2, 3, 4, 5]), 40);
    assert.equal(scoreFor('largeStraight', [6, 5, 4, 3, 2]), 40);
    assert.equal(scoreFor('largeStraight', [1, 2, 3, 4, 4]), 0);
  });
  test('Yahtzee', () => {
    assert.equal(scoreFor('yahtzee', [6, 6, 6, 6, 6]), 50);
    assert.equal(scoreFor('yahtzee', [6, 6, 6, 6, 5]), 0);
  });
  test('Chance is always the total', () => {
    assert.equal(scoreFor('chance', [1, 3, 5, 6, 2]), 17);
    assert.equal(scoreFor('chance', [1, 1, 1, 1, 1]), 5);
  });
});

describe('edge cases', () => {
  test('1-2-3-4-6 is a small straight but not a large one', () => {
    const r = options(card(), [1, 2, 3, 4, 6]);
    assert.equal(opt(r, 'smallStraight').score, 30);
    assert.equal(opt(r, 'largeStraight').score, 0);
  });
  test('2-2-3-3-3 is a full house and 3 of a kind, not 4 of a kind', () => {
    const r = options(card(), [2, 2, 3, 3, 3]);
    assert.equal(opt(r, 'fullHouse').score, 25);
    assert.equal(opt(r, 'threeKind').score, 13);
    assert.equal(opt(r, 'fourKind').score, 0);
  });
  test('order of dice does not matter', () => {
    assert.equal(scoreFor('largeStraight', [5, 1, 4, 2, 3]), 40);
    assert.equal(scoreFor('fullHouse', [3, 2, 3, 2, 3]), 25);
  });
});

describe('options()', () => {
  test('lists only open boxes', () => {
    const r = options(card({ chance: 20, ones: 3 }), [1, 2, 3, 4, 5]);
    const cats = r.options.map((o) => o.category);
    assert.ok(!cats.includes('chance'));
    assert.ok(!cats.includes('ones'));
    assert.equal(cats.length, 11);
    assert.ok(r.options.every((o) => o.allowed));
    assert.equal(r.joker, false);
    assert.equal(r.reason, null);
  });
  test('highlights the best score, including ties', () => {
    const r = options(card(), [1, 2, 3, 4, 5]);
    assert.deepEqual(r.options.filter((o) => o.best).map((o) => o.category), ['largeStraight']);
    const tie = options(card({ largeStraight: 40 }), [2, 3, 4, 5, 6]);
    assert.deepEqual(tie.options.filter((o) => o.best).map((o) => o.category).sort(), ['smallStraight']);
    const tie2 = options(card({ largeStraight: 40, smallStraight: 30 }), [6, 6, 6, 6, 5]);
    // 6-6-6-6-5: 3K, 4K and Chance all score 29
    assert.deepEqual(tie2.options.filter((o) => o.best).map((o) => o.category).sort(), ['chance', 'fourKind', 'threeKind']);
  });
  test('nothing is "best" when every option scores 0', () => {
    const r = options(card(fillAll(['chance', 'ones', 'threes', 'fives'])), [1, 1, 3, 3, 5]);
    // 1-1-3-3-5 with ones/threes/fives/chance filled: everything open scores 0
    assert.ok(r.options.every((o) => o.score === 0));
    assert.ok(r.options.every((o) => !o.best));
  });
  test('rejects bad dice', () => {
    assert.throws(() => options(card(), [1, 2, 3, 4]));
    assert.throws(() => options(card(), [1, 2, 3, 4, 7]));
  });
});

describe('upper bonus', () => {
  test('62 gets no bonus', () => {
    const c = card({ ones: 2, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 });
    assert.equal(totals(c).upperTotal, 62);
    assert.equal(totals(c).upperBonus, 0);
    assert.equal(totals(c).upperSectionTotal, 62);
  });
  test('63 gets +35', () => {
    const c = card({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 });
    assert.equal(totals(c).upperTotal, 63);
    assert.equal(totals(c).upperBonus, 35);
    assert.equal(totals(c).upperSectionTotal, 98);
  });
  test('progress toward 63', () => {
    assert.deepEqual(upperProgress(card()), { pace: 0, needed: 63, secured: false, possible: true });
    const ahead = upperProgress(card({ fours: 16, ones: 2 }));
    assert.equal(ahead.pace, 4 - 1);
    assert.equal(ahead.needed, 45);
    const done = upperProgress(card({ sixes: 30, fives: 25, fours: 8 }));
    assert.equal(done.secured, true);
    assert.equal(done.needed, 0);
    const hopeless = upperProgress(card({ sixes: 0, fives: 0, fours: 0 }));
    assert.equal(hopeless.possible, false);
  });
});

describe('totals', () => {
  test('full card mirrors the paper card', () => {
    const c = card({
      ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18,
      threeKind: 20, fourKind: 22, fullHouse: 25, smallStraight: 30,
      largeStraight: 40, yahtzee: 50, chance: 23, yahtzeeBonusCount: 2,
    });
    assert.deepEqual(totals(c), {
      upperTotal: 63,
      upperBonus: 35,
      upperSectionTotal: 98,
      lowerBoxesTotal: 210,
      yahtzeeBonusTotal: 200,
      lowerSectionTotal: 410,
      grandTotal: 508,
    });
  });
  test('empty card is all zeros', () => {
    assert.equal(totals(emptyCard()).grandTotal, 0);
  });
});

describe('Yahtzee bonus', () => {
  test('+100 when the Yahtzee box holds 50', () => {
    const c = card({ yahtzee: 50 });
    assert.equal(yahtzeeBonusEarned(c, [4, 4, 4, 4, 4]), true);
    const next = commit(c, 'fours', { dice: [4, 4, 4, 4, 4] });
    assert.equal(next.fours, 20);
    assert.equal(next.yahtzeeBonusCount, 1);
    assert.equal(totals(next).yahtzeeBonusTotal, 100);
  });
  test('no limit on bonuses', () => {
    let c = card({ yahtzee: 50 });
    c = commit(c, 'fours', { dice: [4, 4, 4, 4, 4] });
    c = commit(c, 'twos', { dice: [2, 2, 2, 2, 2] });
    c = commit(c, 'sixes', { dice: [6, 6, 6, 6, 6] });
    assert.equal(c.yahtzeeBonusCount, 3);
    assert.equal(totals(c).yahtzeeBonusTotal, 300);
  });
  test('no bonus when the Yahtzee box holds 0, but Joker still applies', () => {
    const c = card({ yahtzee: 0 });
    assert.equal(yahtzeeBonusEarned(c, [4, 4, 4, 4, 4]), false);
    const r = options(c, [4, 4, 4, 4, 4]);
    assert.equal(r.yahtzeeBonus, false);
    assert.equal(r.joker, true);
    assert.equal(opt(r, 'fours').allowed, true);
    const next = commit(c, 'fours', { dice: [4, 4, 4, 4, 4] });
    assert.equal(next.yahtzeeBonusCount, 0);
  });
  test('first Yahtzee with an open Yahtzee box is not a bonus and not a Joker', () => {
    const r = options(card(), [3, 3, 3, 3, 3]);
    assert.equal(r.joker, false);
    assert.equal(r.yahtzeeBonus, false);
    assert.equal(opt(r, 'yahtzee').score, 50);
    assert.equal(opt(r, 'fullHouse').score, 0);
    assert.ok(r.options.every((o) => o.allowed));
    assert.deepEqual(r.options.filter((o) => o.best).map((o) => o.category), ['yahtzee']);
  });
});

describe('forced Joker (official, setting)', () => {
  const settings = { joker: 'forced' };
  const dice = [5, 5, 5, 5, 5];

  test('must use the matching upper box when it is open', () => {
    const r = options(card({ yahtzee: 50 }), dice, settings);
    assert.deepEqual(allowedOf(r), ['fives']);
    assert.equal(opt(r, 'fives').score, 25);
    assert.match(r.reason, /Fives is open/);
    assert.throws(() => commit(card({ yahtzee: 50 }), 'chance', { dice, settings }), /not allowed/);
  });

  test('matching upper filled: any open lower box, fixed boxes at full value', () => {
    const c = card({ yahtzee: 50, fives: 15 });
    const r = options(c, dice, settings);
    assert.deepEqual(allowedOf(r), ['chance', 'fourKind', 'fullHouse', 'largeStraight', 'smallStraight', 'threeKind']);
    assert.equal(opt(r, 'threeKind').score, 25);
    assert.equal(opt(r, 'fourKind').score, 25);
    assert.equal(opt(r, 'fullHouse').score, 25);
    assert.equal(opt(r, 'smallStraight').score, 30);
    assert.equal(opt(r, 'largeStraight').score, 40);
    assert.equal(opt(r, 'chance').score, 25);
    assert.deepEqual(r.options.filter((o) => o.best).map((o) => o.category), ['largeStraight']);
    const next = commit(c, 'largeStraight', { dice, settings });
    assert.equal(next.largeStraight, 40);
    assert.equal(next.yahtzeeBonusCount, 1);
  });

  test('upper boxes are not allowed while any lower box is open', () => {
    const c = card({ yahtzee: 50, fives: 15, threeKind: 20, fourKind: 0 });
    const r = options(c, dice, settings);
    for (const u of UPPER.filter((x) => x !== 'fives')) assert.equal(opt(r, u).allowed, false);
  });

  test('lower section full: must put 0 in an open upper box', () => {
    const c = card({ ...fillAll(LOWER, 0), yahtzee: 50, fives: 15, twos: 6 });
    const r = options(c, dice, settings);
    assert.deepEqual(allowedOf(r), ['fours', 'ones', 'sixes', 'threes']);
    assert.ok(r.options.every((o) => o.score === 0));
    assert.match(r.reason, /lower section is full/);
    const next = commit(c, 'sixes', { dice, settings });
    assert.equal(next.sixes, 0);
    assert.equal(next.yahtzeeBonusCount, 1);
  });

  test('Yahtzee box holding 0 still triggers the Joker', () => {
    const r = options(card({ yahtzee: 0 }), [4, 4, 4, 4, 4], settings);
    assert.equal(r.joker, true);
    assert.equal(r.yahtzeeBonus, false);
    assert.deepEqual(allowedOf(r), ['fours']);
  });
});

describe('free-choice Joker (default)', () => {
  const settings = { joker: 'free' };
  const dice = [3, 3, 3, 3, 3];

  test('any open box is allowed even when the matching upper box is open', () => {
    const r = options(card({ yahtzee: 50 }), dice, settings);
    assert.equal(r.joker, true);
    assert.ok(r.options.every((o) => o.allowed));
    assert.equal(opt(r, 'threes').score, 15);
    assert.equal(opt(r, 'chance').score, 15);
  });

  test('Full House and straights score full value even with the matching upper box open', () => {
    const r = options(card({ yahtzee: 50 }), dice, settings);
    assert.equal(opt(r, 'fullHouse').score, 25);
    assert.equal(opt(r, 'smallStraight').score, 30);
    assert.equal(opt(r, 'largeStraight').score, 40);
    assert.deepEqual(r.options.filter((o) => o.best).map((o) => o.category), ['largeStraight']);
  });

  test('Yahtzee box holding 0: still a Joker, full value, no bonus', () => {
    const r = options(card({ yahtzee: 0, threes: 9 }), dice, settings);
    assert.equal(opt(r, 'fullHouse').score, 25);
    assert.equal(opt(r, 'smallStraight').score, 30);
    assert.equal(opt(r, 'largeStraight').score, 40);
    assert.equal(opt(r, 'sixes').score, 0);
    assert.equal(opt(r, 'sixes').allowed, true);
    assert.equal(r.yahtzeeBonus, false);
  });

  test('only one box left: the Yahtzee goes there for whatever it scores, bonus still counts', () => {
    const all = Object.fromEntries([...UPPER, ...LOWER].map((c) => [c, 0]));
    const c = card({ ...all, yahtzee: 50, twos: null });
    const r = options(c, [5, 5, 5, 5, 5], settings);
    assert.deepEqual(allowedOf(r), ['twos']);
    assert.equal(opt(r, 'twos').score, 0);
    const next = commit(c, 'twos', { dice: [5, 5, 5, 5, 5], settings });
    assert.equal(next.twos, 0);
    assert.equal(next.yahtzeeBonusCount, 1);
  });

  test('is the default', () => {
    const r = options(card({ yahtzee: 50 }), dice);
    assert.ok(r.options.every((o) => o.allowed));
  });

  test('bonus still applies', () => {
    const next = commit(card({ yahtzee: 50 }), 'chance', { dice, settings });
    assert.equal(next.chance, 15);
    assert.equal(next.yahtzeeBonusCount, 1);
  });
});

describe('commit()', () => {
  test('does not mutate the input card', () => {
    const c = card();
    commit(c, 'chance', { dice: [1, 2, 3, 4, 5] });
    assert.equal(c.chance, null);
  });
  test('refuses a filled box', () => {
    assert.throws(() => commit(card({ chance: 10 }), 'chance', { score: 12 }), /already filled/);
  });
  test('manual score', () => {
    assert.equal(commit(card(), 'threeKind', { score: 17 }).threeKind, 17);
    assert.throws(() => commit(card(), 'threeKind', { score: -1 }));
    assert.throws(() => commit(card(), 'threeKind', { score: 2.5 }));
  });
  test('zero is allowed', () => {
    assert.equal(commit(card(), 'yahtzee', { dice: [1, 2, 3, 4, 6] }).yahtzee, 0);
  });
});

describe('validateManual()', () => {
  test('upper boxes must be multiples of the face', () => {
    assert.equal(validateManual('fours', 12), null);
    assert.equal(validateManual('fours', 0), null);
    assert.equal(validateManual('fours', 20), null);
    assert.match(validateManual('fours', 13), /multiple of 4/);
    assert.match(validateManual('fours', 24), /multiple of 4/);
  });
  test('fixed boxes', () => {
    assert.equal(validateManual('fullHouse', 25), null);
    assert.match(validateManual('fullHouse', 20), /25 or 0/);
    assert.equal(validateManual('largeStraight', 40), null);
    assert.match(validateManual('smallStraight', 40), /30 or 0/);
    assert.equal(validateManual('yahtzee', 0), null);
  });
  test('ranges', () => {
    assert.equal(validateManual('threeKind', 5), null);
    assert.equal(validateManual('threeKind', 30), null);
    assert.match(validateManual('threeKind', 4), /0 or 5 to 30/);
    assert.match(validateManual('fourKind', 31), /0 or 5 to 30/);
    assert.equal(validateManual('chance', 5), null);
    assert.match(validateManual('chance', 0), /5 to 30/);
    assert.match(validateManual('chance', 3), /5 to 30/);
  });
  test('non-integers', () => {
    assert.match(validateManual('chance', 7.5), /whole number/);
    assert.match(validateManual('chance', -1), /whole number/);
  });
});
