import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile bot check (D-084). Usually invisible: it passes by itself and hands us a
 * one-use token for the server to confirm. Remount it (change its `key`) after each submit for a
 * fresh token. Only shown when the server has a site key.
 */

interface TurnstileOptions {
  readonly sitekey: string;
  readonly callback: (token: string) => void;
  readonly 'expired-callback'?: () => void;
  readonly 'error-callback'?: () => void;
  readonly theme?: 'auto' | 'light' | 'dark';
  readonly size?: 'normal' | 'flexible' | 'compact';
  readonly appearance?: 'always' | 'execute' | 'interaction-only';
}

interface TurnstileApi {
  render(el: HTMLElement, options: TurnstileOptions): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')));
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the bot check"));
    };
    document.head.append(s);
  });
  return loading;
}

interface TurnstileProps {
  readonly siteKey: string;
  /** A fresh token, or null when it expired or failed. */
  readonly onToken: (token: string | null) => void;
}

export function Turnstile({ siteKey, onToken }: TurnstileProps) {
  const box = useRef<HTMLDivElement>(null);
  // The latest callback, without re-rendering the widget when the parent re-renders.
  const report = useRef(onToken);
  useEffect(() => {
    report.current = onToken;
  });

  useEffect(() => {
    let widget: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !box.current) return;
        widget = ts.render(box.current, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'flexible',
          // Only takes space when Cloudflare wants the player to click.
          appearance: 'interaction-only',
          callback: (token) => report.current(token),
          'expired-callback': () => report.current(null),
          'error-callback': () => report.current(null),
        });
      })
      .catch(() => report.current(null));
    return () => {
      cancelled = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey]);

  return <div ref={box} className="auth-turnstile" />;
}

/** A field people never see or fill in; bots that fill every input give themselves away. */
export function Honeypot({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <div className="auth-hp" aria-hidden="true">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}
