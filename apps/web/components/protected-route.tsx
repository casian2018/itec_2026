"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

function FullScreenStatus({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--line)] bg-[var(--bg-elevated)] p-8 shadow-[0_36px_140px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">
          iTECify Access
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          {detail}
        </p>
      </div>
    </main>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }

    const nextUrl =
      pathname && pathname !== "/auth"
        ? `?next=${encodeURIComponent(pathname)}`
        : "";

    router.replace(`/auth${nextUrl}`);
  }, [pathname, router, status]);

  if (status === "loading") {
    return (
      <FullScreenStatus
        title="Restoring your session"
        detail="Checking your lightweight session before opening /dev and initializing the collaborative IDE workspace."
      />
    );
  }

  if (status === "unauthenticated") {
    return (
      <FullScreenStatus
        title="Redirecting to sign in"
        detail="Open the lightweight entry route first, then continue into /dev where the collaborative IDE session is created."
      />
    );
  }

  return <>{children}</>;
}
