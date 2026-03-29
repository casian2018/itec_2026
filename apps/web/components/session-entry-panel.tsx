"use client";

import Link from "next/link";
import {
  ExperienceFeatureCard,
  ExperiencePanel,
  ExperiencePill,
  ExperienceShell,
  experienceInputClassName,
  experiencePrimaryButtonClassName,
  experienceSecondaryButtonClassName,
} from "@/components/experience-shell";

type SessionEntryPanelProps = {
  displayName: string;
  sessionCode: string;
  onSessionCodeChange: (value: string) => void;
  onCreateSession: () => void;
  onJoinSession: () => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
};

export function SessionEntryPanel({
  displayName,
  sessionCode,
  onSessionCodeChange,
  onCreateSession,
  onJoinSession,
  isSubmitting,
  errorMessage,
}: SessionEntryPanelProps) {
  return (
    <ExperienceShell
      actions={
        <Link href="/auth" className={experienceSecondaryButtonClassName}>
          Switch Identity
        </Link>
      }
    >
      <div className="flex min-h-full items-center justify-center">
        <ExperiencePanel className="w-full max-w-[1180px] p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <ExperiencePill>Session Lobby</ExperiencePill>
            <ExperiencePill tone="accent">Route /dev</ExperiencePill>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.96fr)_minmax(360px,400px)]">
            <div>
              <h1 className="font-serif text-4xl font-semibold tracking-[-0.05em] text-white lg:text-5xl">
                Create or join an isolated coding session.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-muted-foreground">
                Each session has its own participants, workspace tree, tabs, terminal feed,
                preview state, theme, and execution history. Share the code with your group and
                you all land in the same isolated browser IDE.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <ExperienceFeatureCard
                  title="Isolated state"
                  detail="Files, active tabs, terminal output, and previews stay scoped to one session code."
                />
                <ExperienceFeatureCard
                  title="Hackathon-friendly"
                  detail="Sessions live entirely in memory and disappear once everyone leaves."
                />
                <ExperienceFeatureCard
                  title="Shareable link"
                  detail="Open the same /dev/SESSIONCODE route and the workspace hydrates for that group only."
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-border/30 bg-white/[0.04] p-5">
              <div className="rounded-[22px] border border-primary/18 bg-primary/10 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                  Ready to join
                </p>
                <p className="mt-2 text-sm leading-6 text-[rgb(230,223,255)]">
                  Signed in as <span className="font-semibold text-white">{displayName}</span>.
                </p>
              </div>

              <div className="mt-5 space-y-5">
                <div className="rounded-[24px] border border-border/30 bg-black/20 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Create session
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Start a fresh collaborative room with a new session code.
                  </p>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCreateSession}
                    className={`${experiencePrimaryButtonClassName} mt-4 w-full rounded-2xl`}
                  >
                    {isSubmitting ? "Preparing session..." : "Create new session"}
                  </button>
                </div>

                <div className="rounded-[24px] border border-border/30 bg-black/20 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Join by code
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Enter the 6-character session code your collaborators shared.
                  </p>
                  <label className="mt-4 block">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">
                      Session code
                    </span>
                    <input
                      value={sessionCode}
                      onChange={(event) => onSessionCodeChange(event.target.value)}
                      placeholder="ABC123"
                      maxLength={6}
                      autoCapitalize="characters"
                      spellCheck={false}
                      className={`${experienceInputClassName} font-mono text-base uppercase tracking-[0.18em]`}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isSubmitting || sessionCode.trim().length === 0}
                    onClick={onJoinSession}
                    className={`${experienceSecondaryButtonClassName} mt-4 w-full rounded-2xl`}
                  >
                    {isSubmitting ? "Checking session..." : "Join session"}
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <div className="mt-5 rounded-[22px] border border-rose-400/18 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {errorMessage}
                </div>
              ) : null}
            </div>
          </div>
        </ExperiencePanel>
      </div>
    </ExperienceShell>
  );
}
