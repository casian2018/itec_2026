"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  ExperienceFeatureCard,
  ExperiencePanel,
  ExperiencePill,
  ExperienceShell,
  experienceInputClassName,
  experiencePrimaryButtonClassName,
  experienceSecondaryButtonClassName,
} from "@/components/experience-shell";

type AuthMode = "login" | "register";

type FormState = {
  username: string;
  email: string;
  password: string;
};

const initialFormState: FormState = {
  username: "",
  email: "",
  password: "",
};

function resolveNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dev";
  }

  return value;
}

function validateForm(mode: AuthMode, values: FormState) {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (mode === "register") {
    const username = values.username.trim();

    if (username.length < 2) {
      errors.username = "Username must be at least 2 characters.";
    }
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm text-rose-300">{message}</p>;
}

function AuthInput({
  label,
  type,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--text-secondary)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={experienceInputClassName}
      />
      <FieldError message={error} />
    </label>
  );
}

export function AuthScreen({ next }: { next?: string }) {
  const router = useRouter();
  const { status, signInDemo, registerDemo } = useAuth();
  const nextPath = useMemo(() => resolveNextPath(next ?? null), [next]);
  const [mode, setMode] = useState<AuthMode>("login");
  const [values, setValues] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  function updateValue(field: keyof FormState, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
    setSubmitError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(mode, values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (mode === "register") {
        await registerDemo({
          username: values.username,
          email: values.email,
          password: values.password,
        });
      } else {
        await signInDemo({
          email: values.email,
          password: values.password,
        });
      }

      router.replace(nextPath);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to continue into the demo workspace.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ExperienceShell
      actions={
        <Link href="/dev" className={experienceSecondaryButtonClassName}>
          Open /dev
        </Link>
      }
    >
      <div className="grid min-h-full gap-8 lg:grid-cols-[minmax(0,1.06fr)_460px] lg:items-center">
        <ExperiencePanel className="relative hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,124,246,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.1),transparent_28%)]" />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <ExperiencePill>Demo Auth</ExperiencePill>
              <ExperiencePill tone="accent">Route /auth</ExperiencePill>
            </div>

            <h1 className="mt-6 max-w-2xl font-serif text-5xl font-semibold tracking-[-0.05em] text-white lg:text-6xl">
              Enter the collaborative browser IDE with the same product feel as the landing page.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
              This entry screen stays intentionally lightweight, but it should still feel like the
              same product. Sign in here, then hand off into the session-aware `/dev` lobby where
              teams create or join isolated collaborative workspaces.
            </p>
          </div>

          <div className="relative mt-10 grid gap-4 sm:grid-cols-3">
            <ExperienceFeatureCard
              title="IDE-first flow"
              detail="Editor, preview, terminal, snapshots, and AI assistance remain the core product surface."
            />
            <ExperienceFeatureCard
              title="Lightweight entry"
              detail="Simple demo auth now, with a clean upgrade path later to real production auth."
            />
            <ExperienceFeatureCard
              title="Session handoff"
              detail="Once authenticated, /dev turns identity into a shareable session code and isolated room."
            />
          </div>
        </ExperiencePanel>

        <ExperiencePanel className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ExperiencePill>Identity</ExperiencePill>
              <ExperiencePill tone="muted">Next {nextPath}</ExperiencePill>
            </div>
            <Link href="/" className="text-sm text-muted-foreground transition hover:text-white">
              Back To Landing
            </Link>
          </div>

          <div className="mt-5 rounded-[24px] border border-primary/18 bg-primary/10 px-4 py-4 text-sm leading-6 text-[rgb(230,223,255)]">
            This creates a local demo auth session only, then hands off into{" "}
            <span className="font-mono text-white">/dev</span> where you create or join a
            collaborative coding session.
          </div>

          <div className="mt-4 rounded-[24px] border border-border/30 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-muted-foreground">
            Identity stays local for now. Once authenticated, the next step is selecting a session
            code that isolates collaborators, files, tabs, terminal activity, preview state, and
            execution.
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-[22px] border border-border/30 bg-white/[0.04] p-1">
            {(["login", "register"] as const).map((item) => {
              const active = mode === item;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setErrors({});
                    setSubmitError(null);
                  }}
                  className={`flex-1 rounded-[18px] px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] text-white shadow-[0_10px_34px_rgba(139,124,246,0.26)]"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {item === "login" ? "Log In" : "Register"}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <h2 className="font-serif text-3xl font-semibold tracking-[-0.04em] text-white">
              {mode === "login" ? "Continue into the IDE" : "Create a demo identity"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {mode === "login"
                ? "Use any valid email and password to continue into /dev, then choose or join a coding session."
                : "Pick the name collaborators should see once you enter a coding session."}
            </p>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <AuthInput
                label="Username"
                type="text"
                value={values.username}
                onChange={(value) => updateValue("username", value)}
                placeholder="PairProgrammingPro"
                error={errors.username}
              />
            ) : null}

            <AuthInput
              label="Email"
              type="email"
              value={values.email}
              onChange={(value) => updateValue("email", value)}
              placeholder="you@example.com"
              error={errors.email}
            />

            <AuthInput
              label="Password"
              type="password"
              value={values.password}
              onChange={(value) => updateValue("password", value)}
              placeholder="Minimum 6 characters"
              error={errors.password}
            />

            {submitError ? (
              <div className="rounded-[22px] border border-rose-400/18 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || status === "loading"}
              className={`${experiencePrimaryButtonClassName} w-full rounded-2xl`}
            >
              {isSubmitting
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Enter /dev"
                  : "Create demo account"}
            </button>
          </form>
        </ExperiencePanel>
      </div>
    </ExperienceShell>
  );
}
