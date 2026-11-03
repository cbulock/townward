import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import type { HumanProof } from '../shared/api';
import { api, ApiError } from '../save/api';
import { authAtom, authDialogAtom, authNoticeAtom, authProvidersAtom, type AuthState } from './atoms';
import { guestAtom, setChoseGuest } from './screens/landing/guest';

/** Signed-in state for the whole app (docs/specs/saving.md, "Player Experience"). */

/** Ask the server who we are, once at startup. No server means guest mode, saving on this device. */
export function useAuthBootstrap() {
  const [, setAuth] = useAtom(authAtom);
  const [, setProviders] = useAtom(authProvidersAtom);
  const [, setDialog] = useAtom(authDialogAtom);
  const [, setNotice] = useAtom(authNoticeAtom);
  useEffect(() => {
    // Back from a failed GitHub sign-in: show why, and tidy the address bar.
    const url = new URL(location.href);
    const authError = url.searchParams.get('auth_error');
    if (authError) {
      url.searchParams.delete('auth_error');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      setNotice(authError.slice(0, 200));
      setDialog('login');
    }
    let cancelled = false;
    api
      .me()
      .then(({ user, providers }): AuthState => {
        if (!cancelled) setProviders(providers);
        return user ? { status: 'user', user } : { status: 'guest', online: true };
      })
      .catch((): AuthState => ({ status: 'guest', online: false }))
      .then((state) => {
        if (!cancelled) setAuth(state);
      });
    return () => {
      cancelled = true;
    };
  }, [setAuth, setProviders, setDialog, setNotice]);
}

export interface AuthActions {
  readonly auth: AuthState;
  /** Resolve on success; reject with an ApiError whose message is ready to show. */
  login(email: string, password: string): Promise<void>;
  /** 'verify' when the server emailed a code to confirm first (D-084). */
  signup(email: string, password: string, human?: HumanProof): Promise<'done' | 'verify'>;
  /** Finish a sign-up with the emailed code. */
  verifySignup(email: string, code: string): Promise<void>;
  /** Set a new password with the emailed code; signs in. */
  resetPassword(email: string, code: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export function useAuth(): AuthActions {
  const [auth, setAuth] = useAtom(authAtom);
  const [, setGuest] = useAtom(guestAtom);
  const login = useCallback(
    async (email: string, password: string) => setAuth({ status: 'user', user: await api.login(email, password) }),
    [setAuth],
  );
  const signup = useCallback(
    async (email: string, password: string, human?: HumanProof) => {
      const r = await api.signup(email, password, human);
      if (r.kind === 'verify') return 'verify';
      setAuth({ status: 'user', user: r.user });
      return 'done';
    },
    [setAuth],
  );
  const verifySignup = useCallback(
    async (email: string, code: string) => setAuth({ status: 'user', user: await api.verifySignup(email, code) }),
    [setAuth],
  );
  const resetPassword = useCallback(
    async (email: string, code: string, password: string) => setAuth({ status: 'user', user: await api.resetPassword(email, code, password) }),
    [setAuth],
  );
  const logout = useCallback(async () => {
    await api.logout().catch((err: unknown) => {
      // Already logged out on the server is fine; anything else is worth surfacing.
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
    });
    setAuth({ status: 'guest', online: true });
    // Back to the landing page next time the menu shows.
    setChoseGuest(false);
    setGuest(false);
  }, [setAuth, setGuest]);
  return { auth, login, signup, verifySignup, resetPassword, logout };
}
