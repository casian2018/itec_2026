"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/socket";

type SharedChatPanelProps = {
  messages: ChatMessage[];
  canSend: boolean;
  currentUserId: string;
  onSend: (content: string) => void;
};

function formatMessageTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messageClasses(isCurrentUser: boolean, authorType: ChatMessage["authorType"]) {
  if (authorType === "system") {
    return "border-amber-400/18 bg-amber-400/10 text-amber-100";
  }

  if (isCurrentUser) {
    return "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text-primary)]";
  }

  return "border-[var(--line)] bg-[var(--bg-panel)] text-[var(--text-secondary)]";
}

export function SharedChatPanel({
  messages,
  canSend,
  currentUserId,
  onSend,
}: SharedChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextContent = draft.trim();

    if (!nextContent || !canSend) {
      return;
    }

    onSend(nextContent);
    setDraft("");
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
      <div className="border-b border-[var(--line)] px-3 py-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">
          Shared Session Chat
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">
          Visible to every collaborator in this coding session. Keep room-level decisions and coordination here.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 ? (
          <div className="border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel-soft)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Shared Chat Is Empty
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Start the session conversation here. Everyone in the room will see the same thread.
            </p>
          </div>
        ) : null}

        {messages.map((message) => {
          const isCurrentUser = message.userId === currentUserId;

          return (
            <article
              key={message.id}
              className={`border p-3 ${messageClasses(
                isCurrentUser,
                message.authorType,
              )}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {message.authorName}
                </p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {formatMessageTime(message.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {message.content}
              </p>
            </article>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-[var(--line)] bg-[var(--bg-panel)] p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            disabled={!canSend}
            placeholder="Share context with the session..."
            className="min-h-[72px] flex-1 resize-none border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-line)]"
          />
          <button
            type="submit"
            disabled={!canSend || draft.trim().length === 0}
            className="h-10 border border-[var(--accent-line)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-contrast)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
