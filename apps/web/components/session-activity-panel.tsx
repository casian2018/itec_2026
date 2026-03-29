"use client";

import type { SessionActivityEvent } from "@/lib/socket";

type SessionActivityPanelProps = {
  entries: SessionActivityEvent[];
};

export function SessionActivityPanel({ entries }: SessionActivityPanelProps) {
  if (entries.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center px-4 py-8 text-center">
        <p className="text-[11px] leading-6 text-[var(--text-muted)]">
          Session activity appears here when teammates join, leave, and when you run code.
        </p>
      </div>
    );
  }

  return (
    <ul className="max-h-full space-y-2 overflow-y-auto px-3 py-2 text-[11px]">
      {entries.map((e) => (
        <li
          key={e.id}
          className="rounded border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2.5 py-2"
        >
          <p className="text-[var(--text-primary)]">{e.message}</p>
          <p className="mt-1 font-mono text-[9px] text-[var(--text-muted)]">
            {new Date(e.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
