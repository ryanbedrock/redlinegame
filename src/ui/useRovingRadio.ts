// Keyboard behavior for ARIA `role="radiogroup"` built from buttons. The APG
// pattern requires a single tab stop for the whole group (roving tabindex) with
// arrow keys moving between and selecting options. Our radios are styled
// <button>s, so Tab alone leaves every one focusable and arrow keys do nothing;
// this hook supplies the missing semantics (§2.5).

import { useCallback, useRef, type KeyboardEvent } from 'react';

export interface RovingRadioProps {
  ref: (el: HTMLButtonElement | null) => void;
  tabIndex: 0 | -1;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

// `selectedIndex` < 0 means nothing is chosen yet; the first option becomes the
// group's tab stop so it is reachable, matching the APG "no selection" case.
export function useRovingRadio(
  count: number,
  selectedIndex: number,
  onSelect: (index: number) => void,
): (index: number) => RovingRadioProps {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = useCallback(
    (to: number) => {
      if (count === 0) return;
      const idx = ((to % count) + count) % count;
      refs.current[idx]?.focus();
      onSelect(idx);
    },
    [count, onSelect],
  );

  return useCallback(
    (index: number): RovingRadioProps => ({
      ref: (el) => {
        refs.current[index] = el;
      },
      tabIndex: (selectedIndex < 0 ? index === 0 : index === selectedIndex) ? 0 : -1,
      onKeyDown: (e) => {
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault();
            move(index + 1);
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault();
            move(index - 1);
            break;
          case 'Home':
            e.preventDefault();
            move(0);
            break;
          case 'End':
            e.preventDefault();
            move(count - 1);
            break;
          default:
            break;
        }
      },
    }),
    [count, selectedIndex, move],
  );
}
