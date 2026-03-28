"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AiBlock,
  createSocketClient,
  type CursorPosition,
  type ItecifySocket,
  type Participant,
  type RemoteCursor,
} from "@/lib/socket";
import { AiSuggestionsPanel } from "./ai-suggestions-panel";
import { CollaborativeEditor } from "./collaborative-editor";
import { ParticipantsBar } from "./participants-bar";

const fallbackAiBlocks: AiBlock[] = [
  {
    id: "fallback-block-1",
    roomId: "demo-room",
    code: `function fetchWorkspaceProject(projectId) {
  return fetch(\`/api/projects/\${projectId}\`).then((response) =>
    response.json(),
  );
}`,
    explanation:
      "Extract the API call into a helper so the editor shell and preview path can share the same fetch flow.",
    insertAfterLine: 6,
    status: "pending",
    createdAt: new Date("2026-03-27T09:00:00.000Z").toISOString(),
  },
  {
    id: "fallback-block-2",
    roomId: "demo-room",
    code: `const [isJoiningRoom, setIsJoiningRoom] = useState(true);`,
    explanation:
      "Add a lightweight loading state before the editor becomes interactive for new collaborators.",
    insertAfterLine: 3,
    status: "pending",
    createdAt: new Date("2026-03-27T09:02:00.000Z").toISOString(),
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

const currentUserName = "Hackathon User";
const DOCUMENT_SYNC_DELAY_MS = 120;

const fallbackParticipants: Participant[] = [
  {
    socketId: "local-preview",
    name: currentUserName,
  },
  {
    socketId: "mock-collaborator",
    name: "Demo Pair",
  },
];

type ConnectionStatus = "connecting" | "connected" | "disconnected";

type TopBarProps = {
  connectionStatus: ConnectionStatus;
  participantCount: number;
  isAskingAi: boolean;
  onAskAi: () => void;
};

function ActionButton({
  children,
  accent = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  accent?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        accent
          ? "rounded-2xl border border-[rgba(82,199,184,0.28)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(82,199,184,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
          : "rounded-2xl border border-[var(--line)] bg-[var(--bg-panel-soft)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[var(--line)] disabled:hover:bg-[var(--bg-panel-soft)] disabled:hover:text-[var(--text-secondary)]"
      }
    >
      {children}
    </button>
  );
}

function TopBar({
  connectionStatus,
  participantCount,
  isAskingAi,
  onAskAi,
}: TopBarProps) {
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
        <ActionButton disabled={isAskingAi} onClick={onAskAi}>
          {isAskingAi ? "Asking AI..." : "Ask AI"}
        </ActionButton>
        <ActionButton>Share</ActionButton>
        <ActionButton>Invite</ActionButton>
        <ActionButton accent>Run Preview</ActionButton>
      </div>
    </header>
  );
}

type EditorPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onCursorChange: (position: CursorPosition) => void;
  remoteCursors: RemoteCursor[];
  roomId: string;
};

function EditorPanel({
  value,
  onChange,
  onCursorChange,
  remoteCursors,
  roomId,
}: EditorPanelProps) {
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
        <CollaborativeEditor
          value={value}
          onChange={onChange}
          onCursorChange={onCursorChange}
          remoteCursors={remoteCursors}
        />
      </div>
    </section>
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
    <section className="flex min-h-0 flex-col rounded-[26px] border border-[var(--line)] bg-[var(--bg-panel)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_18px_44px_rgba(0,0,0,0.22)] lg:p-5">
      <div className="mb-4 border-b border-[rgba(148,163,184,0.08)] pb-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.24em] text-white/92">
          Console Output
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
          Mock runtime feedback for the coding workspace.
        </p>
      </div>

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
    </section>
  );
}

