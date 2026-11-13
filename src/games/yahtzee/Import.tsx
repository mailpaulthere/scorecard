import { useMemo, useState } from 'react';
import { PLAYER_NAME, type Player } from '../../logic/types';
import { formatDate } from '../../logic/time';
import type { AppData } from '../types';
import { guessPlayer, legacyNames, planImport, type LegacyEntry, type NameMap } from './legacy';

export const IMPORT_HELP =
  'The old app saved games on each phone separately. On each phone, open the old Yahtzee app’s export page ' +
  '(its address with /export.html on the end) and tap “Send to Scorecard”. Importing the same games twice is harmless.';

export function YahtzeeImport({ entries, data, onDone }: { entries: LegacyEntry[]; data: AppData; onDone: () => void }) {
  const names = useMemo(() => legacyNames(entries), [entries]);
  const [map, setMap] = useState<NameMap>(() => Object.fromEntries(names.map((n) => [n, guessPlayer(n)])));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const plan = useMemo(() => planImport(entries, map), [entries, map]);
  const existing = new Set(data.games.results.map((r) => r.id));
  const fresh = plan.results.filter((r) => !existing.has(r.id)).length;
  const dates = entries.map((e) => e.date).sort((a, b) => a - b);

  const run = async () => {
    setBusy(true);
    const ok = await data.actions.run(() => data.gameStore.importResults(plan.results));
    setBusy(false);
    if (ok) setDone(plan.results.length);
  };

  if (done !== null) {
    return (
      <section className="card result">
        <div className="result-emoji">✅</div>
        <h2>Imported {done} Yahtzee game{done === 1 ? '' : 's'}</h2>
        <p className="muted">They're on the Yahtzee and Master leaderboards now, on both phones. If the other phone has old games too, send them from there as well.</p>
        <button className="btn primary big full" onClick={onDone}>
          Done
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Import old Yahtzee games</h2>
      {entries.length === 0 ? (
        <p className="muted">That link had no finished games in it.</p>
      ) : (
        <>
          <p className="muted">
            {entries.length} game{entries.length === 1 ? '' : 's'} from this phone's old Yahtzee app
            {dates.length > 0 && `, ${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}`}. Who is who?
          </p>
          <ul className="list">
            {names.map((n) => (
              <li key={n} className="list-row">
                <strong>{n}</strong>
                <select value={map[n] ?? ''} onChange={(e) => setMap({ ...map, [n]: (e.target.value || null) as Player | null })}>
                  <option value="paul">{PLAYER_NAME.paul}</option>
                  <option value="bex">{PLAYER_NAME.bex}</option>
                  <option value="">Someone else</option>
                </select>
              </li>
            ))}
          </ul>
          <p>
            <strong>{plan.results.length}</strong> Paul v Beccs game{plan.results.length === 1 ? '' : 's'} will be imported
            {plan.results.length > fresh && ` (${plan.results.length - fresh} already here, they'll just be refreshed)`}.
          </p>
          {plan.skipped > 0 && (
            <p className="muted small">
              {plan.skipped} game{plan.skipped === 1 ? '' : 's'} left out: solo games, or games with other players.
            </p>
          )}
        </>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onDone}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy || plan.results.length === 0} onClick={run}>
          Import
        </button>
      </div>
    </section>
  );
}
