// Pure Yahtzee scoring rules (Hasbro 2012), ported from the original Yahtzee Scorecard app.
// Dice are arrays of five integers 1-6.

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const;
export const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'] as const;
export const CATEGORIES = [...UPPER, ...LOWER];

export type Upper = (typeof UPPER)[number];
export type Lower = (typeof LOWER)[number];
export type Category = Upper | Lower;

/** A scorecard: each box holds a score once filled, or null while open. */
export type Card = Record<Category, number | null> & { yahtzeeBonusCount: number };

export type JokerMode = 'free' | 'forced';
export interface YahtzeeSettings {
  /** 'free' = house rule (any open box, full value). 'forced' = official rule. */
  joker: JokerMode;
}

export const LABELS: Record<Category, string> = {
  ones: 'Aces', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  threeKind: '3 of a Kind', fourKind: '4 of a Kind', fullHouse: 'Full House',
  smallStraight: 'Sm Straight', largeStraight: 'Lg Straight', yahtzee: 'Yahtzee', chance: 'Chance',
};

export const FIXED = { fullHouse: 25, smallStraight: 30, largeStraight: 40, yahtzee: 50 } as const;
type Fixed = keyof typeof FIXED;
const isFixed = (c: Category): c is Fixed => c in FIXED;

export const UPPER_BONUS = 35;
export const UPPER_BONUS_THRESHOLD = 63;
export const YAHTZEE_BONUS = 100;

export const DEFAULT_SETTINGS: YahtzeeSettings = { joker: 'free' };

export function faceOf(category: Category): number | null {
  const i = (UPPER as readonly string[]).indexOf(category);
  return i === -1 ? null : i + 1;
}

export function upperCategoryFor(face: number): Upper {
  return UPPER[face - 1];
}

export function emptyCard(): Card {
  const card = { yahtzeeBonusCount: 0 } as Card;
  for (const c of CATEGORIES) card[c] = null;
  return card;
}

export function isValidDice(dice: number[]): boolean {
  return Array.isArray(dice) && dice.length === 5 && dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6);
}

function counts(dice: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}

const sum = (dice: number[]) => dice.reduce((a, b) => a + b, 0);

