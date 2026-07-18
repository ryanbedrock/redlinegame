// Hover/focus explainers used across the game UI. `Tooltip` wraps any element
// and shows a floating box on hover or keyboard focus; `InfoTip` is the small
// circled-"i" trigger for inline concept explanations. Pure CSS visibility —
// no positioning JS — so it stays deterministic and testable.

import type { ReactNode } from 'react';

interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  // Preferred side; falls back gracefully via CSS if space is tight.
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ label, children, side = 'bottom', className }: TooltipProps): JSX.Element {
  return (
    <span className={`tip tip-${side} ${className ?? ''}`}>
      {children}
      <span className="tip-pop" role="tooltip">
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
  return (
    <span className={`tip tip-${side} infotip`}>
      <button
        type="button"
        className="infotip-btn"
        aria-label={term ? `What is ${term}?` : 'More information'}
      >
        i
      </button>
      <span className="tip-pop" role="tooltip">
        {label}
      </span>
    </span>
  );
}
