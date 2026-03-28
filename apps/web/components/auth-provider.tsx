"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const SESSION_STORAGE_KEY = "itecify-demo-session";
const SESSION_CHANGE_EVENT = "itecify-demo-session-change";

export type AuthUser = {
  uid: string;
  displayName: string;
  email: string;
};

export type UserProfile = {
  uid: string;
  username: string;
  email: string;
};

type DemoSession = {
  uid: string;
  username: string;
  email: string;
};

let cachedSessionRawValue: string | null | undefined;
let cachedSessionSnapshot: DemoSession | null = null;

type AuthContextValue = {
  user: AuthUser | null;
  profile: UserProfile | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signInDemo: (payload: { email: string; password: string }) => Promise<void>;
  registerDemo: (payload: {
    username: string;
    email: string;
    password: string;
  }) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionToState(session: DemoSession) {
  const user: AuthUser = {
    uid: session.uid,
    displayName: session.username,
    email: session.email,
  };

  const profile: UserProfile = {
    uid: session.uid,
    username: session.username,
    email: session.email,
  };

  return { user, profile };
}

function generateUid() {
  return `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (rawValue === cachedSessionRawValue) {
    return cachedSessionSnapshot;
  }

  if (!rawValue) {
    cachedSessionRawValue = null;
    cachedSessionSnapshot = null;
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<DemoSession>;

    if (
      typeof parsed.uid !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.email !== "string"
    ) {
      cachedSessionRawValue = rawValue;
      cachedSessionSnapshot = null;
      return null;
    }

    cachedSessionRawValue = rawValue;
    cachedSessionSnapshot = {
      uid: parsed.uid,
      username: parsed.username,
      email: parsed.email,
    } satisfies DemoSession;

    return cachedSessionSnapshot;
  } catch {
    cachedSessionRawValue = rawValue;
    cachedSessionSnapshot = null;
    return null;
  }
}

function writeStoredSession(session: DemoSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

function subscribeToSession(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  function handleStorage(event: StorageEvent) {
    if (event.key && event.key !== SESSION_STORAGE_KEY) {
      return;
    }

    onStoreChange();
  }

  function handleSessionChange() {
    onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SESSION_CHANGE_EVENT, handleSessionChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SESSION_CHANGE_EVENT, handleSessionChange);
  };
}

function getSessionSnapshot() {
  return readStoredSession();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedSession = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null,
  );
  const derivedState = useMemo(() => {
    if (!storedSession) {
      return {
        user: null,
        profile: null,
        status: "unauthenticated" as const,
      };
    }

    const nextState = sessionToState(storedSession);

    return {
      user: nextState.user,
      profile: nextState.profile,
      status: "authenticated" as const,
    };
  }, [storedSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: derivedState.user,
      profile: derivedState.profile,
      status: derivedState.status,
      async signInDemo({ email }) {
        const normalizedEmail = email.trim().toLowerCase();
        const username = normalizedEmail.split("@")[0] || "Demo User";
        const session: DemoSession = {
          uid: generateUid(),
          username,
          email: normalizedEmail,
        };

        writeStoredSession(session);
      },
      async registerDemo({ username, email }) {
        const session: DemoSession = {
          uid: generateUid(),
          username: username.trim(),
          email: email.trim().toLowerCase(),
        };

        writeStoredSession(session);
      },
      async signOutUser() {
        writeStoredSession(null);
      },
    }),
    [derivedState.profile, derivedState.status, derivedState.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
