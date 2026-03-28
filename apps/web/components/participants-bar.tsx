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
  return (
    <section className="border-b border-[rgba(148,163,184,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.018),rgba(255,255,255,0.008))] px-5 py-3 lg:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
            Participants
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Everyone currently connected to this shared room.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {participants.map((participant) => {
            const isCurrentUser =
              participant.socketId === currentUserSocketId ||
              participant.name === currentUserName;

            return (
              <div
                key={participant.socketId}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${
                  isCurrentUser
                    ? "border-[rgba(82,199,184,0.24)] bg-[rgba(82,199,184,0.12)] text-white"
                    : "border-[rgba(148,163,184,0.12)] bg-white/[0.03] text-[var(--text-secondary)]"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] ${
                    isCurrentUser
                      ? "bg-[rgba(82,199,184,0.16)] text-[var(--accent)]"
                      : "bg-white/[0.05] text-[var(--text-muted)]"
                  }`}
                >
                  {initialsFor(participant.name)}
                </span>
                <span className="text-sm font-medium">{participant.name}</span>
                {isCurrentUser ? (
                  <span className="rounded-full bg-black/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
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
