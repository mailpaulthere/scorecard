// Pure Yahtzee game state for Paul and Beccs: turn order, rounds, undo and edits.
// Every function returns a new object and leaves its input untouched.
//
// The dice being entered for the current turn live in a separate `Turn` object. That lets both
// phones see the dice as they are tapped in, without a dice tap ever overwriting a score the
// other phone has just committed (see data/games.ts).

import { other, type Player } from '../../logic/types';
import {
  CATEGORIES, LABELS, DEFAULT_SETTINGS, emptyCard, commit, totals, isCardComplete, openCategories,
  type Card, type Category, type YahtzeeSettings,
} from './scoring';

export const ROUNDS = 13;
const UNDO_LIMIT = 50;

export interface YPlayer {
  id: Player;
  card: Card;
}

export interface YGameCore {
  startedAt: number;
  settings: YahtzeeSettings;
  /** In seating order: players[0] goes first each round. */
  players: YPlayer[];
  /** Index into players of whose turn it is. */
  current: number;
}

export interface UndoEntry {
  label: string;
  state: YGameCore;
}

export interface YGame extends YGameCore {
  undo: UndoEntry[];
}

/** The dice for the turn in progress. Belongs to the game revision `rev`; stale turns are ignored. */
export interface Turn {
  rev: number;
  /** Counts edits within the turn, so a phone never builds on an older copy than the one it has seen. */
  seq?: number;
  /** Reminder-only throw counter, 0 to 3. 0 means the turn has just started. */
  throwCount: number;
  /** Held from earlier throws, sorted. */
  kept: number[];
  /** Entered for this throw, in the order they were entered. */
  fresh: number[];
}

export function newGame(first: Player, { settings = DEFAULT_SETTINGS, now = Date.now() }: { settings?: YahtzeeSettings; now?: number } = {}): YGame {
  return {
    startedAt: now,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    players: [first, other(first)].map((id) => ({ id, card: emptyCard() })),
    current: 0,
    undo: [],
  };
}

export function currentPlayer(game: YGameCore): YPlayer {
  return game.players[game.current];
}

export function playerCard(game: YGameCore, p: Player): Card {
  return game.players.find((x) => x.id === p)!.card;
}

/** 1-based round of the current turn. */
export function round(game: YGameCore): number {
  if (isFinished(game)) return ROUNDS;
  return ROUNDS - openCategories(currentPlayer(game).card).length + 1;
}

export function isFinished(game: YGameCore): boolean {
  return game.players.every((p) => isCardComplete(p.card));
}

function core(game: YGame): YGameCore {
  const { undo: _undo, ...rest } = game;
  return structuredClone(rest);
}

function withUndo(game: YGame, label: string): YGame {
  return { ...game, undo: [...game.undo, { label, state: core(game) }].slice(-UNDO_LIMIT) };
}

function replaceCard(game: YGame, index: number, card: Card): YGame {
  return { ...game, players: game.players.map((p, i) => (i === index ? { ...p, card } : p)) };
}

export const PLAYER_LABEL: Record<Player, string> = { paul: 'Paul', bex: 'Beccs' };

/**
 * Commit the current player's turn and pass to the next player.
 * With dice: score comes from the rules (Joker and Yahtzee bonus applied).
 * Without dice: { score, yahtzeeBonus } is a manual entry.
 */
export function commitTurn(
  game: YGame,
  category: Category,
  { dice = null, score = null, yahtzeeBonus = false }: { dice?: number[] | null; score?: number | null; yahtzeeBonus?: boolean } = {},
): YGame {
  if (isFinished(game)) throw new Error('The game is over');
  const player = currentPlayer(game);
  let card = commit(player.card, category, { dice, score, settings: game.settings });
  if (!dice && yahtzeeBonus) card = { ...card, yahtzeeBonusCount: card.yahtzeeBonusCount + 1 };

  let next = withUndo(game, `${PLAYER_LABEL[player.id]}'s ${LABELS[category]}`);
  next = replaceCard(next, game.current, card);
  next.current = isFinished(next) ? game.players.length - 1 : (game.current + 1) % game.players.length;
  return next;
}

export function canUndo(game: YGame): boolean {
  return game.undo.length > 0;
}

export function lastUndoLabel(game: YGame): string | null {
  return game.undo[game.undo.length - 1]?.label ?? null;
}

export function undo(game: YGame): YGame {
  if (!canUndo(game)) return game;
  const { state } = game.undo[game.undo.length - 1];
  return { ...structuredClone(state), undo: game.undo.slice(0, -1) };
}

