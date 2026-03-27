"use client";

import { useEffect, useRef, useState } from "react";
import { createSocketClient, type ItecifySocket } from "@/lib/socket";
import { CollaborativeEditor } from "./collaborative-editor";

const aiSuggestions = [
  {
    title: "Refactor duplicate fetch logic",
    detail: "Extract the API call into `lib/projects.ts` and reuse it in both editor and preview flows.",
    tone: "High impact",
  },
  {
    title: "Improve room join feedback",
    detail: "Add a lightweight loading state before the editor becomes interactive for new collaborators.",
    tone: "Quick win",
  },
  {
    title: "Prepare AI block slot",
    detail: "Reserve an inline suggestion card beneath the editor header so copilots can land without a layout rewrite.",
    tone: "Next step",
  },
];

const initialEditorValue = `export function createWorkspace() {
  const project = "iTECify";
  const roomId = "demo-room";

  return {
    project,
    roomId,
    status: "connected",
    editor: "monaco-ready",
  };
}
`;

type ConnectionStatus = "connecting" | "connected" | "disconnected";

type TopBarProps = {
  connectionStatus: ConnectionStatus;
  participantCount: number;
};

function ActionButton({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        accent
          ? "rounded-2xl border border-[rgba(82,199,184,0.28)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(82,199,184,0.18)] transition hover:brightness-105"
          : "rounded-2xl border border-[var(--line)] bg-[var(--bg-panel-soft)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:bg-white/[0.05] hover:text-white"
      }
    >
      {children}
    </button>
  );
}

function TopBar({ connectionStatus, participantCount }: TopBarProps) {
  const statusStyles =
    connectionStatus === "connected"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : connectionStatus === "connecting"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
        : "border-rose-400/20 bg-rose-400/10 text-rose-300";

  const statusLabel =
    connectionStatus === "connected"
      ? "Connected"
      : connectionStatus === "connecting"
        ? "Connecting"
        : "Disconnected";

  return (
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-5 py-4 lg:px-6 lg:py-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full border border-[rgba(82,199,184,0.2)] bg-[rgba(82,199,184,0.08)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">
            iTECify
          </span>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs ${statusStyles}`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {statusLabel}
          </span>
          <span className="rounded-full border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-1 font-mono text-xs text-[var(--text-muted)]">
            {participantCount} participant{participantCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-3">
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
            Collaborative coding workspace
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Shared room editing, AI sidecar, and console feedback in one place.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <ActionButton>Share</ActionButton>
        <ActionButton>Invite</ActionButton>
        <ActionButton accent>Run Preview</ActionButton>
      </div>
    </header>
  );
}

type PanelCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

function PanelCard({ title, subtitle, children }: PanelCardProps) {
  return (
    <section className="flex min-h-0 flex-col rounded-[26px] border border-[var(--line)] bg-[var(--bg-panel)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_18px_44px_rgba(0,0,0,0.22)] lg:p-5">
      <div className="mb-4 border-b border-[rgba(148,163,184,0.08)] pb-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.24em] text-white/92">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

type EditorPanelProps = {
  value: string;
  onChange: (value: string) => void;
  roomId: string;
};

function EditorPanel({ value, onChange, roomId }: EditorPanelProps) {
  return (
    <section className="flex min-h-[520px] flex-col rounded-[28px] border border-[var(--line)] bg-[#09111d] shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_22px_70px_rgba(0,0,0,0.3)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(148,163,184,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] px-4 py-3.5 lg:px-5">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Editor
          </p>
          <p className="mt-1 truncate font-mono text-sm text-[var(--text-secondary)]">
            {roomId}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-[rgba(148,163,184,0.12)] bg-white/[0.04] px-3 py-1 font-mono text-[var(--text-muted)]">
            JavaScript
          </span>
          <span className="rounded-full border border-cyan-400/10 bg-cyan-400/10 px-3 py-1 font-mono text-cyan-300">
            Live room
          </span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-cyan-400/5 to-transparent" />
        <CollaborativeEditor value={value} onChange={onChange} />
      </div>
    </section>
  );
}

function SuggestionsPanel() {
  return (
    <PanelCard
      title="AI Suggestions"
      subtitle="Placeholder recommendation blocks for the first hackathon pass."
    >
      <div className="space-y-3">
        {aiSuggestions.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-[rgba(148,163,184,0.1)] bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <span className="rounded-full border border-amber-400/10 bg-amber-400/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300">
                {item.tone}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {item.detail}
            </p>
          </article>
        ))}
      </div>
    </PanelCard>
  );
}

function ConsolePanel() {
  const consoleLines = [
    "$ npm run dev",
    "web: ready on http://localhost:3000",
    "server: listening on http://localhost:4000",
    'socket: joined room "demo-room"',
  ];

  return (
    <PanelCard
      title="Console Output"
      subtitle="Mock runtime feedback for the coding workspace."
    >
      <div className="h-full rounded-2xl border border-[rgba(148,163,184,0.1)] bg-[linear-gradient(180deg,rgba(0,0,0,0.3),rgba(0,0,0,0.24))] p-4 font-mono text-sm text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
            Terminal
          </span>
        </div>

        <div className="space-y-3">
          {consoleLines.map((line, index) => (
            <p
              key={line}
              className="break-all text-[13px] leading-6 text-slate-300"
            >
              <span className="mr-3 text-slate-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              {line}
            </p>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}

export function WorkspaceShell() {
  const roomId = "demo-room";
  const [editorValue, setEditorValue] = useState(initialEditorValue);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [participantCount, setParticipantCount] = useState(0);
  const socketRef = useRef<ItecifySocket | null>(null);
  const latestCodeRef = useRef(initialEditorValue);

  useEffect(() => {
    const socket = createSocketClient();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("connected");
      socket.emit("room:join", {
        roomId,
        name: "Hackathon User",
      });
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("room:state", (room) => {
      latestCodeRef.current = room.code;
      setEditorValue(room.code);
      setParticipantCount(room.participants.length);
    });

    socket.on("room:participants", (participants) => {
      setParticipantCount(participants.length);
    });

    socket.on("code:updated", ({ code }) => {
      if (code === latestCodeRef.current) {
        return;
      }

      latestCodeRef.current = code;
      setEditorValue(code);
    });

    socket.connect();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  function handleEditorChange(nextValue: string) {
    if (nextValue === latestCodeRef.current) {
      return;
    }

    latestCodeRef.current = nextValue;
    setEditorValue(nextValue);

    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("code:update", {
      roomId,
      code: nextValue,
    });
  }

  return (
    <main className="min-h-screen p-3 text-[var(--text-primary)] sm:p-4 lg:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1680px] flex-col overflow-hidden rounded-[32px] border border-[var(--line)] bg-[var(--bg-elevated)] shadow-[0_36px_140px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:min-h-[calc(100vh-2rem)]">
        <TopBar
          connectionStatus={connectionStatus}
          participantCount={participantCount}
        />

        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5 lg:p-5">
          <EditorPanel
            value={editorValue}
            onChange={handleEditorChange}
            roomId={roomId}
          />

          <aside className="grid min-h-0 gap-4 lg:grid-rows-[minmax(0,1.1fr)_minmax(240px,0.9fr)] lg:gap-5">
            <SuggestionsPanel />
            <ConsolePanel />
          </aside>
        </div>
      </div>
    </main>
  );
}
