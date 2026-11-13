import { describe, expect, test } from 'vitest';
import { decodePayload, guessPlayer, legacyNames, planImport, IMPORT_HASH, type LegacyEntry } from './legacy';

const encode = (data: unknown) =>
  IMPORT_HASH + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const history: LegacyEntry[] = [
  { id: 'g1', date: 1000, players: [{ name: 'Paul', total: 250, rank: 1 }, { name: 'Bex', total: 200, rank: 2 }] },
  { id: 'g2', date: 2000, players: [{ name: 'Bex ', total: 180, rank: 1 }, { name: 'Paul', total: 180, rank: 1 }] },
  { id: 'g3', date: 3000, players: [{ name: 'Paul', total: 150, rank: 1 }] },
  { id: 'g4', date: 4000, players: [{ name: 'Paul', total: 150, rank: 2 }, { name: 'Bex', total: 160, rank: 1 }, { name: 'Mum', total: 10, rank: 3 }] },
];

describe('old Yahtzee history import', () => {
  test('decodes the export link, including non-ASCII names', () => {
    const h = [{ ...history[0], players: [{ name: 'Paul', total: 1, rank: 1 }, { name: 'Bécs', total: 0, rank: 2 }] }];
    expect(decodePayload(encode({ v: 1, history: h }))).toEqual(h);
    expect(decodePayload('#nothing')).toBeNull();
    expect(decodePayload(IMPORT_HASH + '!!!')).toBeNull();
  });

  test('guesses names', () => {
    expect(guessPlayer(' paul ')).toBe('paul');
    expect(['Beccs', 'Bex', 'Becky', 'Rebecca'].map(guessPlayer)).toEqual(['bex', 'bex', 'bex', 'bex']);
    expect(guessPlayer('Mum')).toBeNull();
    expect(legacyNames(history)).toEqual(['Paul', 'Bex', 'Mum']);
  });

  test('imports only Paul-v-Beccs games, with stable ids and ties as draws', () => {
    const plan = planImport(history, { Paul: 'paul', Bex: 'bex', Mum: null });
    expect(plan.skipped).toBe(2);
    expect(plan.results.map((r) => [r.id, r.winner, r.scores])).toEqual([
      ['yahtzee-legacy-g1', 'paul', { paul: 250, bex: 200 }],
      ['yahtzee-legacy-g2', null, { paul: 180, bex: 180 }],
    ]);
  });

  test('two old names for the same person are not a Paul-v-Beccs game', () => {
    expect(planImport([history[0]], { Paul: 'bex', Bex: 'bex' }).skipped).toBe(1);
  });
});