export function WorkspaceShell() {
  const roomId = "demo-room";
  const [editorValue, setEditorValue] = useState(initialEditorValue);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [participants, setParticipants] =
    useState<Participant[]>(fallbackParticipants);
  const [aiBlocks, setAiBlocks] = useState<AiBlock[]>(fallbackAiBlocks);
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [currentSocketId, setCurrentSocketId] = useState<string | null>(null);
  const socketRef = useRef<ItecifySocket | null>(null);
  const latestCodeRef = useRef(initialEditorValue);
  const lastNetworkCodeRef = useRef(initialEditorValue);
  const pendingCodeRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteCodeRef = useRef(false);
  const latestCursorRef = useRef<CursorPosition | null>(null);

  function clearScheduledSync() {
    if (!syncTimerRef.current) {
      return;
    }

    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = null;
  }

  function flushPendingCode() {
    clearScheduledSync();

    const pendingCode = pendingCodeRef.current;
    const socket = socketRef.current;

    if (!pendingCode || !socket?.connected) {
      return;
    }

    if (pendingCode === lastNetworkCodeRef.current) {
      pendingCodeRef.current = null;
      return;
    }

    pendingCodeRef.current = null;
    lastNetworkCodeRef.current = pendingCode;
    socket.emit("code:update", {
      roomId,
      code: pendingCode,
    });
  }

  function scheduleDocumentSync() {
    if (syncTimerRef.current) {
      return;
    }

    syncTimerRef.current = setTimeout(() => {
      flushPendingCode();
    }, DOCUMENT_SYNC_DELAY_MS);
  }

  const applyRemoteCode = useCallback((nextCode: string) => {
    clearScheduledSync();
    pendingCodeRef.current = null;
    applyingRemoteCodeRef.current = true;
    latestCodeRef.current = nextCode;
    lastNetworkCodeRef.current = nextCode;
    setEditorValue(nextCode);

    queueMicrotask(() => {
      applyingRemoteCodeRef.current = false;
    });
  }, []);

  useEffect(() => {
    const socket = createSocketClient();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("connected");
      setCurrentSocketId(socket.id ?? null);
      socket.emit("room:join", {
        roomId,
        name: currentUserName,
      });
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
      setCurrentSocketId(null);
      setIsAskingAi(false);
      setRemoteCursors([]);
    });

    socket.on("room:state", (room) => {
      applyRemoteCode(room.code);
      setParticipants(room.participants);
      setAiBlocks(room.aiBlocks);
      setRemoteCursors((currentCursors) =>
        currentCursors.filter((cursor) =>
          room.participants.some(
            (participant: Participant) =>
              participant.socketId === cursor.socketId,
          ),
        ),
      );
    });

    socket.on("room:participants", (participants) => {
      setParticipants(participants);
      setRemoteCursors((currentCursors) =>
        currentCursors.filter((cursor) =>
          participants.some(
            (participant: Participant) =>
              participant.socketId === cursor.socketId,
          ),
        ),
      );
    });

    socket.on("code:updated", ({ code }) => {
      if (code === latestCodeRef.current) {
        return;
      }

      applyRemoteCode(code);
    });

    socket.on("cursor:updated", (cursor) => {
      if (cursor.socketId === socket.id) {
        return;
      }

      setRemoteCursors((currentCursors) => {
        const remainingCursors = currentCursors.filter(
          (currentCursor) => currentCursor.socketId !== cursor.socketId,
        );

        return [...remainingCursors, cursor];
      });
    });

    socket.on("cursor:cleared", ({ socketId }) => {
      setRemoteCursors((currentCursors) =>
        currentCursors.filter((cursor) => cursor.socketId !== socketId),
      );
    });

    socket.on("ai:block:created", ({ block }) => {
      setAiBlocks((currentBlocks) => {
        const remainingBlocks = currentBlocks.filter(
          (currentBlock) => currentBlock.id !== block.id,
        );

        return [...remainingBlocks, block].sort((left, right) =>
          left.createdAt.localeCompare(right.createdAt),
        );
      });
      setIsAskingAi(false);
    });

    socket.on("ai:block:updated", ({ block }) => {
      setAiBlocks((currentBlocks) =>
        currentBlocks.map((currentBlock) =>
          currentBlock.id === block.id ? block : currentBlock,
        ),
      );
    });

    socket.connect();

    return () => {
      clearScheduledSync();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [applyRemoteCode, roomId]);

  function handleEditorChange(nextValue: string) {
    if (applyingRemoteCodeRef.current) {
      return;
    }

    if (nextValue === latestCodeRef.current) {
      return;
    }

    latestCodeRef.current = nextValue;
    setEditorValue(nextValue);
    pendingCodeRef.current = nextValue;
    scheduleDocumentSync();
  }

  function handleCursorChange(position: CursorPosition) {
    if (
      latestCursorRef.current?.lineNumber === position.lineNumber &&
      latestCursorRef.current?.column === position.column
    ) {
      return;
    }

    latestCursorRef.current = position;

    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("cursor:update", {
      roomId,
      position,
    });
  }

  function handleAskAi() {
    if (!socketRef.current?.connected || isAskingAi) {
      return;
    }

    setIsAskingAi(true);
    socketRef.current.emit("ai:block:create", {
      roomId,
      prompt: "Review the current hackathon MVP code and suggest practical next improvements.",
      code: editorValue,
    });
  }

  function updateAiBlockStatus(
    blockId: string,
    status: AiBlock["status"],
  ) {
    setAiBlocks((currentBlocks) =>
      currentBlocks.map((currentBlock) =>
        currentBlock.id === blockId
          ? {
              ...currentBlock,
              status,
            }
          : currentBlock,
      ),
    );
  }

  function handleAcceptAiBlock(blockId: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    updateAiBlockStatus(blockId, "accepted");
    socketRef.current.emit("ai:block:accept", {
      roomId,
      blockId,
    });
  }

  function handleRejectAiBlock(blockId: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    updateAiBlockStatus(blockId, "rejected");
    socketRef.current.emit("ai:block:reject", {
      roomId,
      blockId,
    });
  }

  return (
    <main className="min-h-screen p-3 text-[var(--text-primary)] sm:p-4 lg:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1680px] flex-col overflow-hidden rounded-[32px] border border-[var(--line)] bg-[var(--bg-elevated)] shadow-[0_36px_140px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:min-h-[calc(100vh-2rem)]">
        <TopBar
          connectionStatus={connectionStatus}
          participantCount={participants.length}
          isAskingAi={isAskingAi}
          onAskAi={handleAskAi}
        />
        <ParticipantsBar
          participants={participants}
          currentUserName={currentUserName}
          currentUserSocketId={currentSocketId}
        />

        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5 lg:p-5">
          <EditorPanel
            value={editorValue}
            onChange={handleEditorChange}
            onCursorChange={handleCursorChange}
            remoteCursors={remoteCursors}
            roomId={roomId}
          />

          <aside className="grid min-h-0 gap-4 lg:grid-rows-[minmax(0,1.1fr)_minmax(240px,0.9fr)] lg:gap-5">
            <AiSuggestionsPanel
              blocks={aiBlocks}
              isLoading={isAskingAi}
              onAccept={handleAcceptAiBlock}
              onReject={handleRejectAiBlock}
            />
            <ConsolePanel />
          </aside>
        </div>
      </div>
    </main>
  );
}
