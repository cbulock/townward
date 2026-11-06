import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { inboxAtom } from '../atoms';
import { useBackDismiss } from '../mobile/useBackDismiss';

/**
 * The alerts inbox (top bar bell): notices worth keeping (problems, milestones, the month's
 * budget) stay here after their toast fades, until the game resolves them (taxes collected,
 * power back, materials arriving …) or the player dismisses them. Opening it marks them read.
 */
interface AlertsButtonProps {
  onOpen?: () => void;
  portalToGame?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export function AlertsButton({
  onOpen,
  open: controlledOpen,
  onOpenChange,
  portalToGame = false,
}: AlertsButtonProps = {}) {
  const [alerts, setAlerts] = useAtom(inboxAtom);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  useBackDismiss(open, () => setOpen(false));
  const wrap = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);
  const unread = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (
        e.target instanceof Node &&
        !wrap.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      )
        setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open, setOpen]);

  const toggle = () => {
    if (!open) onOpen?.();
    setOpen(!open);
    // Seen once the list is open.
    setAlerts((list) =>
      list.some((a) => !a.read) ? list.map((a) => ({ ...a, read: true })) : list,
    );
  };
  const dismiss = (key: string) => setAlerts((list) => list.filter((a) => a.key !== key));

  const menu = open ? (
    <span
      ref={menuRef}
      className={`panel alerts-menu ${portalToGame ? 'phone-alerts-menu' : ''}`}
      role="dialog"
      aria-label="Alerts"
    >
      <span className="alerts-head">
        <strong>Alerts</strong>
        {alerts.length > 0 && (
          <button type="button" className="alerts-clear" onClick={() => setAlerts([])}>
            Clear all
          </button>
        )}
      </span>
      {alerts.length === 0 ? (
        <span className="alerts-empty">
          All clear. Problems and milestones will wait here until they're dealt with.
        </span>
      ) : (
        <ul className="alerts-list">
          {alerts.map((a) => (
            <li key={a.key} className={`alert-item alert-${a.kind}`}>
              <i aria-hidden="true" />
              <span className="alert-body">
                <span className="alert-text">{a.message}</span>
                <span className="alert-date">{a.date}</span>
              </span>
              <button
                type="button"
                className="alert-dismiss"
                aria-label="Dismiss"
                onClick={() => dismiss(a.key)}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  ) : null;

  return (
    <span className="alerts-wrap" ref={wrap}>
      <button
        type="button"
        className={`icon-button alerts-button ${open ? 'is-open' : ''}`}
        title={unread > 0 ? `${unread} new alert${unread === 1 ? '' : 's'}` : 'Alerts'}
        aria-label={unread > 0 ? `Alerts, ${unread} new` : 'Alerts'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path
            d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 && <span className="alerts-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {portalToGame && menu
        ? createPortal(menu, document.querySelector('.game-screen') ?? document.body)
        : menu}
    </span>
  );
}
