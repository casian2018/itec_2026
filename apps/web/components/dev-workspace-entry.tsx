"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { WorkspaceShell } from "@/components/workspace-shell";

const DEFAULT_ROOM_ID = "demo-room";
const ENTRY_DELAY_MS = 420;

function EntryStatus({
  title,
  detail,
  roomId,
  displayName,
}: {
  title: string;
  detail: string;
  roomId: string;
  displayName: string;
}) {
  return (
    <main className="min-h-screen p-4 lg:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1180px] items-center justify-center">
        <section className="w-full max-w-[680px] rounded-[32px] border border-[var(--line)] bg-[var(--bg-elevated)] p-8 shadow-[0_36px_140px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full border border-[rgba(82,199,184,0.2)] bg-[rgba(82,199,184,0.08)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">
              iTECify
            </span>
            <span className="rounded-full border border-cyan-400/14 bg-cyan-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300">
              IDE session
            </span>
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
            {detail}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[rgba(148,163,184,0.1)] bg-white/[0.03] px-4 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Display Name
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {displayName}
              </p>
            </div>

            <div className="rounded-2xl border border-[rgba(148,163,184,0.1)] bg-white/[0.03] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Room
              </p>
              <p className="mt-2 font-mono text-sm text-white">{roomId}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[rgba(82,199,184,0.14)] bg-[rgba(82,199,184,0.08)] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
              Workspace Handoff
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Landing page, lightweight identity, then collaborative IDE
              session. The room-based collaboration layer stays intact and can
              later sit behind real auth without rewriting the workspace.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export function DevWorkspaceEntry() {
  const { profile, user, status } = useAuth();
  const [isPreparing, setIsPreparing] = useState(true);

  const displayName = useMemo(
    () =>
      profile?.username?.trim() ||
      user?.displayName?.trim() ||
      user?.email?.split("@")[0] ||
      "Hackathon User",
    [profile?.username, user?.displayName, user?.email],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsPreparing(false);
    }, ENTRY_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [status]);

  if (status !== "authenticated") {
    return (
      <EntryStatus
        title="Waiting for your session"
        detail="Checking your lightweight product session before opening the browser IDE."
        roomId={DEFAULT_ROOM_ID}
        displayName={displayName}
      />
    );
  }

  if (isPreparing) {
    return (
      <EntryStatus
        title="Joining the collaborative workspace"
        detail="Preparing your identity, room context, and IDE shell before the collaborative session connects."
        roomId={DEFAULT_ROOM_ID}
        displayName={displayName}
      />
    );
  }

  return (
    <WorkspaceShell
      roomId={DEFAULT_ROOM_ID}
      currentUserName={displayName}
    />
  );
}
