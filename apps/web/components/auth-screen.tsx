"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

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
        className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[rgba(82,199,184,0.28)] focus:bg-white/[0.04]"
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
    <main className="min-h-screen p-4 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1320px] gap-6 lg:grid-cols-[minmax(0,1.08fr)_460px]">
        <section className="relative hidden overflow-hidden rounded-[32px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8 shadow-[0_36px_140px_rgba(0,0,0,0.34)] backdrop-blur-xl lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(82,199,184,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_28%)]" />

            <div className="relative">
              <div className="flex items-center gap-3">
              <span className="inline-flex rounded-full border border-[rgba(82,199,184,0.2)] bg-[rgba(82,199,184,0.08)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">
                iTECify
              </span>
              <span className="rounded-full border border-amber-400/12 bg-amber-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300">
                Demo Auth
              </span>
              </div>
              <h1 className="mt-6 max-w-xl text-5xl font-semibold tracking-[-0.05em] text-white">
              Enter the collaborative browser IDE.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-muted)]">
              This route acts as lightweight product entry. It captures a demo
              identity, then hands off into the shared IDE workspace without
              pretending to be production auth yet.
              </p>
            </div>

          <div className="relative grid gap-4 sm:grid-cols-3">
            {[
              [
                "IDE-first flow",
                "Editor, preview, terminal, snapshots, and AI assistance live in one consistent product surface.",
              ],
              [
                "Lightweight entry",
                "No production auth yet. This stays simple for the demo while preserving a clean replacement point later.",
              ],
              [
                "Room session",
                "The same collaborative room, workspace sync, and execution flows continue once /dev opens.",
              ],
            ].map(([title, detail]) => (
              <div
                key={title}
                className="rounded-3xl border border-[rgba(148,163,184,0.1)] bg-black/20 p-4"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                  {title}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-[460px] rounded-[32px] border border-[var(--line)] bg-[var(--bg-elevated)] p-6 shadow-[0_36px_140px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex rounded-full border border-[rgba(82,199,184,0.2)] bg-[rgba(82,199,184,0.08)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">
                iTECify
              </span>
              <Link
                href="/"
                className="text-sm text-[var(--text-muted)] transition hover:text-white"
              >
                Back to landing
              </Link>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-400/12 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
              This is a lightweight entry screen for the demo. It creates a
              local session only, then hands off into{" "}
              <span className="font-mono">/dev</span> where the collaborative
              IDE session starts.
            </div>

            <div className="mt-4 rounded-2xl border border-[rgba(82,199,184,0.14)] bg-[rgba(82,199,184,0.08)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">
              You will enter the shared IDE as the username shown in your demo
              session. The underlying room join flow stays simple for now and is
              easy to replace later with real authentication.
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/[0.03] p-1">
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
                        ? "bg-white text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.12)]"
                        : "text-[var(--text-secondary)] hover:text-white"
                    }`}
                  >
                    {item === "login" ? "Log In" : "Register"}
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                {mode === "login" ? "Continue into the IDE" : "Create a demo identity"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {mode === "login"
                  ? "Use any valid email and password to continue into the shared /dev workspace."
                  : "Pick the name collaborators should see once you enter the shared IDE room."}
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
                <div className="rounded-2xl border border-rose-400/18 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {submitError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || status === "loading"}
                className="w-full rounded-2xl border border-[rgba(82,199,184,0.28)] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(82,199,184,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
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
          </div>
        </section>
      </div>
    </main>
  );
}
