import { useState } from 'react';
import type { AuthApi } from '../data/store';

export function Login({ auth }: { auth: AuthApi }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await auth.signIn(code);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(
        /too-many-requests/.test(msg)
          ? 'Too many attempts. Wait a few minutes and try again.'
          : /network/.test(msg)
            ? 'No connection. Check your internet and try again.'
            : /auth\//.test(msg)
              ? 'That passcode is not right.'
              : msg,
      );
      setBusy(false);
    }
  };

  return (
    <form className="login" onSubmit={submit}>
      <div className="login-crown">👑</div>
      <h1>Champion of Champions</h1>
      <p className="muted">Enter the passcode. This device will be remembered.</p>
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Passcode"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoFocus
      />
      {err && <p className="error">{err}</p>}
      <button className="btn primary big" disabled={busy || !code}>
        {busy ? 'Checking…' : 'Enter'}
      </button>
    </form>
  );
}
