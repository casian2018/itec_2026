"use client";

import Link from "next/link";

const productHighlights = [
  {
    title: "Shared workspace",
    detail:
      "Multi-file Monaco workspace with room presence, tabs, file sync, and active-file collaboration.",
  },
  {
    title: "AI-assisted flow",
    detail:
      "AI suggestions, patch review, and assistive workflows that feel native to the IDE instead of bolted on.",
  },
  {
    title: "Run and preview",
    detail:
      "Language-aware execution, live website preview, and streamed terminal output inside the same browser tool.",
  },
];

const workspaceFeatures = [
  "Session-isolated file tree and tab state",
  "AI suggestions with review actions",
  "Live preview for web files",
  "Shared terminal and run output",
  "Snapshots, replay, and room presence",
];

export default function LandingPage() {
  return (
    <main className="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex min-h-full max-w-[1440px] flex-col overflow-hidden rounded-[36px] border border-[var(--line)] bg-[var(--bg-elevated)] shadow-[0_36px_140px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4 lg:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full border border-[rgba(82,199,184,0.2)] bg-[rgba(82,199,184,0.08)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">
              iTECify
            </span>
            <span className="rounded-full border border-[rgba(148,163,184,0.12)] bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Browser-native collaborative IDE
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/auth"
              className="rounded-2xl border border-[var(--line)] bg-[var(--bg-panel-soft)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:bg-white/[0.05] hover:text-white"
            >
              Open Auth
            </Link>
            <Link
              href="/auth"
              className="rounded-2xl border border-[rgba(82,199,184,0.28)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(82,199,184,0.18)] transition hover:brightness-105"
            >
              Start Demo
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 gap-5 p-5 lg:grid-cols-[minmax(0,1.15fr)_460px] lg:p-6">
          <div className="rounded-[32px] border border-[rgba(148,163,184,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] lg:p-8">
            <div className="max-w-3xl">
              <span className="rounded-full border border-cyan-400/14 bg-cyan-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">
                AI-native browser IDE
              </span>
              <h1 className="mt-6 text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
                Build, review, preview, and run code together in one browser IDE.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
                iTECify is positioned as a serious browser-native developer tool:
                collaborative by default, AI-assisted where it helps, and
                organized around a real IDE workspace under{" "}
                <span className="font-mono text-white">/dev</span>.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth"
                className="rounded-2xl border border-[rgba(82,199,184,0.28)] bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(82,199,184,0.18)] transition hover:brightness-105"
              >
                Open the IDE
              </Link>
              <Link
                href="/auth"
                className="rounded-2xl border border-[var(--line)] bg-[var(--bg-panel-soft)] px-5 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:bg-white/[0.05] hover:text-white"
              >
                Demo Sign In
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {productHighlights.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[26px] border border-[rgba(148,163,184,0.1)] bg-black/20 p-4"
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    {item.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <aside className="grid gap-5">
            <section className="rounded-[32px] border border-[rgba(148,163,184,0.1)] bg-[var(--bg-panel)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_44px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">
                  Session Flow
                </h2>
                <span className="rounded-full border border-cyan-400/14 bg-cyan-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">
                  Isolated rooms
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  [
                    "1. Sign in",
                    "Use the lightweight auth screen to establish a local identity for the demo.",
                  ],
                  [
                    "2. Pick a session",
                    "Inside /dev, create a fresh session code or join an existing one shared by your team.",
                  ],
                  [
                    "3. Collaborate in isolation",
                    "Files, tabs, terminal activity, theme, preview state, and execution stay scoped to that session only.",
                  ],
                ].map(([title, detail]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-[rgba(148,163,184,0.1)] bg-white/[0.03] p-4"
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

              <Link
                href="/auth"
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-[rgba(82,199,184,0.28)] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(82,199,184,0.18)] transition hover:brightness-105"
              >
                Continue to Auth
              </Link>
            </section>

            <section className="rounded-[32px] border border-[rgba(148,163,184,0.1)] bg-[var(--bg-panel)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_44px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">
                  Product Flow
                </h2>
                <span className="rounded-full border border-amber-400/12 bg-amber-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
                  Hackathon MVP
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  ["/", "Landing page", "Explain the IDE, collaboration model, and session-isolated product direction."],
                  ["/auth", "Entry route", "Collect a lightweight demo identity before handing off into the IDE."],
                  ["/dev/ABC123", "IDE workspace", "Launch the collaborative editor, preview, terminal, and AI tooling for the selected session."],
                ].map(([path, title, detail]) => (
                  <div
                    key={path}
                    className="rounded-2xl border border-[rgba(148,163,184,0.1)] bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-sm text-white">{path}</p>
                      <span className="rounded-full border border-[rgba(148,163,184,0.1)] bg-black/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        {title}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-[rgba(148,163,184,0.1)] bg-[var(--bg-panel)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_44px_rgba(0,0,0,0.22)]">
              <h2 className="text-lg font-semibold text-white">
                Workspace Capabilities
              </h2>
              <div className="mt-5 space-y-2">
                {workspaceFeatures.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-3 rounded-2xl border border-[rgba(148,163,184,0.08)] bg-white/[0.03] px-4 py-3"
                  >
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <p className="text-sm text-[var(--text-secondary)]">
                      {feature}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
