// Hover/focus explainers used across the game UI. `Tooltip` wraps any element
// and shows a floating box on hover or keyboard focus; `InfoTip` is the small
// circled-"i" trigger for inline concept explanations. Positioning is pure CSS
// (deterministic/testable); the small amount of JS here is only for keyboard
// accessibility — the trigger is focusable, the popup is linked via
// `aria-describedby`/`role="tooltip"`, and Escape dismisses it (WCAG 2.1.1 /
// 1.4.13).

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

function useDismissible(): {
  dismissed: boolean;
  onKeyDown: (e: KeyboardEvent) => void;
  reset: () => void;
} {
  const [dismissed, setDismissed] = useState(false);
  return {
    dismissed,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dismissed) {
        e.stopPropagation();
        setDismissed(true);
      }
    },
    // Re-arm once focus/hover leaves so the tip can show again next time.
    reset: () => setDismissed(false),
  };
}

interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  // Preferred side; falls back gracefully via CSS if space is tight.
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  // Make the wrapper itself a keyboard focus stop. Use for tooltips whose only
  // child is non-interactive (e.g. a plain <span>); leave false when the child
  // is already focusable (a <button>) to avoid a redundant tab stop.
  focusableTrigger?: boolean;
}

export function Tooltip({
  label,
  children,
  side = 'bottom',
  className,
  focusableTrigger = false,
}: TooltipProps): JSX.Element {
  const id = useId();
  const { dismissed, onKeyDown, reset } = useDismissible();
  return (
    <span
      className={`tip tip-${side} ${dismissed ? 'tip-dismissed' : ''} ${className ?? ''}`}
      tabIndex={focusableTrigger ? 0 : undefined}
      aria-describedby={focusableTrigger ? id : undefined}
      onKeyDown={onKeyDown}
      onBlur={reset}
      onMouseLeave={reset}
    >
      {children}
      <span className="tip-pop" role="tooltip" id={id}>
        {label}
      </span>
    </span>
  );
}

interface InfoTipProps {
  label: ReactNode;
  // Accessible name for screen readers; defaults to a generic phrasing.
  term?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTip({ label, term, side = 'top' }: InfoTipProps): JSX.Element {
  const id = useId();
  const { dismissed, onKeyDown, reset } = useDismissible();
  return (
    <span
      className={`tip tip-${side} infotip ${dismissed ? 'tip-dismissed' : ''}`}
      onBlur={reset}
      onMouseLeave={reset}
    >
      <button
        type="button"
        className="infotip-btn"
        aria-label={term ? `What is ${term}?` : 'More information'}
        aria-describedby={id}
        onKeyDown={onKeyDown}
      >
        i
      </button>
      <span className="tip-pop" role="tooltip" id={id}>
        {label}
      </span>
    </span>
  );
}
