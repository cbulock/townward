import { useState, type KeyboardEvent } from 'react';
import { API_LIMITS } from '../../shared/api';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  /** Shown under the field when there's no error. */
  hint?: string;
  /** Green tick when the value is valid (confirm password). */
  valid?: boolean;
}

/** A password input with a show/hide toggle and a Caps Lock warning. */
export function PasswordField({ id, label, value, onChange, onBlur, autoComplete, error, hint, valid }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const readCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'));
  const note = error ?? (caps ? 'Caps Lock is on' : hint);
  return (
    <div className={`auth-field ${error ? 'has-error' : ''} ${valid ? 'is-valid' : ''}`}>
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>
      <div className="auth-input-wrap">
        <input
          id={id}
          className="auth-input"
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          maxLength={API_LIMITS.passwordMax}
          value={value}
          aria-invalid={!!error}
          aria-describedby={note ? `${id}-note` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setCaps(false);
            onBlur?.();
          }}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
        />
        {valid && (
          <svg className="auth-valid" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <button
          type="button"
          className="auth-eye"
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M1.8 10S5 4.2 10 4.2 18.2 10 18.2 10 15 15.8 10 15.8 1.8 10 1.8 10z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {shown && <path d="M3 17L17 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
      {note && (
        <span id={`${id}-note`} className={`auth-note ${error ? 'is-error' : caps ? 'is-warn' : ''}`} role={error ? 'alert' : undefined}>
          {note}
        </span>
      )}
    </div>
  );
}
