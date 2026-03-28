"use client";

import type { AiBlock } from "@/lib/socket";

type AiSuggestionsPanelProps = {
  blocks: AiBlock[];
  isLoading: boolean;
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-[rgba(148,163,184,0.1)] bg-white/[0.03] p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        No Suggestions Yet
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
        Use Ask AI to create mocked code suggestion blocks for the current room.
      </p>
    </div>
  );
}

export function AiSuggestionsPanel({
  blocks,
  isLoading,
  onAccept,
  onReject,
}: AiSuggestionsPanelProps) {
  return (
    <section className="flex min-h-0 flex-col rounded-[26px] border border-[var(--line)] bg-[var(--bg-panel)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_18px_44px_rgba(0,0,0,0.22)] lg:p-5">
      <div className="mb-4 border-b border-[rgba(148,163,184,0.08)] pb-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.24em] text-white/92">
          AI Suggestions
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
          Mocked AI blocks for review before any editor insertion happens.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="rounded-2xl border border-[rgba(82,199,184,0.14)] bg-[rgba(82,199,184,0.06)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
              AI Request In Progress
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Preparing a mocked block suggestion for everyone in the room.
            </p>
          </div>
        ) : null}

        {blocks.length === 0 && !isLoading ? <EmptyState /> : null}

        {blocks.map((block) => {
          const isPending = block.status === "pending";

          return (
            <article
              key={block.id}
              className="rounded-2xl border border-[rgba(148,163,184,0.1)] bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">
                    Suggestion Block
                  </h3>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] ${statusClassesFor(
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
                <div className="mt-4 rounded-2xl border border-[rgba(82,199,184,0.12)] bg-[rgba(82,199,184,0.05)] px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                    Why AI Suggests This
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {block.explanation}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[rgba(148,163,184,0.1)] bg-black/20 px-3 py-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Insert After Line
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                    {block.insertAfterLine}
                  </p>
                </div>

                <div className="rounded-xl border border-[rgba(148,163,184,0.1)] bg-black/20 px-3 py-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Room
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                    {block.roomId}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-[rgba(148,163,184,0.1)] bg-[#0a1220] p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Suggested Code
                </p>
                <pre className="mt-3 overflow-x-auto font-mono text-[13px] leading-6 text-slate-200">
                  <code>{block.code}</code>
                </pre>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isPending}
                  onClick={() => onAccept(block.id)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${actionButtonClasses(
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
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${actionButtonClasses(
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
