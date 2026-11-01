import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_LIMITS } from '../../shared/api';
import { authDialogAtom } from '../atoms';
import { useAuth } from '../auth';

/** Log in / sign up, as a modal over either screen. */
export function AuthDialog() {
  const [mode, setMode] = useAtom(authDialogAtom);
  const { login, signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  /** Leaving the dialog or switching modes starts with a clean slate. */
  const switchTo = useCallback(
    (next: 'login' | 'signup' | null) => {
      setError(null);
      setMode(next);
    },
    [setMode],
  );
  const close = useCallback(() => switchTo(null), [switchTo]);

  useEffect(() => {
    if (!mode) return;
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, close]);

  if (!mode) return null;
  const isSignup = mode === 'signup';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await (isSignup ? signup : login)(email, password);
      setPassword('');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <form
        className="panel auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 id="auth-title">{isSignup ? 'Create your account' : 'Welcome back, mayor'}</h2>
        <p className="auth-lead">
          {isSignup ? 'Keep your cities safe and play them from any browser.' : 'Log in to open the cities in your account.'}
        </p>
        <label className="ng-field">
          <span className="ng-field-label">Email</span>
          <input
            ref={emailRef}
            className="ng-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="ng-field">
          <span className="ng-field-label">Password</span>
          <input
            className="ng-input"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={isSignup ? API_LIMITS.passwordMin : undefined}
            maxLength={API_LIMITS.passwordMax}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isSignup && <span className="auth-hint">At least {API_LIMITS.passwordMin} characters</span>}
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="ng-start" disabled={busy}>
          {busy ? 'One moment…' : isSignup ? 'Sign up' : 'Log in'}
        </button>
        <p className="auth-switch">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" className="link-button" onClick={() => switchTo(isSignup ? 'login' : 'signup')}>
            {isSignup ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </form>
    </div>
  );
}
