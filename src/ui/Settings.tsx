import { useState } from 'react';
import type { AuthApi, Snapshot, Store } from '../data/store';
import type { Actions } from './App';

export function Settings({ store, auth, snap, actions }: { store: Store; auth: AuthApi; snap: Snapshot; actions: Actions }) {
  const [target, setTarget] = useState(snap.target);
  const changed = target !== snap.target;

  return (
    <div className="stack">
      <section className="card">
        <h2>Hands to win a match</h2>
        <p className="muted">
          Applies to new matches only. Past matches and any match in progress keep the target they started with.
        </p>
        <div className="stepper">
          <button className="btn" onClick={() => setTarget(Math.max(1, target - 1))} aria-label="Fewer">
            −
          </button>
          <span className="stepper-value">{target}</span>
          <button className="btn" onClick={() => setTarget(Math.min(15, target + 1))} aria-label="More">
            +
          </button>
        </div>
        <p className="muted small">First to {target} = best of {target * 2 - 1}.</p>
        <button className="btn primary" disabled={!changed} onClick={() => actions.run(() => store.setTarget(target))}>
          Save
        </button>
      </section>

      <section className="card">
        <h2>This device</h2>
        <p className="muted">Signing out means entering the passcode again on this phone.</p>
        <button className="btn" onClick={() => actions.run(() => auth.signOut())}>
          Sign out
        </button>
      </section>

      <p className="muted small center">Times and periods use Brisbane time. Weeks start Monday.</p>
    </div>
  );
}
