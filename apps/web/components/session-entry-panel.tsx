"use client";

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
    <main className="flex h-full min-h-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] items-center justify-center">
        <section className="w-full max-w-[920px] rounded-[32px] border border-[var(--line)] bg-[var(--bg-elevated)] p-8 shadow-[0_36px_140px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full border border-[rgba(82,199,184,0.2)] bg-[rgba(82,199,184,0.08)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">
              iTECify
            </span>
            <span className="rounded-full border border-cyan-400/14 bg-cyan-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300">
              Session lobby
            </span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,380px)]">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">
                Create or join an isolated coding session.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)]">
                Each session has its own participants, workspace tree, tabs,
                terminal feed, preview state, theme, and execution history. Share
                the code with your group and you will all land in the same
                isolated browser IDE.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  [
                    "Isolated state",
                    "Files, active tabs, terminal output, and previews stay scoped to one session code.",
                  ],
                  [
                    "Hackathon-friendly",
                    "Sessions live entirely in memory and disappear once everyone leaves.",
                  ],
                  [
                    "Shareable link",
                    "Open the same /dev/SESSIONCODE route and the workspace hydrates for that group only.",
                  ],
                ].map(([title, detail]) => (
                  <div
                    key={title}
                    className="rounded-3xl border border-[rgba(148,163,184,0.1)] bg-black/20 p-4"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                      {title}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--line)] bg-white/[0.03] p-5">
              <div className="rounded-2xl border border-[rgba(82,199,184,0.14)] bg-[rgba(82,199,184,0.08)] px-4 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                  Ready to join
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Signed in as <span className="font-semibold text-white">{displayName}</span>.
                </p>
              </div>

              <div className="mt-5 space-y-5">
                <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-panel-soft)] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Create session
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Start a fresh collaborative room with a new session code.
                  </p>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCreateSession}
                    className="mt-4 w-full rounded-2xl border border-[rgba(82,199,184,0.28)] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(82,199,184,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
                  >
                    {isSubmitting ? "Preparing session..." : "Create new session"}
                  </button>
                </div>

                <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-panel-soft)] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Join by code
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
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
                      className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/[0.03] px-4 py-3 font-mono text-base uppercase tracking-[0.18em] text-white outline-none transition placeholder:text-slate-500 focus:border-[rgba(82,199,184,0.28)] focus:bg-white/[0.04]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isSubmitting || sessionCode.trim().length === 0}
                    onClick={onJoinSession}
                    className="mt-4 w-full rounded-2xl border border-[var(--line)] bg-white text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Checking session..." : "Join session"}
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <div className="mt-5 rounded-2xl border border-rose-400/18 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {errorMessage}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