function longestRun(dice: number[]): number {
  const present = new Set(dice);
  let best = 0;
  let run = 0;
  for (let f = 1; f <= 6; f++) {
    run = present.has(f) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function isYahtzee(dice: number[]): boolean {
  return dice.every((d) => d === dice[0]);
}

/** Natural score for a category, ignoring the Joker rule. */
export function scoreFor(category: Category, dice: number[]): number {
  const c = counts(dice);
  const max = Math.max(...c);
  const face = faceOf(category);
  if (face) return c[face] * face;
  switch (category) {
    case 'threeKind': return max >= 3 ? sum(dice) : 0;
    case 'fourKind': return max >= 4 ? sum(dice) : 0;
    case 'fullHouse': return c.includes(3) && c.includes(2) ? FIXED.fullHouse : 0;
    case 'smallStraight': return longestRun(dice) >= 4 ? FIXED.smallStraight : 0;
    case 'largeStraight': return longestRun(dice) === 5 ? FIXED.largeStraight : 0;
    case 'yahtzee': return max === 5 ? FIXED.yahtzee : 0;
    case 'chance': return sum(dice);
    default: throw new Error(`Unknown category: ${category}`);
  }
}

/** Score a category would get when played as a Joker. */
function jokerScore(category: Category, dice: number[]): number {
  if (isFixed(category) && category !== 'yahtzee') return FIXED[category];
  return scoreFor(category, dice);
}

export function isOpen(card: Card, category: Category): boolean {
  return card[category] === null || card[category] === undefined;
}

export function openCategories(card: Card): Category[] {
  return CATEGORIES.filter((c) => isOpen(card, c));
}

/** True when these dice earn a +100 Yahtzee bonus on this card. */
export function yahtzeeBonusEarned(card: Card, dice: number[]): boolean {
  return isYahtzee(dice) && card.yahtzee === FIXED.yahtzee;
}

export interface Option {
  category: Category;
  score: number;
  allowed: boolean;
  best: boolean;
}

export interface Options {
  joker: boolean;
  reason: string | null;
  yahtzeeBonus: boolean;
  options: Option[];
}

/** Every open box with what it would score for these dice. */
export function options(card: Card, dice: number[], settings: YahtzeeSettings = DEFAULT_SETTINGS): Options {
  if (!isValidDice(dice)) throw new Error('Dice must be five values 1-6');
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const open = openCategories(card);
  const joker = isYahtzee(dice) && !isOpen(card, 'yahtzee');
  let allowed = new Set<Category>(open);
  let reason: string | null = null;
  const scores = {} as Record<Category, number>;

  if (!joker) {
    for (const c of open) scores[c] = scoreFor(c, dice);
  } else if (s.joker === 'free') {
    for (const c of open) scores[c] = jokerScore(c, dice);
    reason = 'Joker: use any open box. Full House and straights score full value.';
  } else {
    ({ allowed, reason } = forcedJoker(card, dice, open));
    for (const c of open) {
      // Lower boxes take Joker values; upper boxes score naturally (0 unless matching).
      scores[c] = (LOWER as readonly string[]).includes(c) ? jokerScore(c, dice) : scoreFor(c, dice);
    }
  }

  const allowedScores = open.filter((c) => allowed.has(c)).map((c) => scores[c]);
  const bestScore = allowedScores.length ? Math.max(...allowedScores) : null;

  return {
    joker,
    reason,
    yahtzeeBonus: yahtzeeBonusEarned(card, dice),
    options: open.map((category) => ({
      category,
      score: scores[category],
      allowed: allowed.has(category),
      best: allowed.has(category) && bestScore !== null && bestScore > 0 && scores[category] === bestScore,
    })),
  };
}

function forcedJoker(card: Card, dice: number[], open: Category[]): { allowed: Set<Category>; reason: string } {
  const upper = upperCategoryFor(dice[0]);
  const name = LABELS[upper];
  if (isOpen(card, upper)) {
    return { allowed: new Set([upper]), reason: `Joker: ${name} is open, so this Yahtzee must go there.` };
  }
  const lower = LOWER.filter((c) => open.includes(c));
  if (lower.length) {
    return { allowed: new Set(lower), reason: `Joker: ${name} is filled, so use any open lower box at full value.` };
  }
  return {
    allowed: new Set(UPPER.filter((c) => open.includes(c))),
    reason: 'Joker: the lower section is full, so put a 0 in an open upper box.',
  };
}

/** Commit a score. Returns a new card. `score` overrides the computed value (manual entry). */
export function commit(
  card: Card,
  category: Category,
  { dice = null, score = null, settings = DEFAULT_SETTINGS }: { dice?: number[] | null; score?: number | null; settings?: YahtzeeSettings } = {},
): Card {
  if (!CATEGORIES.includes(category)) throw new Error(`Unknown category: ${category}`);
  if (!isOpen(card, category)) throw new Error(`${LABELS[category]} is already filled`);
  const next = { ...card };
  if (dice) {
    const opt = options(card, dice, settings).options.find((o) => o.category === category)!;
    if (!opt.allowed) throw new Error(`${LABELS[category]} is not allowed under the Joker rule`);
    next[category] = score ?? opt.score;
    if (yahtzeeBonusEarned(card, dice)) next.yahtzeeBonusCount = (card.yahtzeeBonusCount || 0) + 1;
  } else {
    if (score === null || !Number.isInteger(score) || score < 0) throw new Error('Score must be a whole number of 0 or more');
    next[category] = score;
  }
  return next;
}

export interface Totals {
  upperTotal: number;
  upperBonus: number;
  upperSectionTotal: number;
  lowerBoxesTotal: number;
  yahtzeeBonusTotal: number;
  lowerSectionTotal: number;
  grandTotal: number;
}

export function totals(card: Card): Totals {
  const val = (c: Category) => card[c] ?? 0;
  const upperTotal = UPPER.reduce((a, c) => a + val(c), 0);
  const upperBonus = upperTotal >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
  const upperSectionTotal = upperTotal + upperBonus;
  const lowerBoxesTotal = LOWER.reduce((a, c) => a + val(c), 0);
  const yahtzeeBonusTotal = (card.yahtzeeBonusCount || 0) * YAHTZEE_BONUS;
  const lowerSectionTotal = lowerBoxesTotal + yahtzeeBonusTotal;
  return {
    upperTotal,
    upperBonus,
    upperSectionTotal,
    lowerBoxesTotal,
    yahtzeeBonusTotal,
    lowerSectionTotal,
    grandTotal: upperSectionTotal + lowerSectionTotal,
  };
}

/**
 * Progress toward the 63-point upper bonus.
 * pace: points ahead (+) or behind (-) of three-of-each in every filled upper box.
 */
export function upperProgress(card: Card) {
  let pace = 0;
  let maxRemaining = 0;
  for (const c of UPPER) {
    const f = faceOf(c)!;
    if (isOpen(card, c)) maxRemaining += 5 * f;
    else pace += card[c]! - 3 * f;
  }
  const { upperTotal } = totals(card);
  const needed = Math.max(0, UPPER_BONUS_THRESHOLD - upperTotal);
  return { pace, needed, secured: needed === 0, possible: needed <= maxRemaining };
}

export function isCardComplete(card: Card): boolean {
  return openCategories(card).length === 0;
}

/** Every score a box can legitimately hold, including Joker values. */
const POSSIBLE = (() => {
  const sets = Object.fromEntries(CATEGORIES.map((c) => [c, new Set([0])])) as Record<Category, Set<number>>;
  const roll = [1, 1, 1, 1, 1];
  const visit = (i: number, min: number) => {
    if (i === 5) {
      for (const c of CATEGORIES) {
        sets[c].add(scoreFor(c, roll));
        if (isYahtzee(roll)) sets[c].add(jokerScore(c, roll));
      }
      return;
    }
    for (let f = min; f <= 6; f++) {
      roll[i] = f;
      visit(i + 1, f);
    }
  };
  visit(0, 1);
  sets.chance.delete(0); // Chance is always the dice total, minimum 5
  return sets;
})();

/** Manual-entry check. Returns null if the score is possible, else a warning. */
export function validateManual(category: Category, score: number): string | null {
  if (!Number.isInteger(score) || score < 0) return 'Enter a whole number of 0 or more.';
  if (POSSIBLE[category].has(score)) return null;
  const values = [...POSSIBLE[category]].sort((a, b) => a - b);
  const face = faceOf(category);
  if (face) return `${LABELS[category]} must be a multiple of ${face} from 0 to ${5 * face}.`;
  if (isFixed(category)) return `${LABELS[category]} scores ${FIXED[category]} or 0.`;
  return `${LABELS[category]} must be ${values.includes(0) ? '0 or ' : ''}${values.filter(Boolean)[0]} to ${values[values.length - 1]}.`;
}

export const BOX_HINTS: Record<Category, string> = {
  ones: 'Add up the 1s only',
  twos: 'Add up the 2s only',
  threes: 'Add up the 3s only',
  fours: 'Add up the 4s only',
  fives: 'Add up the 5s only',
  sixes: 'Add up the 6s only',
  threeKind: '3 the same · add total of all dice',
  fourKind: '4 the same · add total of all dice',
  fullHouse: '3 the same + a pair · score 25',
  smallStraight: '4 in a row · score 30',
  largeStraight: '5 in a row · score 40',
  yahtzee: '5 the same · score 50',
  chance: 'Any dice · add total of all dice',
};

export const BOX_RULES: Record<Category, string> = {
  ones: 'Add up only the 1s.',
  twos: 'Add up only the 2s.',
  threes: 'Add up only the 3s.',
  fours: 'Add up only the 4s.',
  fives: 'Add up only the 5s.',
  sixes: 'Add up only the 6s.',
  threeKind: 'At least three dice the same: score the total of all five dice. Otherwise 0.',
  fourKind: 'At least four dice the same: score the total of all five dice. Otherwise 0.',
  fullHouse: 'Three of one number and two of another: score 25.',
  smallStraight: 'Any four numbers in a row (1-2-3-4, 2-3-4-5 or 3-4-5-6): score 30.',
  largeStraight: 'Five numbers in a row (1-2-3-4-5 or 2-3-4-5-6): score 40.',
  yahtzee: 'All five dice the same: score 50.',
  chance: 'Any dice: score the total of all five.',
};

export const HOW_TO_SCORE: [string, string][] = [
  ['Each turn', 'Throw the five dice up to three times, keeping any you like between throws. Then fill exactly one empty box. A 0 is allowed when nothing fits.'],
  ['Game length', '13 rounds. Every player fills one box per round, so the game ends when both cards are full.'],
  ['Upper bonus', 'If Aces to Sixes add up to 63 or more, add 35. That is three of each number. "Ahead of pace" compares your upper boxes with three of each so far.'],
  ['Yahtzee bonus', 'If you throw another Yahtzee and your Yahtzee box already holds 50, you get +100. There is no limit. If your Yahtzee box holds 0, there is no bonus, but the Joker rule still applies.'],
  ['Joker rule (house, default)', 'Once your Yahtzee box is filled (50 or 0), a repeat Yahtzee can go in any open box. Full House scores 25, Small Straight 30 and Large Straight 40. Upper boxes score as normal.'],
  ['Joker rule (official)', 'A repeat Yahtzee must go in the upper box for its number if that box is open. Otherwise use any open lower box, with Full House and the straights at full value. If the lower section is full, put 0 in an open upper box. Switch to this in Settings.'],
];
