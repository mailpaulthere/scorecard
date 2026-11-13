import { DeviceCard } from '../../ui/DeviceCard';
import type { AppData } from '../types';
import { CATEGORIES, BOX_RULES, HOW_TO_SCORE, LABELS, type JokerMode } from './scoring';
import { updateSettings } from './game';
import { useYahtzee } from './useYahtzee';
import { IMPORT_HELP } from './Import';

export function YahtzeeSettings({ d }: { d: AppData }) {
  const y = useYahtzee(d);
  const setJoker = (joker: JokerMode) =>
    d.actions.run(async () => {
      await d.gameStore.setSettings('yahtzee', { joker });
      if (y.game) await y.change((g) => updateSettings(g, { joker }));
    });

  const choice = (value: JokerMode, label: string, description: string) => (
    <label className={`choice ${y.settings.joker === value ? 'on' : ''}`}>
      <input type="radio" name="joker" checked={y.settings.joker === value} onChange={() => setJoker(value)} />
      <span>
        <strong>{label}</strong>
        <span className="muted block small">{description}</span>
      </span>
    </label>
  );

  return (
    <div className="stack">
      <section className="card">
        <h2>Joker rule</h2>
        <p className="muted">What happens when you throw another Yahtzee. Changes apply to the game in progress too, on both phones.</p>
        {choice('free', 'House rule: free choice', 'Use any open box. Full House and straights score full value (25/30/40).')}
        {choice('forced', 'Official rule', "Must use that number's upper box if open; otherwise any open lower box at full value; otherwise 0 in an upper box.")}
      </section>

      <section className="card">
        <h2>How to score</h2>
        {HOW_TO_SCORE.map(([title, body]) => (
          <div key={title} className="rule">
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
        <dl className="box-rules">
          {CATEGORIES.map((c) => (
            <div key={c}>
              <dt>{LABELS[c]}</dt>
              <dd>{BOX_RULES[c]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card">
        <h2>Games from the old Yahtzee app</h2>
        <p className="muted">{IMPORT_HELP}</p>
      </section>

      <DeviceCard auth={d.auth} actions={d.actions} />
    </div>
  );
}
