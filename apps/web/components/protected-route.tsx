"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  ExperiencePanel,
  ExperiencePill,
  ExperienceShell,
} from "@/components/experience-shell";

function FullScreenStatus({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <ExperienceShell>
      <div className="flex min-h-full items-center justify-center">
        <ExperiencePanel className="w-full max-w-md p-8">
          <div className="flex flex-wrap items-center gap-3">
            <ExperiencePill>iTECify Access</ExperiencePill>
            <ExperiencePill tone="accent">Protected Route</ExperiencePill>
          </div>
          <h1 className="mt-5 font-serif text-3xl font-semibold tracking-[-0.04em] text-white">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{detail}</p>
        </ExperiencePanel>
      </div>
    </ExperienceShell>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }

    const queryString = searchParams.toString();
    const nextPath =
      pathname && pathname !== "/auth"
        ? `${pathname}${queryString ? `?${queryString}` : ""}`
        : "";
    const nextUrl =
      nextPath
        ? `?next=${encodeURIComponent(nextPath)}`
        : "";

    router.replace(`/auth${nextUrl}`);
  }, [pathname, router, searchParams, status]);

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
