import { describe, expect, test } from 'vitest';
import { addHand, handWinner, newMatch, reopen, score, switchDealer, undoHand, type WhistLive } from './logic';

const start = (target = 2, countAll = false) => newMatch({ target, countAll }, 'paul', 1);
const live = (r: ReturnType<typeof addHand>): WhistLive => {
  if (!r.live) throw new Error('match ended');
  return r.live;
};

describe('German Whist', () => {
  test('majority of 13 stage-2 tricks wins the hand, the other player gets the rest', () => {
    const m = live(addHand(start(), 'paul', 8, 2));
    expect(m.hands[0].tricks).toEqual({ paul: 8, bex: 5 });
    expect(handWinner(m.hands[0])).toBe('paul');
    const m2 = live(addHand(m, 'bex', 9, 3));
    expect(m2.hands[1].tricks).toEqual({ paul: 4, bex: 9 });
    expect(score(m2.hands)).toEqual({ paul: 1, bex: 1 });
  });

  test('deal alternates every hand', () => {
    let m = start();
    expect(m.nextDealer).toBe('paul');
    m = live(addHand(m, 'paul', 3, 2));
    expect(m.hands[0].dealer).toBe('paul');
    expect(m.nextDealer).toBe('bex');
    expect(switchDealer(m).nextDealer).toBe('paul');
  });

  test('first to the target wins the match', () => {
    let m = live(addHand(start(2), 'paul', 7, 2));
    m = live(addHand(m, 'paul', 2, 3));
    const r = addHand(m, 'paul', 10, 4);
    expect(r.live).toBeNull();
    expect(r.completed).toMatchObject({ winner: 'paul', endedAt: 4, nextDealer: 'bex' });
    expect(r.completed!.hands).toHaveLength(3);
  });

  test('counting all 26 tricks allows a drawn hand that counts for nobody', () => {
    let m = live(addHand(start(1, true), 'paul', 13, 2));
    expect(m.hands[0].tricks).toEqual({ paul: 13, bex: 13 });
    expect(score(m.hands)).toEqual({ paul: 0, bex: 0 });
    const r = addHand(m, 'bex', 14, 3);
    expect(r.completed?.winner).toBe('bex');
    expect(() => addHand(m, 'paul', 27, 3)).toThrow();
    m = start();
    expect(() => addHand(m, 'paul', 14, 3)).toThrow();
  });

  test('undo and reopen give the deal back', () => {
    const m = live(addHand(start(2), 'paul', 3, 2));
    expect(undoHand(m)).toMatchObject({ hands: [], nextDealer: 'paul' });
    const r = addHand(live(addHand(m, 'paul', 10, 3)), 'paul', 1, 4);
    const back = reopen(r.completed!);
    expect(back.hands).toHaveLength(2);
    expect(back.nextDealer).toBe('paul');
    expect(back).not.toHaveProperty('winner');
  });
});
