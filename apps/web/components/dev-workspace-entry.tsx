"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { SessionEntryPanel } from "@/components/session-entry-panel";
import {
  buildDevSessionUrl,
  createSession,
  isValidSessionCode,
  lookupSession,
  normalizeSessionCode,
  type SessionLookupResponse,
} from "@/lib/session";
import { WorkspaceShell } from "@/components/workspace-shell";

const ENTRY_DELAY_MS = 420;
const EMPTY_SESSION_LABEL = "No session selected";

function EntryStatus({
  title,
  detail,
  sessionCode,
  displayName,
}: {
  title: string;
  detail: string;
  sessionCode: string;
  displayName: string;
}) {
  return (
    <main className="flex h-full min-h-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] items-center justify-center">
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
                Session
              </p>
              <p className="mt-2 font-mono text-sm text-white">{sessionCode}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[rgba(82,199,184,0.14)] bg-[rgba(82,199,184,0.08)] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
              Workspace Handoff
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Lightweight identity, then isolated collaborative IDE session.
              Each session code hydrates its own in-memory workspace, participants,
              preview state, files, and terminal activity.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export function DevWorkspaceEntry({ sessionCode }: { sessionCode?: string }) {
  const router = useRouter();
  const { profile, user, status } = useAuth();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionLookup, setSessionLookup] = useState<SessionLookupResponse | null>(
    null,
  );
  const [sessionStatus, setSessionStatus] = useState<
    "select" | "checking" | "ready" | "missing" | "invalid"
  >("select");
  const [sessionCodeInput, setSessionCodeInput] = useState("");

  const normalizedSessionCode = useMemo(
    () => normalizeSessionCode(sessionCode),
    [sessionCode],
  );
  const displayName = useMemo(
    () =>
      profile?.username?.trim() ||
      user?.displayName?.trim() ||
      user?.email?.split("@")[0] ||
      "Hackathon User",
    [profile?.username, user?.displayName, user?.email],
  );
  const currentUserId = useMemo(
    () => profile?.uid || user?.uid || `guest-${displayName}`,
    [displayName, profile?.uid, user?.uid],
  );

  useEffect(() => {
    if (!sessionCode) {
      return;
    }

    setSessionCodeInput(normalizedSessionCode);
  }, [normalizedSessionCode, sessionCode]);

  useEffect(() => {
    if (status !== "authenticated") {
      setIsPreparing(false);
      return;
    }

    if (!sessionCode) {
      setSessionLookup(null);
      setSessionError(null);
      setSessionStatus("select");
      setIsPreparing(false);
      return;
    }

    if (!isValidSessionCode(normalizedSessionCode)) {
      setSessionLookup(null);
      setSessionStatus("invalid");
      setSessionError("Session codes use 6 uppercase letters or numbers, like ABC123.");
      setIsPreparing(false);
      return;
    }

    let cancelled = false;

    setSessionLookup(null);
    setSessionError(null);
    setSessionStatus("checking");
    setIsPreparing(false);

    void lookupSession(normalizedSessionCode)
      .then((session) => {
        if (cancelled) {
          return;
        }

        if (!session) {
          setSessionLookup(null);
          setSessionStatus("missing");
          setSessionError(
            `Session ${normalizedSessionCode} is not active. Create a new one or join another code.`,
          );
          return;
        }

        setSessionLookup(session);
        setSessionStatus("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSessionLookup(null);
        setSessionStatus("missing");
        setSessionError(
          error instanceof Error
            ? error.message
            : "Unable to load that collaborative session right now.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSessionCode, sessionCode, status]);

  useEffect(() => {
    if (status !== "authenticated" || sessionStatus !== "ready") {
      setIsPreparing(false);
      return;
    }

    setIsPreparing(true);

    const timeoutId = window.setTimeout(() => {
      setIsPreparing(false);
    }, ENTRY_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [sessionStatus, status]);

  function handleSessionCodeChange(value: string) {
    setSessionCodeInput(normalizeSessionCode(value));
    setSessionError(null);
  }

  async function handleCreateSession() {
    setIsSubmittingSession(true);
    setSessionError(null);

    try {
      const createdSession = await createSession();
      router.replace(buildDevSessionUrl(createdSession.roomId));
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Unable to create a new collaborative session.",
      );
    } finally {
      setIsSubmittingSession(false);
    }
  }

  async function handleJoinSession() {
    const nextSessionCode = normalizeSessionCode(sessionCodeInput);

    if (!isValidSessionCode(nextSessionCode)) {
      setSessionError("Enter a valid 6-character session code before joining.");
      return;
    }

    setIsSubmittingSession(true);
    setSessionError(null);

    try {
      const session = await lookupSession(nextSessionCode);

      if (!session) {
        setSessionError(
          `Session ${nextSessionCode} was not found. Ask your team for the active code or create a fresh session.`,
        );
        return;
      }

      router.replace(buildDevSessionUrl(session.roomId));
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Unable to join that collaborative session.",
      );
    } finally {
      setIsSubmittingSession(false);
    }
  }

  if (status !== "authenticated") {
    return (
      <EntryStatus
        title="Waiting for your session"
        detail="Checking your lightweight product session before opening the browser IDE."
        sessionCode={normalizedSessionCode || EMPTY_SESSION_LABEL}
        displayName={displayName}
      />
    );
  }

  if (
    sessionStatus === "select" ||
    sessionStatus === "missing" ||
    sessionStatus === "invalid"
  ) {
    return (
      <SessionEntryPanel
        displayName={displayName}
        sessionCode={sessionCodeInput}
        onSessionCodeChange={handleSessionCodeChange}
        onCreateSession={handleCreateSession}
        onJoinSession={handleJoinSession}
        isSubmitting={isSubmittingSession}
        errorMessage={sessionError}
      />
    );
  }

  if (sessionStatus === "checking") {
    return (
      <EntryStatus
        title="Resolving the coding session"
        detail="Checking that the collaborative session exists and loading its isolated in-memory workspace before the IDE connects."
        sessionCode={normalizedSessionCode || EMPTY_SESSION_LABEL}
        displayName={displayName}
      />
    );
  }

  if (isPreparing) {
    return (
      <EntryStatus
        title="Joining the collaborative workspace"
        detail="Preparing your identity, session context, and IDE shell before the collaborative workspace connects."
        sessionCode={sessionLookup?.roomId ?? normalizedSessionCode}
        displayName={displayName}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <WorkspaceShell
        roomId={sessionLookup?.roomId ?? normalizedSessionCode}
        currentUserName={displayName}
        currentUserId={currentUserId}
      />
    </div>
  );
}
