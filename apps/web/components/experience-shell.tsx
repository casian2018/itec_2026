"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

const EXPERIENCE_STYLE: CSSProperties &
  Record<"--primary" | "--accent" | "--surface-glass", string> = {
  "--primary": "252 87% 72%",
  "--accent": "239 84% 67%",
  "--surface-glass": "232 29% 10%",
};

export const experienceInputClassName =
  "mt-2 w-full rounded-2xl border border-border/40 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-primary/40 focus:bg-white/[0.08]";

export const experiencePrimaryButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] px-5 py-3 text-sm font-semibold text-white transition-all hover:shadow-[0_0_40px_rgba(139,124,246,0.35)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none";

export const experienceSecondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-border/40 bg-white/[0.05] px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary/35 hover:bg-white/[0.08]";

function ExperienceBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,124,246,0.2),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_24%),linear-gradient(180deg,#070d19_0%,#0c1322_48%,#060913_100%)]" />
      <motion.div
        className="absolute left-[10%] top-[8%] h-[560px] w-[560px] rounded-full blur-[180px]"
        style={{ background: "radial-gradient(circle, rgba(139,124,246,0.18), transparent 70%)" }}
        animate={{ x: [0, 50, 0], y: [0, -36, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[8%] right-[10%] h-[480px] w-[480px] rounded-full blur-[160px]"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.16), transparent 70%)" }}
        animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,124,246,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(139,124,246,0.35) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

export function ExperiencePill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "muted";
}) {
  const className =
    tone === "accent"
      ? "border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]"
      : tone === "muted"
        ? "border border-border/20 bg-white/[0.04] text-muted-foreground"
        : "border border-primary/20 bg-primary/10 text-primary";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] ${className}`}
    >
      {children}
    </span>
  );
}

export function ExperiencePanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[32px] border border-border/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_36px_140px_rgba(0,0,0,0.4)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </section>
  );
}

export function ExperienceFeatureCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/20 bg-black/20 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
        {title}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

export function ExperienceShell({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main
      className="relative h-full overflow-y-auto overflow-x-hidden bg-background"
      style={EXPERIENCE_STYLE}
    >
      <ExperienceBackdrop />

      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed left-0 right-0 top-0 z-40"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="text-xl font-bold tracking-tight font-serif">
            <span className="text-foreground">iTEC</span>
            <span className="text-primary">ify</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/" className={experienceSecondaryButtonClassName}>
              Back To Landing
            </Link>
            {actions}
          </div>
        </div>
      </motion.header>

      <div className="relative z-10 mx-auto min-h-full w-full max-w-[1320px] px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}