/** Change a box that was already scored (or the Yahtzee bonus count). Undoable. */
export function editEntry(game: YGame, playerIndex: number, field: Category | 'yahtzeeBonusCount', value: number): YGame {
  const player = game.players[playerIndex];
  if (!player) throw new Error('No such player');
  if (field === 'yahtzeeBonusCount') {
    if (!Number.isInteger(value) || value < 0) throw new Error('Bonus count must be 0 or more');
  } else {
    if (!CATEGORIES.includes(field)) throw new Error(`Unknown category: ${field}`);
    if (player.card[field] === null) throw new Error('Only filled boxes can be edited');
    if (!Number.isInteger(value) || value < 0) throw new Error('Score must be a whole number of 0 or more');
  }
  const label = field === 'yahtzeeBonusCount' ? 'Yahtzee bonus' : LABELS[field];
  const next = withUndo(game, `edit to ${PLAYER_LABEL[player.id]}'s ${label}`);
  return replaceCard(next, playerIndex, { ...player.card, [field]: value });
}

export function updateSettings(game: YGame, settings: Partial<YahtzeeSettings>): YGame {
  return { ...game, settings: { ...game.settings, ...settings } };
}

export interface Standing {
  player: Player;
  total: number;
  rank: number;
}

/** Players by grand total, highest first, with shared ranks for ties. */
export function standings(game: YGameCore): Standing[] {
  const rows = game.players.map((p) => ({ player: p.id, total: totals(p.card).grandTotal })).sort((a, b) => b.total - a.total);
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.total !== rows[i - 1].total) rank = i + 1;
    return { ...r, rank };
  });
}

/** Grand totals by player, and the winner (null on a tie). */
export function outcome(game: YGameCore): { scores: Record<Player, number>; winner: Player | null } {
  const scores = { paul: 0, bex: 0 } as Record<Player, number>;
  for (const p of game.players) scores[p.id] = totals(p.card).grandTotal;
  const winner = scores.paul === scores.bex ? null : scores.paul > scores.bex ? 'paul' : 'bex';
  return { scores, winner };
}

// ---- Dice for the current turn ----

export function emptyTurn(rev: number): Turn {
  return { rev, throwCount: 0, kept: [], fresh: [] };
}

/** The turn to show for game revision `rev`: the stored one if it belongs to this revision, else empty. */
export function turnFor(turn: Turn | null | undefined, rev: number): Turn {
  return turn && turn.rev === rev ? turn : emptyTurn(rev);
}

/** The newer of two copies of the same turn (by seq); b wins a tie. */
export function newerTurn(a: Turn | null, b: Turn): Turn {
  return a && a.rev === b.rev && (a.seq ?? 0) > (b.seq ?? 0) ? a : b;
}

export function allDice(turn: Turn): number[] {
  return [...turn.kept, ...turn.fresh];
}

/** The throw being entered: 1 to 3. */
export function currentThrow(turn: Turn): number {
  return Math.max(1, turn.throwCount);
}

export function setThrow(turn: Turn, n: number): Turn {
  if (!Number.isInteger(n) || n < 0 || n > 3) throw new Error('Throw must be 0 to 3');
  return { ...turn, throwCount: n };
}

const sortedInsert = (list: number[], v: number) => [...list, v].sort((a, b) => a - b);

export function addDie(turn: Turn, value: number): Turn {
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error('A die shows 1 to 6');
  if (turn.kept.length + turn.fresh.length >= 5) return turn;
  return { ...turn, fresh: [...turn.fresh, value] };
}

/** Take back the last die entered for this throw. Kept dice are left alone. */
export function removeLastDie(turn: Turn): Turn {
  return { ...turn, fresh: turn.fresh.slice(0, -1) };
}

export function clearDice(turn: Turn): Turn {
  return { ...turn, kept: [], fresh: [] };
}

export function keepDie(turn: Turn, index: number): Turn {
  if (index < 0 || index >= turn.fresh.length) return turn;
  return { ...turn, kept: sortedInsert(turn.kept, turn.fresh[index]), fresh: turn.fresh.filter((_, i) => i !== index) };
}

export function releaseDie(turn: Turn, index: number): Turn {
  if (index < 0 || index >= turn.kept.length) return turn;
  return { ...turn, kept: turn.kept.filter((_, i) => i !== index), fresh: [...turn.fresh, turn.kept[index]] };
}

export function canRollAgain(turn: Turn): boolean {
  return currentThrow(turn) < 3 && turn.kept.length + turn.fresh.length === 5 && turn.kept.length < 5;
}

/** Next throw: kept dice stay, the rest are cleared ready for their new values. */
export function rollAgain(turn: Turn): Turn {
  if (!canRollAgain(turn)) return turn;
  return { ...turn, throwCount: currentThrow(turn) + 1, fresh: [] };
}
