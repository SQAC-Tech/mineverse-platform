'use client';

import type { ReactNode, ButtonHTMLAttributes } from 'react';

/**
 * Shared primitives for the Nether-themed admin panel. Styling lives in
 * `app/admin/nether.css`, scoped under `.nether`.
 */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`n-panel ${className}`}>
      {(title || actions) && (
        <div className="n-panel-head">
          <div>
            {title && <div className="n-panel-title">{title}</div>}
            {subtitle && <div className="n-panel-sub">{subtitle}</div>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      )}
      <div className="n-panel-body">{children}</div>
    </section>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Btn({
  variant = 'secondary',
  small,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; small?: boolean }) {
  return (
    <button
      type="button"
      className={`n-btn n-btn-${variant} ${small ? 'n-btn-sm' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="n-panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div className="n-stat-label">{label}</div>
        {icon}
      </div>
      <div className="n-stat-value" style={{ marginTop: 8 }}>{value}</div>
      {hint && <div className="n-panel-sub" style={{ marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

export type PillTone = 'live' | 'ok' | 'warn' | 'danger' | 'idle';

export function Pill({ tone = 'idle', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`n-pill n-pill-${tone}`}>{children}</span>;
}

/** Maps the round/match/run vocabularies onto a consistent pill tone. */
export function statusTone(status?: string | null): PillTone {
  switch (status) {
    case 'active':
    case 'live':
    case 'running':
      return 'live';
    case 'completed':
    case 'resolved':
    case 'verified':
    case 'graded':
      return 'ok';
    case 'queued':
    case 'draft':
    case 'pending':
    case 'manual_review':
      return 'warn';
    case 'failed':
    case 'cancelled':
    case 'voided':
    case 'expired':
      return 'danger';
    default:
      return 'idle';
  }
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span className="n-label">{label}</span>
      {children}
      {hint && <span className="n-panel-sub" style={{ display: 'block', marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="n-table-wrap">
      <table className="n-table">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan}>
          <div className="n-empty">{children}</div>
        </td>
      </tr>
    );
  }
  return <div className="n-empty">{children}</div>;
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 28, justifyContent: 'center' }}>
      <div className="n-portal-spinner" />
      <span className="n-panel-sub">{label}…</span>
    </div>
  );
}

export function LavaDivider() {
  return <hr className="n-lava-divider" />;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 650,
              letterSpacing: 0.4,
              color: 'var(--text-onDark)',
            }}
          >
            {title}
          </h2>
          {subtitle && <p className="n-panel-sub" style={{ marginTop: 4 }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
      <div style={{ marginTop: 12 }}><LavaDivider /></div>
    </div>
  );
}

export function Grid({ min = 200, gap = 12, children }: { min?: number; gap?: number; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap }}>
      {children}
    </div>
  );
}

/** Shared fetch wrapper: unwraps the { success, data, error } envelope. */
export async function apiCall<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
    });
    const json = await res.json();
    if (!res.ok || json.success === false) {
      const message =
        json?.error?.message ?? json?.error?.code ?? json?.error ?? `Request failed (${res.status})`;
      return { ok: false, message: String(message) };
    }
    return { ok: true, data: (json.data ?? json) as T };
  } catch {
    return { ok: false, message: 'Network error' };
  }
}

export function uuid() {
  return crypto.randomUUID();
}
