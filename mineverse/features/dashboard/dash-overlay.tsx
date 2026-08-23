'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * A framed panel over the dashboard, for the things a team opens rather than reads.
 *
 * The rulebook has its own book-shaped chrome; this is the plainer shell the
 * marketplace and the traders sit in. It deliberately repeats the rulebook's
 * two hard-won details rather than its looks:
 *
 *  - the card is a fixed height with `min-height: 0` on the scrolling body, so
 *    it cannot resize itself around its content and drift about the screen;
 *  - focus is taken once, on open, with `preventScroll` — taking it on every
 *    parent render is what used to yank the rulebook back to the top.
 */
export function DashOverlay({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dov__backdrop" onClick={onClose} role="presentation">
      <div
        className="dov"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dov__head">
          <div>
            <h2 className="dov__title">{title}</h2>
            {subtitle && <p className="dov__sub">{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" className="dov__close" onClick={onClose} aria-label={`Close ${title}`}>
            <X size={16} />
          </button>
        </header>

        <div className="dov__body">{children}</div>
      </div>
    </div>
  );
}
