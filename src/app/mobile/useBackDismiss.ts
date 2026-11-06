import { useEffect } from 'react';

/** Popovers consume Back before the game considers tool cancellation or leaving a city. */
export function useBackDismiss(open: boolean, dismiss: () => void): void {
  useEffect(() => {
    if (!open) return;
    const listener = (event: Event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener('openpolis-dismiss', listener, true);
    return () => window.removeEventListener('openpolis-dismiss', listener, true);
  }, [open, dismiss]);
}
