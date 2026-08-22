'use client';

import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ClipboardX, Eye, Keyboard, Maximize, MonitorX, ShieldCheck,
} from 'lucide-react';
import type { UseProctorResult } from '@/hooks/useProctor';

interface ProctorGateProps {
  proctor: UseProctorResult;
  roundId: number;
  roundName?: string;
  eyebrow?: string;
  themeClass?: string;
}

/**
 * The rules screen a team passes through on the way into a round.
 *
 * Everything enforced is stated here first. A participant who is surprised by a
 * warning mid-round is a support ticket, and an accusation nobody warned them
 * about is not one worth making.
 */
export function ProctorGate({ proctor, roundId, roundName, eyebrow, themeClass }: ProctorGateProps) {
  const router = useRouter();
  const { rules } = proctor;

  return (
    <div className={`round-ui pgate ${themeClass ?? ''}`}>
      <div className="pgate__card">
        <p className="pgate__eyebrow">
          <ShieldCheck size={13} aria-hidden="true" />
          {eyebrow ?? `Round ${roundId}`} · Monitored
        </p>

        <h1 className="pgate__title">{roundName ?? `Round ${roundId}`}</h1>

        <p className="pgate__lede">
          This round is watched by the platform. Read what that means, then start when
          your team is ready — the round timer is already running.
        </p>

        <ul className="pgate__rules">
          {rules.enforceFullscreen && (
            <li className="pgate__rule pgate__rule--strict">
              <Maximize size={16} aria-hidden="true" />
              <div>
                <b>Fullscreen is required</b>
                <span>Leaving fullscreen pauses the round behind a warning until you return.</span>
              </div>
            </li>
          )}

          <li className="pgate__rule pgate__rule--strict">
            <MonitorX size={16} aria-hidden="true" />
            <div>
              <b>Stay on this tab</b>
              <span>Switching tabs or windows is recorded.</span>
            </div>
          </li>

          {rules.blockClipboard && (
            <li className="pgate__rule pgate__rule--strict">
              <ClipboardX size={16} aria-hidden="true" />
              <div>
                <b>No copy, paste or right-click</b>
                <span>Type your answers. Clipboard actions are blocked and recorded.</span>
              </div>
            </li>
          )}

          <li className="pgate__rule pgate__rule--strict">
            <Keyboard size={16} aria-hidden="true" />
            <div>
              <b>Some shortcuts are blocked</b>
              <span>
                Escape, Alt combinations, function keys and developer tools. Reload still
                works if something breaks, and your saved answers survive it.
              </span>
            </div>
          </li>

          <li className="pgate__rule">
            <Eye size={16} aria-hidden="true" />
            <div>
              <b>Nothing is auto-submitted</b>
              <span>
                Going over the limits raises a flag for the organizers to look at. It never
                ends your round on its own.
              </span>
            </div>
          </li>
        </ul>

        <div className="pgate__budget">
          <span className="pgate__chip">
            Tab / fullscreen limit <b>{rules.warningBudget}</b>
          </span>
          <span className="pgate__chip">
            Blocked-action limit <b>{rules.keyViolationBudget}</b>
          </span>
        </div>

        {proctor.startError && (
          <p className="pgate__error">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{proctor.startError}</span>
          </p>
        )}

        <div className="pgate__actions">
          <button
            type="button"
            className="pgate__btn"
            onClick={() => void proctor.start()}
            disabled={proctor.starting}
          >
            {proctor.starting ? 'Starting…' : 'Start the round'}
          </button>
          <button
            type="button"
            className="pgate__btn pgate__btn--quiet"
            onClick={() => router.push('/')}
            disabled={proctor.starting}
          >
            Back to home
          </button>
        </div>

        <p className="pgate__foot">
          Each device your team uses is tracked separately, so working in parallel is fine.
          If a rule misfires, tell an organizer — every event is logged with a timestamp and
          can be reviewed.
        </p>
      </div>
    </div>
  );
}
