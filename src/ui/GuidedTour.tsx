// Interactive, spotlighted walkthrough of the command screen. Steps anchor to
// elements tagged with `data-tour="..."`; each renders a dimming backdrop with
// a cutout around the target and an explanatory card. Purely presentational —
// it reads no engine state and mutates nothing but the store's `tourOpen` flag.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface TourStep {
  // data-tour anchor; omit for a centered, target-less step.
  target?: string;
  title: string;
  body: string[];
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome, Commander',
    body: [
      'You direct national security for a fictional state facing a rising Rival across contested maritime claims. Each turn is a fiscal quarter.',
      'Your objective: deter aggression without provoking the war you are trying to prevent — while reading an adversary whose true nature is hidden.',
      'Win: survive every quarter with your claim intact (Deterrence Hold). Lose: your Status Quo hits 0 (Capitulation), or the Rival judges aggression worthwhile and goes to War.',
    ],
  },
  {
    target: 'clock',
    title: 'The quarter clock',
    body: [
      'Each campaign runs a fixed number of quarters. Deterrence is a marathon: early credibility shapes how the Rival tests you later.',
    ],
  },
  {
    target: 'resources',
    title: 'Your resources',
    body: [
      'Budget funds signals and investments; Political Capital funds costly, credibility-building moves. Spend both deliberately — over-arming has its own costs.',
    ],
  },
  {
    target: 'statusquo',
    title: 'Status Quo — your win/lose bar',
    body: [
      'This is effective control of your claimed maritime space, starting at 100. Conceding probes erodes it; reaching 0 is Capitulation. Holding it is how you win.',
    ],
  },
  {
    target: 'tracks',
    title: 'Force posture',
    body: [
      'Four tracks: Denial (make a grab fail), Punishment (threaten costly retaliation), Intelligence (sharpen your reads), and Readiness (build faster). Hover any track for detail.',
    ],
  },
  {
    target: 'intel',
    title: 'Read your intelligence',
    body: [
      'These noisy estimates are your window into the hidden Rival. Confidence (LOW/MODERATE/HIGH) reflects your collection — raise Intelligence or task collection to sharpen them.',
    ],
  },
  {
    target: 'incoming',
    title: 'The incoming probe',
    body: [
      'Each quarter the Rival stages a provocation. Your response — from Concede up to Escalate — signals your resolve. Backing down repeatedly invites salami-slicing.',
    ],
  },
  {
    target: 'nav-inbox',
    title: 'Inbox',
    body: [
      'Correspondence from your cabinet and the Rival. Most is context, but some messages carry real choices — like tasking extra intelligence collection.',
    ],
  },
  {
    target: 'nav-assessment',
    title: 'Assessment',
    body: [
      'Log your read of the Rival\u2019s hidden type as evidence accumulates. Your calibration is scored at the debrief, alongside counterfactuals of how other doctrines would have fared.',
    ],
  },
  {
    title: 'You have the watch',
    body: [
      'Work through each quarter: read intelligence, answer the probe, issue orders, then resolve. Hover any circled "i" or menu item for a reminder.',
      'Reopen this walkthrough anytime with the "?" button. Good luck holding the line.',
    ],
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

export function GuidedTour(): JSX.Element | null {
  const tourOpen = useGameStore((s) => s.tourOpen);
  const endTour = useGameStore((s) => s.endTour);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const steps = STEPS;
  const step = steps[i];
  const last = i === steps.length - 1;

  const measure = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!tourOpen) return;
    measure();
  }, [tourOpen, i, measure]);

  useEffect(() => {
    if (!tourOpen) return;
    const onResize = (): void => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [tourOpen, measure]);

  const next = useCallback(() => {
    if (last) endTour();
    else setI((v) => Math.min(v + 1, steps.length - 1));
  }, [last, endTour, steps.length]);

  const prev = useCallback(() => setI((v) => Math.max(v - 1, 0)), []);

  // Move focus into the dialog on open and on each step change so screen
  // readers announce the new step (4.1.3) and keyboard focus never strands on
  // an unmounted control. Before the first focus move we record the opener so
  // it can be restored on close — captured here (a layout effect, before focus
  // leaves the opener) rather than in a passive effect, which would run after
  // this and capture the card itself.
  useLayoutEffect(() => {
    if (!tourOpen) return;
    if (returnFocusRef.current === null) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    }
    cardRef.current?.focus();
  }, [tourOpen, i]);

  // On close, restore focus to the opener (WCAG 2.4.3) and reset for next time.
  // When the tour auto-opened on a new game the opener (a menu button) has
  // already unmounted, so `document.activeElement` was `<body>`; fall back to
  // the stage container so keyboard/screen-reader users land on the game
  // content instead of the top of the page.
  useEffect(() => {
    if (tourOpen) return;
    setI(0);
    const opener = returnFocusRef.current;
    returnFocusRef.current = null;
    if (opener && opener !== document.body && opener.isConnected) {
      opener.focus();
    } else {
      document.querySelector<HTMLElement>('.stage')?.focus();
    }
  }, [tourOpen]);

  useEffect(() => {
    if (!tourOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        endTour();
        return;
      }
      if (e.key === 'ArrowRight') {
        next();
        return;
      }
      if (e.key === 'ArrowLeft') {
        prev();
        return;
      }
      if (e.key !== 'Tab') return;
      // Trap Tab within the card so the dimmed background stays unreachable.
      const card = cardRef.current;
      if (!card) return;
      const focusables = Array.from(
        card.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === card)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourOpen, endTour, next, prev]);

  if (!tourOpen || !step) return null;

  const spotlight: Rect | null = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Place the card below the target when there's room, otherwise above; a
  // target-less step centers the card.
  const cardStyle: React.CSSProperties = (() => {
    if (!spotlight) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    const belowRoom = window.innerHeight - (spotlight.top + spotlight.height);
    const cardMaxW = 360;
    const left = Math.min(
      Math.max(12, spotlight.left),
      Math.max(12, window.innerWidth - cardMaxW - 12),
    );
    if (belowRoom > 220) {
      return { top: spotlight.top + spotlight.height + 12, left };
    }
    return { top: Math.max(12, spotlight.top - 12), left, transform: 'translateY(-100%)' };
  })();

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="tour-backdrop" onClick={endTour} />
      {spotlight && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}
      <div className="tour-card panel" style={cardStyle} ref={cardRef} tabIndex={-1}>
        <div className="tour-step-count" aria-hidden="true">
          {i + 1} / {steps.length}
        </div>
        <h3 id={titleId}>{step.title}</h3>
        {step.body.map((p, k) => (
          <p key={k}>{p}</p>
        ))}
        <div className="tour-actions">
          <button type="button" className="ghost" onClick={endTour}>
            Skip
          </button>
          <div className="tour-nav-btns">
            {i > 0 && (
              <button type="button" className="ghost" onClick={prev}>
                ← Back
              </button>
            )}
            <button type="button" className="primary" onClick={next}>
              {last ? 'Start playing' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
