'use client';

import { useEffect } from 'react';
import { AlertTriangle, Eye, Maximize, ShieldAlert } from 'lucide-react';
import type { UseProctorResult } from '@/hooks/useProctor';

interface ProctorOverlayProps {
  proctor: UseProctorResult;
  themeClass?: string;
}

/** How long a transient warning stays up. */
const TOAST_MS = 3_200;

export function ProctorOverlay({ proctor, themeClass }: ProctorOverlayProps) {
  const { warning, dismissWarning, needsFullscreen, warnings, keyViolations, rules, flagged } = proctor;

  // The fullscreen warning is not transient — it stays until they come back,
  // because the scrim behind it is what actually blocks the round.
  const sticky = warning?.kind === 'fullscreen_exit' && needsFullscreen;

  useEffect(() => {
    if (!warning || sticky) return;
    const timer = window.setTimeout(dismissWarning, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [warning, sticky, dismissWarning]);

  const overBudget = warnings >= rules.warningBudget || keyViolations >= rules.keyViolationBudget;

  return (
    <div className={themeClass}>
      {needsFullscreen && rules.enforceFullscreen && (
        <div className="pscrim" role="alertdialog" aria-modal="true" aria-labelledby="pscrim-title">
          <div className="pscrim__card">
            <ShieldAlert size={30} aria-hidden="true" style={{ color: 'var(--rd-bad, #e05b4b)' }} />
            <h2 id="pscrim-title">Return to fullscreen</h2>
            <p>
              The round is paused while this window is not fullscreen. Your answers are
              saved — nothing has been submitted.
            </p>
            <p className="pscrim__count">
              Tab / fullscreen warnings: {warnings} of {rules.warningBudget}
            </p>
            <button type="button" className="pgate__btn" onClick={() => void proctor.restoreFullscreen()}>
              <Maximize size={14} aria-hidden="true" />
              Go fullscreen
            </button>
          </div>
        </div>
      )}

      {warning && !sticky && (
        <div className="ptoast" role="status" aria-live="polite">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{warning.message}</span>
          <span className="ptoast__count">
            {warning.kind === 'tab_hidden' || warning.kind === 'fullscreen_exit'
              ? `${warnings}/${rules.warningBudget}`
              : `${keyViolations}/${rules.keyViolationBudget}`}
          </span>
        </div>
      )}

      {/* Steady reminder that the round is monitored. Turns red once a budget is
          spent, which is the point a team should go talk to an organizer. */}
      <div className={`pbadge ${overBudget || flagged ? 'pbadge--hot' : ''}`}>
        <Eye size={12} aria-hidden="true" />
        <span>
          {warnings}/{rules.warningBudget} · {keyViolations}/{rules.keyViolationBudget}
        </span>
      </div>
    </div>
  );
}
