// Import of finished games from the old stand-alone Yahtzee app.
//
// The old app kept its history in each phone's browser storage, which this site can't read.
// Its export page (export.html in the yahtzee-scorecard repo) opens this site with the history
// in the address: https://scorecard-3d3b1.web.app/#import-yahtzee=<base64url JSON>.

import type { Player } from '../../logic/types';
import type { ResultDoc } from '../../data/games';

export const IMPORT_HASH = '#import-yahtzee=';

export interface LegacyEntry {
  id: string;
  date: number;
  players: { name: string; total: number; rank: number }[];
}

export function decodePayload(hash: string): LegacyEntry[] | null {
  if (!hash.startsWith(IMPORT_HASH)) return null;
  try {
    const b64 = hash.slice(IMPORT_HASH.length).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const history: unknown = Array.isArray(data) ? data : data?.history;
    if (!Array.isArray(history)) return null;
    return history.filter(
      (h): h is LegacyEntry =>
        h && typeof h.id === 'string' && typeof h.date === 'number' && Array.isArray(h.players) &&
        h.players.every((p: unknown) => p && typeof (p as { name: unknown }).name === 'string' && typeof (p as { total: unknown }).total === 'number'),
    );
  } catch {
    return null;
  }
}

/** Distinct player names in the old history, most frequent first. */
export function legacyNames(entries: LegacyEntry[]): string[] {
  const n = new Map<string, number>();
  for (const e of entries) for (const p of e.players) n.set(p.name.trim(), (n.get(p.name.trim()) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** A best guess at who each old name is. Anything unrecognised is left out. */
export function guessPlayer(name: string): Player | null {
  const n = name.trim().toLowerCase();
  if (/^paul/.test(n)) return 'paul';
  if (/^(bec|bex|reb)/.test(n)) return 'bex';
  return null;
}

export type NameMap = Record<string, Player | null>;

export interface ImportPlan {
  results: ResultDoc[];
  skipped: number;
}

/** Turn old history into results. Only games between exactly Paul and Beccs are imported. */
export function planImport(entries: LegacyEntry[], names: NameMap): ImportPlan {
  const results: ResultDoc[] = [];
  let skipped = 0;
  for (const e of entries) {
    const mapped = e.players.map((p) => ({ who: names[p.name.trim()] ?? null, total: p.total, name: p.name.trim() }));
    const ids = mapped.map((m) => m.who);
    if (mapped.length !== 2 || !ids.includes('paul') || !ids.includes('bex')) {
      skipped++;
      continue;
    }
    const scores = { paul: 0, bex: 0 } as Record<Player, number>;
    for (const m of mapped) scores[m.who!] = m.total;
    results.push({
      id: `yahtzee-legacy-${e.id}`,
      game: 'yahtzee',
      winner: scores.paul === scores.bex ? null : scores.paul > scores.bex ? 'paul' : 'bex',
      scores,
      startedAt: e.date,
      endedAt: e.date,
      detail: { legacy: true },
    });
  }
  return { results, skipped };
}
