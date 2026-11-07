import { reignLabel, type ReplayState } from '../logic/replay';
import { GAMES, GAME_NAME, PLAYER_NAME } from '../logic/types';

export function StatusCard({ state }: { state: ReplayState }) {
  const champ = state.champion;
  const run = state.run;
  return (
    <section className="status">
      <div className="champ">
        <span className="champ-crown" aria-hidden>
          👑
        </span>
        {champ ? (
          <div>
            <div className="champ-name">{PLAYER_NAME[champ]}</div>
            <div className="champ-label">
              {reignLabel(state.reign[champ])}
              {state.reign[champ] > 1 && <span className="reign-pill">×{state.reign[champ]}</span>}
            </div>
          </div>
        ) : (
          <div>
            <div className="champ-name muted">No champion yet</div>
            <div className="champ-label muted">Win all three games in a row to take the title</div>
          </div>
        )}
      </div>

      <div className="run">
        <div className="run-title">
          {run ? (
            <>
              <strong>{PLAYER_NAME[run.holder]}</strong>'s run: {run.games.length} of 3
            </>
          ) : (
            <span className="muted">No run in progress</span>
          )}
        </div>
        <div className="badges">
          {GAMES.map((g) => {
            const won = !!run?.games.includes(g);
            return (
              <span key={g} className={`badge ${won ? 'won' : ''}`}>
                {won ? '✓ ' : ''}
                {GAME_NAME[g]}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
