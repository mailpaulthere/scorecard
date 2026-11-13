import { describe, expect, test } from 'vitest';
import { addHand, goBust, newMatch, reopen, score, switchDealer, ties, undoHand, type HandsLive } from './logic';

const live = (r: ReturnType<typeof addHand>): HandsLive => {
  if (!r.live) throw new Error('match ended');
  return r.live;
};

describe('hand-by-hand matches', () => {
  test('race: first to the target wins, ties count for nobody, deal swaps every hand', () => {
    let m = newMatch({ mode: 'race', target: 2 }, 'paul', 1);
    m = live(addHand(m, 'bex', 2));
    m = live(addHand(m, null, 3));
    expect(score(m.hands)).toEqual({ paul: 0, bex: 1 });
    expect(ties(m.hands)).toBe(1);
    expect(m.hands.map((h) => h.dealer)).toEqual(['paul', 'bex']);
    expect(m.nextDealer).toBe('paul');
    m = live(addHand(m, 'paul', 4));
    const r = addHand(m, 'bex', 5);
    expect(r.completed).toMatchObject({ winner: 'bex', endedAt: 5, nextDealer: 'paul' });
  });

  test('bust: hands never end the match, going bust does', () => {
    let m = newMatch({ mode: 'bust', target: 1 }, 'bex', 1);
    for (let i = 0; i < 5; i++) m = live(addHand(m, 'paul', i));
    const done = goBust(m, 'bex', 9);
    expect(done).toMatchObject({ winner: 'paul', bust: 'bex', endedAt: 9 });
    const back = reopen(done);
    expect(back.hands).toHaveLength(5);
    expect(back).not.toHaveProperty('bust');
    expect(back).not.toHaveProperty('winner');
  });

  test('undo, reopen and switching the dealer', () => {
    let m = newMatch({ mode: 'race', target: 1 }, 'paul', 1);
    m = live(addHand(m, null, 2));
    expect(undoHand(m)).toMatchObject({ hands: [], nextDealer: 'paul' });
    expect(switchDealer(m).nextDealer).toBe('paul');
    const r = addHand(m, 'paul', 3);
    expect(reopen(r.completed!)).toMatchObject({ hands: [{ winner: null }], nextDealer: 'bex' });
  });
});
