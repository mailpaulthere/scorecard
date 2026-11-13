import type { AuthApi } from '../data/store';
import type { Actions } from './App';

export function DeviceCard({ auth, actions }: { auth: AuthApi; actions: Actions }) {
  return (
    <>
      <section className="card">
        <h2>This device</h2>
        <p className="muted">Signing out means entering the passcode again on this phone. It signs out of every game.</p>
        <button className="btn" onClick={() => actions.run(() => auth.signOut())}>
          Sign out
        </button>
      </section>
      <p className="muted small center">Times and periods use Brisbane time. Weeks start Monday.</p>
    </>
  );
}
