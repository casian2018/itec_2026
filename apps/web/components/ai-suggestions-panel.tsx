"use client";

import type { AiBlock } from "@/lib/socket";

type AiSuggestionsPanelProps = {
  blocks: AiBlock[];
  isLoading: boolean;
  errorMessage?: string | null;
  onAccept: (blockId: string) => void;
  onReject: (blockId: string) => void;
};

function statusClassesFor(status: AiBlock["status"]) {
  if (status === "accepted") {
    return "border-emerald-400/15 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "rejected") {
    return "border-rose-400/15 bg-rose-400/10 text-rose-300";
  }

  return "border-amber-400/15 bg-amber-400/10 text-amber-300";
}

function actionButtonClasses(
  tone: "accept" | "reject",
  disabled: boolean,
) {
  if (disabled) {
    return "border-[rgba(148,163,184,0.08)] bg-white/[0.02] text-[var(--text-muted)] opacity-60 cursor-not-allowed";
  }

  if (tone === "accept") {
    return "border-emerald-400/12 bg-emerald-400/8 text-emerald-300 hover:border-emerald-400/24 hover:bg-emerald-400/12";
  }

  return "border-rose-400/12 bg-rose-400/8 text-rose-300 hover:border-rose-400/24 hover:bg-rose-400/12";
}

function formatExplanation(explanation: string) {
  return explanation
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function EmptyState() {
  return (
    <div className="border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel-soft)] p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          No Suggestions Yet
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        Ask Gemini to generate the first review block for this shared file. New
        suggestions will appear here for everyone in the current session.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="border border-[var(--line)] bg-[var(--surface-chip)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]">
          Gemini powered
        </span>
        <span className="border border-[var(--line)] bg-[var(--surface-chip)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]">
          Shared with session
        </span>
      </div>
    </div>
  );
}

export function AiSuggestionsPanel({
  blocks,
  isLoading,
  errorMessage,
  onAccept,
  onReject,
}: AiSuggestionsPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)] p-3">
      <div className="mb-3 border-b border-[var(--line)] pb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">
          AI Suggestions
        </h2>
        <p className="mt-2 max-w-sm text-[12px] leading-5 text-[var(--text-muted)]">
          Gemini generates reviewable code blocks before anything gets inserted into the editor.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {errorMessage ? (
          <div className="border border-rose-400/18 bg-rose-400/10 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-rose-200">
              AI Request Failed
            </p>
            <p className="mt-3 text-sm leading-6 text-rose-100">{errorMessage}</p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="border border-[rgba(82,199,184,0.16)] bg-[var(--accent-soft)] p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                AI Request In Progress
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Reviewing the current editor snapshot and preparing a session-shared
              suggestion block.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="border border-[var(--accent-line)] bg-[var(--surface-chip)] px-2 py-1 font-mono text-[10px] text-[var(--accent)]">
                Reading code
              </span>
              <span className="border border-[var(--accent-line)] bg-[var(--surface-chip)] px-2 py-1 font-mono text-[10px] text-[var(--accent)]">
                Gemini generating
              </span>
            </div>
          </div>
        ) : null}

        {blocks.length === 0 && !isLoading ? <EmptyState /> : null}

        {blocks.map((block) => {
          const isPending = block.status === "pending";

          return (
            <article
              key={block.id}
              className="border border-[var(--line)] bg-[var(--bg-panel)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent)]">
                      AI Generated
                    </span>
                    <span className="border border-[var(--line)] bg-[var(--surface-chip)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      Review Block
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                    Suggestion Block
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    Proposed change with reasoning first, code second.
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${statusClassesFor(
                      block.status,
                    )}`}
                  >
                    {block.status}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {new Date(block.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {block.explanation ? (
                <div className="mt-4 border border-[rgba(82,199,184,0.12)] bg-[var(--accent-soft)] px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                      AI Reasoning
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {formatExplanation(block.explanation).map((sentence) => (
                      <p
                        key={sentence}
                        className="text-sm leading-6 text-[var(--text-secondary)]"
                      >
                        {sentence}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Insert After Line
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                    {block.insertAfterLine}
                  </p>
                </div>

                <div className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Session
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                    {block.roomId}
                  </p>
                </div>
              </div>

              <div className="mt-4 border border-[var(--line)] bg-[var(--editor-inline)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Suggested Code
                  </p>
                  <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Patch
                  </span>
                </div>
                <pre className="mt-3 overflow-x-auto font-mono text-[13px] leading-6 text-[var(--terminal-text)]">
                  <code>{block.code}</code>
                </pre>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isPending}
                  onClick={() => onAccept(block.id)}
                  className={`border px-3 py-2 text-sm font-medium transition ${actionButtonClasses(
                    "accept",
                    !isPending,
                  )}`}
                >
                  {block.status === "accepted" ? "Accepted" : "Accept"}
                </button>
                <button
                  type="button"
                  disabled={!isPending}
                  onClick={() => onReject(block.id)}
                  className={`border px-3 py-2 text-sm font-medium transition ${actionButtonClasses(
                    "reject",
                    !isPending,
                  )}`}
                >
                  {block.status === "rejected" ? "Rejected" : "Reject"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
