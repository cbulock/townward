import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_HUD_PREFERENCES,
  HUD_ITEMS,
  moveHudStat,
  type HudPreferences,
  type HudRow,
} from './hudPreferences';

interface HudCustomizeProps {
  readonly selected: HudPreferences;
  readonly onApply: (selected: HudPreferences) => void;
  readonly onCancel: () => void;
}

export function HudCustomize({ selected, onApply, onCancel }: HudCustomizeProps) {
  const [draft, setDraft] = useState(selected);
  const [row, setRow] = useState<HudRow>('second');
  const other: HudRow = row === 'first' ? 'second' : 'first';
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div className="phone-customize">
      <h3 ref={heading} tabIndex={-1}>
        Customize your top bars
      </h3>
      <div className="phone-control-group" role="group" aria-label="Customize row">
        <button type="button" aria-pressed={row === 'first'} onClick={() => setRow('first')}>
          First row
        </button>
        <button type="button" aria-pressed={row === 'second'} onClick={() => setRow('second')}>
          Second row
        </button>
      </div>
      <p id="hud-choice-help">
        {draft[row].length} selected. Choose as many as you like. Selecting an item moves it to this
        row. Swipe a bar if its items don’t all fit.
      </p>
      <div className="phone-stat-choices">
        {HUD_ITEMS.map(([id, label]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={draft[row].includes(id)}
              aria-describedby="hud-choice-help"
              onChange={(event) =>
                setDraft(
                  event.target.checked
                    ? {
                        ...draft,
                        [row]: [...draft[row], id],
                        [other]: draft[other].filter((item) => item !== id),
                      }
                    : { ...draft, [row]: draft[row].filter((item) => item !== id) },
                )
              }
            />
            {label}
          </label>
        ))}
      </div>
      <h4>Display order</h4>
      <ol className="phone-stat-order">
        {draft[row].map((id, index) => {
          const label = HUD_ITEMS.find(([key]) => key === id)?.[1];
          return (
            <li key={id}>
              <span>{label}</span>
              <button
                type="button"
                aria-label={`Move ${label} left`}
                disabled={index === 0}
                onClick={() => setDraft({ ...draft, [row]: moveHudStat(draft[row], index, -1) })}
              >
                ←
              </button>
              <button
                type="button"
                aria-label={`Move ${label} right`}
                disabled={index === draft[row].length - 1}
                onClick={() => setDraft({ ...draft, [row]: moveHudStat(draft[row], index, 1) })}
              >
                →
              </button>
            </li>
          );
        })}
      </ol>
      <div className="phone-editor-actions">
        <button type="button" onClick={() => setDraft(DEFAULT_HUD_PREFERENCES)}>
          Reset to defaults
        </button>
        <button type="button" aria-label="Cancel customization" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary-button" onClick={() => onApply(draft)}>
          Apply
        </button>
      </div>
    </div>
  );
}
