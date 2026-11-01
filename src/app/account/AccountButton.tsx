import { useSetAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { authDialogAtom } from '../atoms';
import { useAuth } from '../auth';

interface AccountButtonProps {
  /** Runs before logging out (the game saves first). */
  beforeLogout?: () => Promise<void>;
  /** Compact style for the top bar. */
  compact?: boolean;
}

/** "Log in" for guests; the account's initial with a small menu (email, log out) once signed in. */
export function AccountButton({ beforeLogout, compact = false }: AccountButtonProps) {
  const { auth, logout } = useAuth();
  const openDialog = useSetAtom(authDialogAtom);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  if (auth.status === 'checking') return null;
  if (auth.status === 'guest') {
    return (
      <button
        type="button"
        className={`account-login ${compact ? 'is-compact' : ''}`}
        disabled={!auth.online}
        title={auth.online ? 'Log in to keep your cities in an account' : 'The save server is offline; cities are saved on this device'}
        onClick={() => openDialog('login')}
      >
        {auth.online ? 'Log in' : 'Offline'}
      </button>
    );
  }

  const email = auth.user.email;
  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="account-avatar"
        title={email}
        aria-label={`Account: ${email}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {email[0]?.toUpperCase()}
      </button>
      {open && (
        <div className="panel account-menu" role="menu">
          <span className="account-email">{email}</span>
          <button
            type="button"
            role="menuitem"
            className="account-menu-item"
            onClick={async () => {
              setOpen(false);
              await beforeLogout?.();
              await logout();
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
