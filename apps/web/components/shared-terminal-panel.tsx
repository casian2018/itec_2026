"use client";

import { useState } from "react";
import type { TerminalEntry } from "@/lib/socket";
import { TerminalSurface } from "./terminal-surface";

type SharedTerminalPanelProps = {
  entries: TerminalEntry[];
  canSubmit: boolean;
  onSubmit: (command: string) => void;
};

const SUGGESTED_COMMANDS = ["help", "status", "participants", "snapshots"];

export function SharedTerminalPanel({
  entries,
  canSubmit,
  onSubmit,
}: SharedTerminalPanelProps) {
  const [command, setCommand] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextCommand = command.trim();

    if (!nextCommand || !canSubmit) {
      return;
    }

    onSubmit(nextCommand);
    setCommand("");
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--panel-bg)] p-3">
      <div className="mb-3 border-b border-[var(--line)] pb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">
            Shared Terminal
          </h2>
          <span className="border border-cyan-400/14 bg-cyan-400/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-300">
            Demo Safe
          </span>
        </div>
        <p className="mt-2 max-w-sm text-[12px] leading-5 text-[var(--text-muted)]">
          Controlled room commands only. Activity is broadcast to everyone in
          the room.
        </p>
      </div>
      <TerminalSurface
        badgeLabel="Room Shell"
        badgeTone="accent"
        entries={entries.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          text: entry.text,
          meta:
            entry.kind === "command" && entry.authorName
              ? entry.authorName
              : undefined,
        }))}
        emptyState={{
          title: "No Terminal Activity Yet",
          description:
            "Try a safe command like help or status to demo shared room activity.",
          chips: ["shared history", "stdout", "stderr"],
        }}
        footer={
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <div className="flex flex-1 items-center border border-[var(--line)] bg-[var(--surface-chip)] px-3">
                <span className="mr-3 font-mono text-[12px] text-[var(--accent)]">$</span>
                <input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="help"
                  disabled={!canSubmit}
                  className="h-11 w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed"
                />
              </div>
              <button
                type="submit"
                disabled={!canSubmit || command.trim().length === 0}
                className="border border-[var(--accent-line)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
              >
                Send
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_COMMANDS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => setCommand(suggestion)}
                  className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </form>
        }
      />
    </section>
  );
}
