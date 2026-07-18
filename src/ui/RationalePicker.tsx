// A compact dropdown that captures the "why" behind a decision. Rationales are
// recorded per decision and audited at debrief (rationale consistency, Phase 2).

import type { RationaleSet } from '../engine/types';

interface RationalePickerProps {
  set: RationaleSet | undefined;
  value: string;
  onChange: (rationaleId: string) => void;
  id: string;
}

export function RationalePicker({ set, value, onChange, id }: RationalePickerProps): JSX.Element | null {
  if (!set) return null;
  return (
    <label className="rationale" htmlFor={id}>
      <span className="rationale-label">Rationale</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {set.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
