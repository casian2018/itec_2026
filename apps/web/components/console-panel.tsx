"use client";

import type { ConsoleEntry, RunCodeStatus } from "@/lib/run-code";
import { TerminalSurface } from "./terminal-surface";

type ConsolePanelProps = {
  entries: ConsoleEntry[];
  status: RunCodeStatus;
};

function emptyStateCopyFor(status: RunCodeStatus) {
  if (status === "running") {
    return {
      title: "Execution Started",
      description:
        "The sandbox is live. Output will stream here as soon as the first stdout or stderr chunk arrives.",
      chips: ["Waiting for output", "Streaming live"],
    };
  }

  if (status === "completed") {
    return {
      title: "Run Completed",
      description:
        "The run finished cleanly without producing any visible stdout or stderr output.",
      chips: ["Exit complete", "No console lines"],
    };
  }

  if (status === "error") {
    return {
      title: "Run Failed",
      description:
        "The run ended before any console output could be rendered. Check the status badge and try again.",
      chips: ["Execution error", "Try again"],
    };
  }

  return {
    title: "Console Ready",
    description:
      "Run the current file to stream stdout and stderr here in real time during the demo.",
    chips: ["stdout", "stderr"],
  };
}

function statusClassesFor(status: RunCodeStatus) {
  if (status === "running") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  }

  if (status === "completed") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "error") {
    return "border-rose-400/20 bg-rose-400/10 text-rose-300";
  }

  return "border-[rgba(148,163,184,0.12)] bg-white/[0.04] text-[var(--text-muted)]";
}

function labelForStatus(status: RunCodeStatus) {
  if (status === "running") {
    return "Running";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "error") {
    return "Error";
  }

  return "Idle";
}

export function ConsolePanel({ entries, status }: ConsolePanelProps) {
  const emptyState = emptyStateCopyFor(status);

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--panel-bg)] p-3">
      <div className="mb-3 border-b border-[var(--line)] pb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">
            Console Output
          </h2>
          <span
            className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${statusClassesFor(
              status,
            )}`}
          >
            {labelForStatus(status)}
          </span>
        </div>
        <p className="mt-2 max-w-sm text-[12px] leading-5 text-[var(--text-muted)]">
          Streamed run output for the current editor snapshot appears here.
        </p>
      </div>
      <TerminalSurface
        badgeLabel="Output Stream"
        entries={entries.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          text: entry.text,
        }))}
        emptyState={emptyState}
      />
    </section>
  );
}
