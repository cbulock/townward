import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { api, ApiError } from '../save/api';
import { authAtom, type AuthState } from './atoms';

/** Signed-in state for the whole app (docs/specs/saving.md, "Player Experience"). */

/** Ask the server who we are, once at startup. No server means guest mode, saving on this device. */
export function useAuthBootstrap() {
  const [, setAuth] = useAtom(authAtom);
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((user): AuthState => (user ? { status: 'user', user } : { status: 'guest', online: true }))
      .catch((): AuthState => ({ status: 'guest', online: false }))
      .then((state) => {
        if (!cancelled) setAuth(state);
      });
    return () => {
      cancelled = true;
    };
  }, [setAuth]);
}

export interface AuthActions {
  readonly auth: AuthState;
  /** Resolve on success; reject with an ApiError whose message is ready to show. */
  login(email: string, password: string): Promise<void>;
  signup(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export function useAuth(): AuthActions {
  const [auth, setAuth] = useAtom(authAtom);
  const login = useCallback(
    async (email: string, password: string) => setAuth({ status: 'user', user: await api.login(email, password) }),
    [setAuth],
  );
  const signup = useCallback(
    async (email: string, password: string) => setAuth({ status: 'user', user: await api.signup(email, password) }),
    [setAuth],
  );
  const logout = useCallback(async () => {
    await api.logout().catch((err: unknown) => {
      // Already logged out on the server is fine; anything else is worth surfacing.
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
    });
    setAuth({ status: 'guest', online: true });
  }, [setAuth]);
  return { auth, login, signup, logout };
}
