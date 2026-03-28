"use client";

import { useEffect, useRef } from "react";

export type TerminalSurfaceEntryKind =
  | "command"
  | "stdout"
  | "stderr"
  | "system";

export type TerminalSurfaceEntry = {
  id: string;
  kind: TerminalSurfaceEntryKind;
  text: string;
  meta?: string;
};

type TerminalSurfaceProps = {
  badgeLabel: string;
  badgeTone?: "neutral" | "accent";
  entries: TerminalSurfaceEntry[];
  emptyState: {
    title: string;
    description: string;
    chips: string[];
  };
  footer?: React.ReactNode;
};

function lineClassesFor(kind: TerminalSurfaceEntryKind) {
  if (kind === "command") {
    return "border-l-2 border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-200";
  }

  if (kind === "stderr") {
    return "border-l-2 border-rose-400/30 bg-rose-400/[0.06] text-rose-200";
  }

  if (kind === "stdout") {
    return "border-l-2 border-emerald-400/25 bg-emerald-400/[0.04] text-slate-100";
  }

  return "border-l-2 border-amber-400/25 bg-amber-400/[0.05] text-amber-100";
}

function badgeClassesFor(tone: "neutral" | "accent") {
  if (tone === "accent") {
    return "border-cyan-400/14 bg-cyan-400/10 text-cyan-300";
  }

  return "border-[rgba(148,163,184,0.12)] bg-[var(--bg-panel-soft)] text-[var(--text-muted)]";
}

export function TerminalSurface({
  badgeLabel,
  badgeTone = "neutral",
  entries,
  emptyState,
  footer,
}: TerminalSurfaceProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [entries]);

  return (
    <div className="flex min-h-0 flex-1 flex-col border border-[var(--line)] bg-[var(--terminal-bg)] p-3 font-mono text-sm text-[var(--terminal-text)]">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <span
          className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${badgeClassesFor(
            badgeTone,
          )}`}
        >
          {badgeLabel}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel-soft)] px-4 py-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--terminal-muted)]">
            {emptyState.title}
          </p>
          <p className="mt-3 text-[13px] leading-6 text-[var(--terminal-muted)]">
            {emptyState.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {emptyState.chips.map((chip) => (
              <span
                key={chip}
                className="border border-[var(--line)] bg-[var(--surface-chip)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--terminal-muted)]"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
        >
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className={`px-3 py-2 ${lineClassesFor(entry.kind)}`}
            >
              <p className="break-all whitespace-pre-wrap text-[13px] leading-6">
                {entry.meta ? (
                  <span className="mr-2 text-[var(--terminal-muted)]">{entry.meta}</span>
                ) : (
                  <span className="mr-3 text-[var(--terminal-muted)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                )}
                {entry.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {footer ? <div className="mt-3 border-t border-[var(--line)] pt-3">{footer}</div> : null}
    </div>
  );
}
