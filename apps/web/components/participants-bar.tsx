"use client";

import type { Participant } from "@/lib/socket";

type ParticipantsBarProps = {
  participants: Participant[];
  currentUserName: string;
  currentUserSocketId?: string | null;
};

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ParticipantsBar({
  participants,
  currentUserName,
  currentUserSocketId,
}: ParticipantsBarProps) {
  const isSoloRoom = participants.length <= 1;

  return (
    <section className="border-b border-[var(--line)] bg-[var(--titlebar-bg)] px-4 py-3 backdrop-blur-xl">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Team Presence
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {isSoloRoom
              ? "Only your client is connected to this workspace."
              : "Connected collaborators currently inside this shared session."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {participants.map((participant) => {
            const isCurrentUser =
              participant.socketId === currentUserSocketId ||
              participant.name === currentUserName;
            const displayName = isCurrentUser
              ? currentUserName
              : participant.name;

            return (
              <div
                key={participant.socketId}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 ${
                  isCurrentUser
                    ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
                    : "border-[rgba(148,163,184,0.12)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)]"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] ${
                    isCurrentUser
                      ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--line)] bg-[var(--surface-chip)] text-[var(--text-muted)]"
                  }`}
                >
                  {initialsFor(displayName)}
                </span>
                <span className="text-xs font-medium">{displayName}</span>
                {isCurrentUser ? (
                  <span className="rounded-full border border-[var(--line)] bg-[var(--surface-chip)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
                    You
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
