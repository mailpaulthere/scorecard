import { useState } from 'react';
import { DeviceCard } from '../../ui/DeviceCard';
import type { AppData } from '../types';
import { useWhist } from './useWhist';

export function WhistSettings({ d }: { d: AppData }) {
  const w = useWhist(d);
  const [target, setTarget] = useState(w.settings.target);
  const [countAll, setCountAll] = useState(w.settings.countAll);
  const changed = target !== w.settings.target || countAll !== w.settings.countAll;

  return (
    <div className="stack">
      <section className="card">
        <h2>Hands to win a match</h2>
        <p className="muted">Applies to new matches only.</p>
        <div className="stepper">
          <button className="btn" onClick={() => setTarget(Math.max(1, target - 1))} aria-label="Fewer">
            −
          </button>
          <span className="stepper-value">{target}</span>
          <button className="btn" onClick={() => setTarget(Math.min(15, target + 1))} aria-label="More">
            +
          </button>
        </div>
        <h2>Which tricks count</h2>
        <label className={`choice ${!countAll ? 'on' : ''}`}>
          <input type="radio" name="countAll" checked={!countAll} onChange={() => setCountAll(false)} />
          <span>
            <strong>Standard</strong>
            <span className="muted block small">Only the 13 tricks played after the stock runs out. Majority (7+) wins the hand.</span>
          </span>
        </label>
        <label className={`choice ${countAll ? 'on' : ''}`}>
          <input type="radio" name="countAll" checked={countAll} onChange={() => setCountAll(true)} />
          <span>
            <strong>Count all 26 tricks</strong>
            <span className="muted block small">A pagat.com variant. 14+ wins the hand; 13 each is a draw.</span>
          </span>
        </label>
        <button className="btn primary full" disabled={!changed} onClick={() => d.actions.run(() => d.gameStore.setSettings('whist', { target, countAll }))}>
          Save
        </button>
      </section>

      <section className="card">
        <h2>How to play</h2>
        <div className="rule">
          <p>Two players, 52 cards, aces high. Deal 13 each. Turn up the top card of the stock: its suit is trumps for the whole hand. The non-dealer leads.</p>
          <h3>Stage 1: while the stock lasts</h3>
          <p>Follow suit if you can. The winner of each trick takes the face-up stock card, the loser takes the next one face down, and the new top card is turned up. Tricks won now don't count; play to win good cards.</p>
          <h3>Stage 2: stock empty</h3>
          <p>The winner of trick 13 leads, and the last 13 tricks are played out. Whoever takes the majority of these wins the hand.</p>
          <h3>Variation</h3>
          <p>Many people drop the follow-suit rule in stage 1 (only a higher card of the same suit or a trump wins). That doesn't change the scoring.</p>
          <p className="muted small">Rules from pagat.com/whist/german_whist.html. pagat doesn't define a match, so here a match is first to the number of hands above.</p>
        </div>
      </section>

      <DeviceCard auth={d.auth} actions={d.actions} />
    </div>
  );
}
