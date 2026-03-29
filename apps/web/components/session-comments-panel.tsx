"use client";

import { useState } from "react";
import type { SessionComment } from "@/lib/socket";

type SessionCommentsPanelProps = {
  comments: SessionComment[];
  activeFileId: string | null;
  activeFilePath: string | null;
  canSend: boolean;
  onAddComment: (body: string, lineNumber: number) => void;
};

export function SessionCommentsPanel({
  comments,
  activeFileId,
  activeFilePath,
  canSend,
  onAddComment,
}: SessionCommentsPanelProps) {
  const [body, setBody] = useState("");
  const [lineNumber, setLineNumber] = useState(1);

  const filtered = activeFileId
    ? comments.filter((c) => c.fileId === activeFileId)
    : comments;

  function submit() {
    const t = body.trim();
    if (!t || !canSend) return;
    onAddComment(t, Math.max(0, lineNumber));
    setBody("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      <div className="flex-shrink-0 rounded border border-[var(--line)] bg-[var(--bg-panel-soft)] p-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          New comment
        </p>
        {activeFilePath ? (
          <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-secondary)]">
            {activeFilePath}
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-[#e8a23a]">Open a file to attach comments.</p>
        )}
        <label className="mt-2 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
          Line
          <input
            type="number"
            min={0}
            value={lineNumber}
            onChange={(e) => setLineNumber(Number(e.target.value) || 0)}
            className="w-16 rounded border border-[var(--line)] bg-[var(--bg-panel)] px-1 py-0.5 font-mono text-[var(--text-primary)]"
          />
          <span className="text-[9px]">0 = whole file</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note for your team…"
          rows={3}
          disabled={!canSend || !activeFileId}
          className="mt-2 w-full resize-none rounded border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1.5 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!canSend || !activeFileId || !body.trim()}
          onClick={submit}
          className="mt-2 w-full rounded border border-[rgba(78,205,196,0.35)] bg-[rgba(78,205,196,0.08)] py-1.5 text-[11px] text-[#4ecdc4] transition hover:bg-[rgba(78,205,196,0.14)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Post comment
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-1 py-4 text-center text-[11px] text-[var(--text-muted)]">
            No comments yet for {activeFileId ? "this file" : "this workspace"}.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="rounded border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-2"
              >
                <p className="text-[11px] text-[var(--text-primary)]">{c.body}</p>
                <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                  {c.authorName}
                  {c.lineNumber > 0 ? ` · line ${c.lineNumber}` : ""} ·{" "}
                  {new Date(c.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
