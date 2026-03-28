"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  IDE_THEMES,
  getStoredIdeTheme,
  persistIdeTheme,
  type IdeThemeId,
} from "@/lib/ide-theme";
import {
  type ConsoleEntry,
  createConsoleEntry,
  type RunCodeStatus,
} from "@/lib/run-code";
import {
  type AiBlock,
  createSocketClient,
  type CursorPosition,
  type ItecifySocket,
  type Participant,
  type RemoteCursor,
  type RoomSnapshot,
  type RunDonePayload,
  type RunOutputPayload,
  type TerminalEntry,
  type WorkspaceFileLanguage,
  type WorkspaceFileNode,
  type WorkspaceState,
} from "@/lib/socket";
import {
  createFallbackWorkspace,
  getWorkspaceFile,
  getWorkspaceFiles,
  getWorkspaceLanguageLabel,
  toMonacoLanguage,
  updateWorkspaceFileContent,
  updateWorkspaceFileLanguage,
  updateWorkspaceView,
} from "@/lib/workspace";
import { AiSuggestionsPanel } from "./ai-suggestions-panel";
import { CollaborativeEditor } from "./collaborative-editor";
import { IdeBottomPanel } from "./ide-bottom-panel";
import { IdeEditorTabs } from "./ide-editor-tabs";
import { IdeFileExplorer } from "./ide-file-explorer";
import { IdePreviewPanel } from "./ide-preview-panel";
import { IdeSidePanel } from "./ide-side-panel";
import { ParticipantsBar } from "./participants-bar";

const DOCUMENT_SYNC_DELAY_MS = 120;

type ConnectionStatus = "connecting" | "connected" | "disconnected";
type InspectorView = "preview" | "ai";
type BottomPanelView = "terminal" | "output" | "timeline";

type PendingFileUpdate = {
  fileId: string;
  content: string;
};

type TopBarProps = {
  currentUserName: string;
  connectionStatus: ConnectionStatus;
  consoleStatus: RunCodeStatus;
  activeFile: WorkspaceFileNode;
  participantCount: number;
  roomId: string;
  isAskingAi: boolean;
  canRunCode: boolean;
  isRunningCode: boolean;
  isSigningOut: boolean;
  isPresentationMode: boolean;
  isPreviewFocused: boolean;
  themeId: IdeThemeId;
  onAskAi: () => void;
  onLanguageChange: (language: WorkspaceFileLanguage) => void;
  onThemeChange: (themeId: IdeThemeId) => void;
  onTogglePreview: () => void;
  onRunCode: () => void;
  onLogout: () => void;
};

const LANGUAGE_OPTIONS: WorkspaceFileLanguage[] = [
  "javascript",
  "python",
  "html",
  "css",
  "cpp",
  "json",
  "markdown",
  "plaintext",
];

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
          ? "h-8 border border-[var(--accent-line)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-contrast)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
          : "h-8 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[var(--line)] disabled:hover:bg-[var(--bg-panel-soft)] disabled:hover:text-[var(--text-secondary)]"
      }
    >
      {children}
    </button>
  );
}

function StatusBadge({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : tone === "warning"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
      : tone === "danger"
          ? "border-rose-400/20 bg-rose-400/10 text-rose-300"
          : tone === "accent"
            ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]"
            : "border-[rgba(148,163,184,0.12)] bg-[var(--bg-panel-soft)] text-[var(--text-muted)]";

  return (
    <span
      className={`inline-flex h-6 items-center gap-2 border px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] ${toneClasses}`}
    >
      <span className="text-[9px] text-[var(--text-muted)]">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function TopBar({
  currentUserName,
  connectionStatus,
  consoleStatus,
  activeFile,
  participantCount,
  roomId,
  isAskingAi,
  canRunCode,
  isRunningCode,
  isSigningOut,
  isPresentationMode,
  isPreviewFocused,
  themeId,
  onAskAi,
  onLanguageChange,
  onThemeChange,
  onTogglePreview,
  onRunCode,
  onLogout,
}: TopBarProps) {
  const statusLabel =
    connectionStatus === "connected"
      ? "Connected"
      : connectionStatus === "connecting"
        ? "Connecting"
        : "Disconnected";
  const connectionTone =
    connectionStatus === "connected"
      ? "success"
      : connectionStatus === "connecting"
        ? "warning"
        : "danger";
  const runStatusLabel =
    consoleStatus === "running"
      ? "Running"
      : consoleStatus === "completed"
        ? "Completed"
        : consoleStatus === "error"
          ? "Error"
          : "Idle";
  const runStatusTone =
    consoleStatus === "running"
      ? "warning"
      : consoleStatus === "completed"
        ? "success"
        : consoleStatus === "error"
          ? "danger"
          : "accent";

  const activeFileCanPreview = activeFile.language === "html";
  const activeFileCanExecute = Boolean(activeFile.executionRuntime);
  const activeFileHasContent = activeFile.content.trim().length > 0;
  const runButtonLabel = isRunningCode
    ? "Running..."
    : isPresentationMode
      ? "Presenting"
      : activeFileCanPreview
        ? "Open Preview"
        : connectionStatus !== "connected"
        ? "Connect to Run"
        : !activeFileCanExecute
          ? "Preview Only"
          : activeFileHasContent
            ? "Run"
            : "Add Code";
  const actionHint = isPresentationMode
    ? "Presentation Mode is previewing a saved workspace snapshot without mutating the live room."
    : isAskingAi
      ? `Preparing a fresh AI suggestion block for ${activeFile.name}.`
      : activeFileCanPreview
        ? `Focus the live preview for ${activeFile.name} inside the right-side IDE inspector.`
      : isRunningCode
        ? `Streaming execution output for ${activeFile.name} into the shared terminal while the workspace stays in sync.`
        : connectionStatus !== "connected"
          ? "Reconnect to resume room sync, AI requests, terminal activity, and execution."
          : !activeFileCanExecute
            ? `${activeFile.name} is preview-oriented. Switch to a runnable file like JavaScript or Python to execute code.`
            : activeFileHasContent
              ? `Editing ${activeFile.name} inside the shared workspace model.`
              : `Add some content to ${activeFile.name} to enable execution.`;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--titlebar-bg)] px-3 py-2">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--accent)]">
            iTECify
          </span>
          <StatusBadge label="room" value={roomId} tone="accent" />
          <StatusBadge label="conn" value={statusLabel} tone={connectionTone} />
          <StatusBadge label="run" value={runStatusLabel} tone={runStatusTone} />
          <StatusBadge label="team" value={`${participantCount}`} />
          <span className="inline-flex h-6 items-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            {currentUserName}
          </span>
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium text-[var(--text-primary)]">
            EXPLORER / {activeFile.path}
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Collaborative browser IDE with shared files, live preview, terminal output, and AI assistance.
          </p>
        </div>
      </div>

      <div className="space-y-1 border border-[var(--line)] bg-[var(--bg-panel)] p-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="inline-flex h-8 items-center gap-2 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2.5 text-xs text-[var(--text-secondary)]">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Lang
            </span>
            <select
              value={activeFile.language}
              onChange={(event) =>
                onLanguageChange(event.target.value as WorkspaceFileLanguage)
              }
              className="bg-transparent font-medium text-[var(--text-primary)] outline-none"
            >
              {LANGUAGE_OPTIONS.map((language) => (
                <option
                  key={language}
                  value={language}
                  className="bg-[var(--select-bg)] text-[var(--text-primary)]"
                >
                  {getWorkspaceLanguageLabel(language)}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex h-8 items-center gap-2 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2.5 text-xs text-[var(--text-secondary)]">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Theme
            </span>
            <select
              value={themeId}
              onChange={(event) => onThemeChange(event.target.value as IdeThemeId)}
              className="bg-transparent font-medium text-[var(--text-primary)] outline-none"
            >
              {IDE_THEMES.map((theme) => (
                <option
                  key={theme.id}
                  value={theme.id}
                  className="bg-[var(--select-bg)] text-[var(--text-primary)]"
                >
                  {theme.label}
                </option>
              ))}
            </select>
          </label>
          <ActionButton disabled={isAskingAi || isPresentationMode} onClick={onAskAi}>
            {isAskingAi ? "Thinking..." : "AI Assist"}
          </ActionButton>
          <ActionButton onClick={onTogglePreview}>
            {isPreviewFocused ? "Hide Preview" : "Show Preview"}
          </ActionButton>
          <ActionButton>Share</ActionButton>
          <ActionButton>Invite</ActionButton>
          <ActionButton
            accent
            disabled={!canRunCode}
            onClick={onRunCode}
          >
            {runButtonLabel}
          </ActionButton>
          <ActionButton disabled={isSigningOut} onClick={onLogout}>
            {isSigningOut ? "Signing Out..." : "Log Out"}
          </ActionButton>
        </div>
        <p className="px-1 text-right text-[11px] text-[var(--text-muted)]">
          {actionHint}
        </p>
      </div>
    </header>
  );
}

function ActivityRail({
  inspectorView,
  bottomPanelView,
  onSelectInspectorView,
  onSelectBottomPanelView,
}: {
  inspectorView: InspectorView;
  bottomPanelView: BottomPanelView;
  onSelectInspectorView: (view: InspectorView) => void;
  onSelectBottomPanelView: (view: BottomPanelView) => void;
}) {
  const buttons = [
    { id: "files", label: "EX", title: "Explorer", active: true },
    {
      id: "preview",
      label: "PR",
      title: "Preview",
      active: inspectorView === "preview",
      onClick: () => onSelectInspectorView("preview"),
    },
    {
      id: "ai",
      label: "AI",
      title: "AI Suggestions",
      active: inspectorView === "ai",
      onClick: () => onSelectInspectorView("ai"),
    },
    {
      id: "terminal",
      label: "TM",
      title: "Terminal",
      active: bottomPanelView === "terminal",
      onClick: () => onSelectBottomPanelView("terminal"),
    },
    {
      id: "output",
      label: "OP",
      title: "Output",
      active: bottomPanelView === "output",
      onClick: () => onSelectBottomPanelView("output"),
    },
    {
      id: "timeline",
      label: "TL",
      title: "Timeline",
      active: bottomPanelView === "timeline",
      onClick: () => onSelectBottomPanelView("timeline"),
    },
  ];

  return (
    <aside className="flex min-h-0 flex-col items-center gap-1 border-r border-[var(--line)] bg-[var(--activitybar-bg)] px-1 py-2">
      {buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          title={button.title}
          onClick={button.onClick}
          className={`flex h-11 w-11 items-center justify-center border-l-2 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
            button.active
              ? "border-l-[var(--accent)] bg-[var(--editor-tab-hover-bg)] text-[var(--text-primary)]"
              : "border-l-transparent text-[var(--text-muted)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)]"
          }`}
        >
          {button.label}
        </button>
      ))}
    </aside>
  );
}

type EditorPanelProps = {
  roomId: string;
  activeFile: WorkspaceFileNode;
  ideThemeId: IdeThemeId;
  openFiles: WorkspaceFileNode[];
  presentationSnapshot: RoomSnapshot | null;
  isPresentationMode: boolean;
  onSelectTab: (fileId: string) => void;
  onChange: (value: string) => void;
  onCursorChange: (position: CursorPosition) => void;
  remoteCursors: RemoteCursor[];
  onExitPresentation: () => void;
  onPreviousSnapshot: () => void;
  onNextSnapshot: () => void;
  hasPreviousSnapshot: boolean;
  hasNextSnapshot: boolean;
};

function EditorPanel({
  roomId,
  activeFile,
  ideThemeId,
  openFiles,
  presentationSnapshot,
  isPresentationMode,
  onSelectTab,
  onChange,
  onCursorChange,
  remoteCursors,
  onExitPresentation,
  onPreviousSnapshot,
  onNextSnapshot,
  hasPreviousSnapshot,
  hasNextSnapshot,
}: EditorPanelProps) {
  const isReadOnly = isPresentationMode;

  return (
    <section className="flex min-h-0 flex-col border border-[var(--line)] bg-[var(--editor-shell)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--editor-tab-bg)] px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Editor
          </p>
          <p className="mt-1 truncate font-mono text-xs text-[var(--text-secondary)]">
            {activeFile.path} · {roomId}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {isPresentationMode ? (
            <span className="border border-amber-400/14 bg-amber-400/10 px-2 py-1 font-mono text-amber-300">
              Presentation Mode
            </span>
          ) : null}
          <span className="border border-cyan-400/10 bg-cyan-400/10 px-2 py-1 font-mono text-cyan-300">
            Shared file
          </span>
          <span className="border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1 font-mono text-[var(--text-muted)]">
            {getWorkspaceLanguageLabel(activeFile.language)}
          </span>
        </div>
      </div>

      <IdeEditorTabs
        tabs={openFiles.map((file) => ({
          id: file.id,
          name: file.name,
          path: file.path,
          editable: true,
        }))}
        activeTabId={activeFile.id}
        onSelect={onSelectTab}
        disabled={isPresentationMode}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {isPresentationMode && presentationSnapshot ? (
          <div className="absolute inset-x-3 top-3 z-20 border border-[rgba(245,158,11,0.16)] bg-[var(--overlay-panel)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-300">
                  Presentation Mode
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                  {presentationSnapshot.label}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Replay snapshot preview for live walkthroughs. The shared workspace stays unchanged until restore.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPreviousSnapshot}
                  onClick={onPreviousSnapshot}
                  className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!hasNextSnapshot}
                  onClick={onNextSnapshot}
                  className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={onExitPresentation}
                  className="border border-[rgba(245,158,11,0.18)] bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-300 transition hover:border-[rgba(245,158,11,0.28)] hover:bg-amber-400/14"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <CollaborativeEditor
          ideTheme={ideThemeId}
          readOnly={isReadOnly}
          language={toMonacoLanguage(activeFile.language)}
          value={activeFile.content}
          onChange={onChange}
          onCursorChange={onCursorChange}
          remoteCursors={isReadOnly ? [] : remoteCursors}
        />
      </div>
    </section>
  );
}

function createLocalParticipant(name: string): Participant {
  return {
    socketId: "local-user",
    name,
  };
}

type WorkspaceShellProps = {
  roomId: string;
  currentUserName: string;
};

export function WorkspaceShell({
  roomId,
  currentUserName,
}: WorkspaceShellProps) {
  const { signOutUser } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    createFallbackWorkspace(),
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [participants, setParticipants] = useState<Participant[]>(() => [
    createLocalParticipant(currentUserName),
  ]);
  const [aiBlocks, setAiBlocks] = useState<AiBlock[]>([]);
  const [snapshots, setSnapshots] = useState<RoomSnapshot[]>([]);
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [consoleStatus, setConsoleStatus] = useState<RunCodeStatus>("idle");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [currentSocketId, setCurrentSocketId] = useState<string | null>(null);
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [inspectorView, setInspectorView] =
    useState<InspectorView>("preview");
  const [bottomPanelView, setBottomPanelView] =
    useState<BottomPanelView>("terminal");
  const [ideThemeId, setIdeThemeId] = useState<IdeThemeId>(() =>
    getStoredIdeTheme(),
  );
  const socketRef = useRef<ItecifySocket | null>(null);
  const isRunningCodeRef = useRef(false);
  const pendingFileUpdateRef = useRef<PendingFileUpdate | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteFileIdRef = useRef<string | null>(null);
  const latestCursorRef = useRef<{ fileId: string; position: CursorPosition } | null>(
    null,
  );
  const activeRunIdRef = useRef<string | null>(null);
  const currentUserNameRef = useRef(currentUserName);
  const joinedParticipantNameRef = useRef<string | null>(null);

  const liveActiveFile =
    getWorkspaceFile(workspace, workspace.activeFileId) ??
    getWorkspaceFiles(workspace)[0];
  const presentationSnapshot =
    isPresentationMode
      ? snapshots.find((snapshot) => snapshot.id === previewSnapshotId) ?? null
      : null;
  const displayedWorkspace = presentationSnapshot?.workspace ?? workspace;
  const displayedActiveFile =
    getWorkspaceFile(displayedWorkspace, displayedWorkspace.activeFileId) ??
    getWorkspaceFiles(displayedWorkspace)[0] ??
    liveActiveFile;
  const displayedOpenFiles = displayedWorkspace.openFileIds
    .map((fileId) => getWorkspaceFile(displayedWorkspace, fileId))
    .filter((file): file is WorkspaceFileNode => Boolean(file));
  const visibleRemoteCursors = liveActiveFile
    ? remoteCursors.filter((cursor) => cursor.fileId === liveActiveFile.id)
    : [];
  const canRunCode =
    !isPresentationMode &&
    !isRunningCode &&
    Boolean(liveActiveFile) &&
    (
      liveActiveFile.language === "html" ||
      (
        connectionStatus === "connected" &&
        Boolean(liveActiveFile.executionRuntime) &&
        liveActiveFile.content.trim().length > 0
      )
    );
  const presentationSnapshotIndex = presentationSnapshot
    ? snapshots.findIndex((snapshot) => snapshot.id === presentationSnapshot.id)
    : -1;

  useEffect(() => {
    isRunningCodeRef.current = isRunningCode;
  }, [isRunningCode]);

  useEffect(() => {
    persistIdeTheme(ideThemeId);
  }, [ideThemeId]);

  useEffect(() => {
    if (
      previewSnapshotId &&
      !snapshots.some((snapshot) => snapshot.id === previewSnapshotId)
    ) {
      setPreviewSnapshotId(snapshots[0]?.id ?? null);
      setIsPresentationMode(false);
    }

    if (!previewSnapshotId && snapshots.length > 0) {
      setPreviewSnapshotId(snapshots[0].id);
    }
  }, [previewSnapshotId, snapshots]);

  useEffect(() => {
    currentUserNameRef.current = currentUserName;
    setParticipants((currentParticipants) => {
      if (currentSocketId) {
        return currentParticipants.map((participant) =>
          participant.socketId === currentSocketId
            ? { ...participant, name: currentUserName }
            : participant,
        );
      }

      if (currentParticipants.length === 0) {
        return [createLocalParticipant(currentUserName)];
      }

      return currentParticipants.map((participant, index) =>
        index === 0 && participant.socketId === "local-user"
          ? { ...participant, name: currentUserName }
          : participant,
      );
    });
  }, [currentSocketId, currentUserName]);

  function clearScheduledSync() {
    if (!syncTimerRef.current) {
      return;
    }

    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = null;
  }

  function flushPendingFileUpdate() {
    clearScheduledSync();

    const pendingFileUpdate = pendingFileUpdateRef.current;
    const socket = socketRef.current;

    if (!pendingFileUpdate || !socket?.connected) {
      return;
    }

    pendingFileUpdateRef.current = null;
    socket.emit("workspace:file:update", {
      roomId,
      fileId: pendingFileUpdate.fileId,
      content: pendingFileUpdate.content,
    });
  }

  function scheduleFileSync() {
    if (syncTimerRef.current) {
      return;
    }

    syncTimerRef.current = setTimeout(() => {
      flushPendingFileUpdate();
    }, DOCUMENT_SYNC_DELAY_MS);
  }

  const applyRemoteFileUpdate = useCallback((fileId: string, content: string) => {
    clearScheduledSync();

    if (pendingFileUpdateRef.current?.fileId === fileId) {
      pendingFileUpdateRef.current = null;
    }

    applyingRemoteFileIdRef.current = fileId;
    setWorkspace((currentWorkspace) =>
      updateWorkspaceFileContent(currentWorkspace, fileId, content),
    );

    queueMicrotask(() => {
      applyingRemoteFileIdRef.current = null;
    });
  }, []);

  const appendRunOutput = useCallback((payload: RunOutputPayload) => {
    if (!payload.chunk.trim()) {
      return;
    }

    const nextEntry = createConsoleEntry(
      payload.stream,
      payload.chunk,
      `${payload.runId}-${payload.timestamp}`,
    );

    setConsoleEntries((currentEntries) => {
      if (activeRunIdRef.current !== payload.runId) {
        activeRunIdRef.current = payload.runId;
        return [nextEntry];
      }

      return [...currentEntries, nextEntry];
    });

    setConsoleStatus("running");
    setIsRunningCode(true);
  }, []);

  const completeRun = useCallback((payload: RunDonePayload) => {
    if (activeRunIdRef.current && activeRunIdRef.current !== payload.runId) {
      return;
    }

    activeRunIdRef.current = payload.runId;
    setConsoleEntries((currentEntries) => [
      ...currentEntries,
      createConsoleEntry(
        "system",
        payload.status === "completed"
          ? `Run completed with exit code ${payload.exitCode}.`
          : `Run failed with exit code ${payload.exitCode}.`,
        `${payload.runId}-done`,
      ),
    ]);
    setConsoleStatus(payload.status === "completed" ? "completed" : "error");
    setIsRunningCode(false);
  }, []);

  useEffect(() => {
    const socket = createSocketClient();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("connected");
      setCurrentSocketId(socket.id ?? null);
      joinedParticipantNameRef.current = currentUserNameRef.current;
      socket.emit("room:join", {
        roomId,
        name: currentUserNameRef.current,
      });
    });

    socket.on("disconnect", () => {
      const didInterruptActiveRun = isRunningCodeRef.current;

      setConnectionStatus("disconnected");
      setCurrentSocketId(null);
      setIsAskingAi(false);
      setIsRunningCode(false);
      setRemoteCursors([]);
      setParticipants([createLocalParticipant(currentUserNameRef.current)]);
      joinedParticipantNameRef.current = null;

      if (didInterruptActiveRun) {
        activeRunIdRef.current = null;
        setConsoleStatus("error");
        setConsoleEntries((currentEntries) => [
          ...currentEntries,
          createConsoleEntry(
            "stderr",
            "Connection lost while the run was in progress.",
            `run-disconnect-${Date.now()}`,
          ),
        ]);
      }
    });

    socket.on("room:state", (room) => {
      clearScheduledSync();
      pendingFileUpdateRef.current = null;
      setWorkspace(room.workspace);
      setParticipants(room.participants);
      setAiBlocks(room.aiBlocks);
      setSnapshots(room.snapshots);
      setTerminalEntries(room.terminalEntries);
      setIsAskingAi(false);
      setRemoteCursors((currentCursors) =>
        currentCursors.filter((cursor) =>
          room.participants.some(
            (participant: Participant) => participant.socketId === cursor.socketId,
          ),
        ),
      );
    });

    socket.on("room:participants", (nextParticipants) => {
      setParticipants(
        nextParticipants.length > 0
          ? nextParticipants
          : [createLocalParticipant(currentUserNameRef.current)],
      );
      setRemoteCursors((currentCursors) =>
        currentCursors.filter((cursor) =>
          nextParticipants.some(
            (participant: Participant) => participant.socketId === cursor.socketId,
          ),
        ),
      );
    });

    socket.on("workspace:file:updated", ({ fileId, content }) => {
      applyRemoteFileUpdate(fileId, content);
    });

    socket.on("workspace:view", ({ roomId: updatedRoomId, activeFileId, openFileIds }) => {
      if (updatedRoomId !== roomId) {
        return;
      }

      setWorkspace((currentWorkspace) =>
        updateWorkspaceView(currentWorkspace, activeFileId, openFileIds),
      );
    });

    socket.on(
      "workspace:file:language",
      ({ roomId: updatedRoomId, fileId, language }) => {
        if (updatedRoomId !== roomId) {
          return;
        }

        setWorkspace((currentWorkspace) =>
          updateWorkspaceFileLanguage(currentWorkspace, fileId, language),
        );
      },
    );

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

    socket.on("run:output", (payload) => {
      if (payload.roomId !== roomId) {
        return;
      }

      appendRunOutput(payload);
    });

    socket.on("run:done", (payload) => {
      if (payload.roomId !== roomId) {
        return;
      }

      completeRun(payload);
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
      setAiBlocks((currentBlocks) => {
        const hasExistingBlock = currentBlocks.some(
          (currentBlock) => currentBlock.id === block.id,
        );
        const nextBlocks = hasExistingBlock
          ? currentBlocks.map((currentBlock) =>
              currentBlock.id === block.id ? block : currentBlock,
            )
          : [...currentBlocks, block];

        return nextBlocks.sort((left, right) =>
          left.createdAt.localeCompare(right.createdAt),
        );
      });
    });

    socket.on("snapshot:created", ({ snapshot }) => {
      setSnapshots((currentSnapshots) => {
        const nextSnapshots = [
          snapshot,
          ...currentSnapshots.filter(
            (currentSnapshot) => currentSnapshot.id !== snapshot.id,
          ),
        ];

        return nextSnapshots.slice(0, 12);
      });
    });

    socket.on("terminal:entry", ({ entry }) => {
      setTerminalEntries((currentEntries) => [...currentEntries, entry].slice(-60));
    });

    socket.connect();

    return () => {
      clearScheduledSync();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [appendRunOutput, applyRemoteFileUpdate, completeRun, roomId]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket?.connected) {
      return;
    }

    if (joinedParticipantNameRef.current === currentUserName) {
      return;
    }

    joinedParticipantNameRef.current = currentUserName;
    socket.emit("room:join", {
      roomId,
      name: currentUserName,
    });
  }, [currentUserName, roomId]);

  function emitWorkspaceView(nextWorkspace: WorkspaceState) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:view:update", {
      roomId,
      activeFileId: nextWorkspace.activeFileId,
      openFileIds: nextWorkspace.openFileIds,
    });
  }

  function handleEditorChange(nextValue: string) {
    if (!liveActiveFile) {
      return;
    }

    if (applyingRemoteFileIdRef.current === liveActiveFile.id) {
      return;
    }

    if (nextValue === liveActiveFile.content) {
      return;
    }

    setWorkspace((currentWorkspace) =>
      updateWorkspaceFileContent(currentWorkspace, liveActiveFile.id, nextValue),
    );
    pendingFileUpdateRef.current = {
      fileId: liveActiveFile.id,
      content: nextValue,
    };
    scheduleFileSync();
  }

  function handleCursorChange(position: CursorPosition) {
    if (!liveActiveFile) {
      return;
    }

    if (
      latestCursorRef.current?.fileId === liveActiveFile.id &&
      latestCursorRef.current.position.lineNumber === position.lineNumber &&
      latestCursorRef.current.position.column === position.column
    ) {
      return;
    }

    latestCursorRef.current = {
      fileId: liveActiveFile.id,
      position,
    };

    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("cursor:update", {
      roomId,
      fileId: liveActiveFile.id,
      position,
    });
  }

  function handleAskAi() {
    if (!socketRef.current?.connected || isAskingAi || !liveActiveFile) {
      return;
    }

    setInspectorView("ai");
    setIsAskingAi(true);
    socketRef.current.emit("ai:block:create", {
      roomId,
      fileId: liveActiveFile.id,
      prompt: "Review the current hackathon MVP file and suggest a practical next improvement.",
      code: liveActiveFile.content,
    });
  }

  function handleTogglePreview() {
    setInspectorView((currentView) =>
      currentView === "preview" ? "ai" : "preview",
    );
  }

  function handleThemeChange(nextThemeId: IdeThemeId) {
    setIdeThemeId(nextThemeId);
  }

  function handleLanguageChange(nextLanguage: WorkspaceFileLanguage) {
    if (!liveActiveFile || nextLanguage === liveActiveFile.language) {
      return;
    }

    setWorkspace((currentWorkspace) =>
      updateWorkspaceFileLanguage(currentWorkspace, liveActiveFile.id, nextLanguage),
    );

    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:file:language", {
      roomId,
      fileId: liveActiveFile.id,
      language: nextLanguage,
    });
  }

  async function handleRunCode() {
    if (!canRunCode || !liveActiveFile) {
      return;
    }

    if (liveActiveFile.language === "html") {
      setInspectorView("preview");
      return;
    }

    if (!socketRef.current?.connected) {
      return;
    }

    flushPendingFileUpdate();
    setBottomPanelView("terminal");
    activeRunIdRef.current = null;
    setConsoleEntries([]);
    setConsoleStatus("running");
    setIsRunningCode(true);
    socketRef.current.emit("code:run", {
      roomId,
      fileId: liveActiveFile.id,
    });
  }

  function updateAiBlockStatus(blockId: string, status: AiBlock["status"]) {
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
    const block = aiBlocks.find((currentBlock) => currentBlock.id === blockId);

    if (!socketRef.current?.connected || block?.status !== "pending") {
      return;
    }

    updateAiBlockStatus(blockId, "accepted");
    socketRef.current.emit("ai:block:accept", {
      roomId,
      blockId,
    });
  }

  function handleRejectAiBlock(blockId: string) {
    const block = aiBlocks.find((currentBlock) => currentBlock.id === blockId);

    if (!socketRef.current?.connected || block?.status !== "pending") {
      return;
    }

    updateAiBlockStatus(blockId, "rejected");
    socketRef.current.emit("ai:block:reject", {
      roomId,
      blockId,
    });
  }

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await signOutUser();
    } finally {
      setIsSigningOut(false);
    }
  }

  function handlePreviewSnapshot(snapshotId: string) {
    setBottomPanelView("timeline");
    setPreviewSnapshotId(snapshotId);
  }

  function handleTogglePresentation() {
    if (snapshots.length === 0) {
      return;
    }

    setPreviewSnapshotId((currentId) => currentId ?? snapshots[0]?.id ?? null);
    setIsPresentationMode((currentMode) => !currentMode);
  }

  function handleExitPresentation() {
    setIsPresentationMode(false);
  }

  function handlePreviousPresentationSnapshot() {
    if (
      presentationSnapshotIndex < 0 ||
      presentationSnapshotIndex >= snapshots.length - 1
    ) {
      return;
    }

    setPreviewSnapshotId(snapshots[presentationSnapshotIndex + 1].id);
  }

  function handleNextPresentationSnapshot() {
    if (presentationSnapshotIndex <= 0) {
      return;
    }

    setPreviewSnapshotId(snapshots[presentationSnapshotIndex - 1].id);
  }

  function handleRestoreSnapshot(snapshotId: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    setPreviewSnapshotId(snapshotId);
    socketRef.current.emit("snapshot:restore", {
      roomId,
      snapshotId,
    });
  }

  function handleTerminalCommand(command: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("terminal:command", {
      roomId,
      command,
    });
  }

  function handleSelectFile(fileId: string) {
    if (isPresentationMode) {
      return;
    }

    flushPendingFileUpdate();

    const nextWorkspace = updateWorkspaceView(workspace, fileId, [
      ...workspace.openFileIds,
      fileId,
    ]);
    setWorkspace(nextWorkspace);
    emitWorkspaceView(nextWorkspace);
  }

  const connectionLabel =
    connectionStatus === "connected"
      ? "Connected"
      : connectionStatus === "connecting"
        ? "Connecting"
        : "Disconnected";

  return (
    <main
      className="ide-theme-root min-h-screen text-[var(--text-primary)]"
      data-ide-theme={ideThemeId}
    >
      <div className="mx-auto flex min-h-screen max-w-none flex-col overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
        <TopBar
          currentUserName={currentUserName}
          connectionStatus={connectionStatus}
          consoleStatus={consoleStatus}
          activeFile={liveActiveFile}
          participantCount={participants.length}
          roomId={roomId}
          isAskingAi={isAskingAi}
          canRunCode={canRunCode}
          isRunningCode={isRunningCode}
          isSigningOut={isSigningOut}
          isPresentationMode={isPresentationMode}
          isPreviewFocused={inspectorView === "preview"}
          themeId={ideThemeId}
          onAskAi={handleAskAi}
          onLanguageChange={handleLanguageChange}
          onThemeChange={handleThemeChange}
          onTogglePreview={handleTogglePreview}
          onRunCode={handleRunCode}
          onLogout={handleLogout}
        />
        <ParticipantsBar
          participants={participants}
          currentUserName={currentUserName}
          currentUserSocketId={currentSocketId}
        />

        <div className="grid flex-1 grid-cols-[48px_minmax(220px,240px)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_260px] overflow-hidden">
          <div className="row-span-2">
            <ActivityRail
              inspectorView={inspectorView}
              bottomPanelView={bottomPanelView}
              onSelectInspectorView={setInspectorView}
              onSelectBottomPanelView={setBottomPanelView}
            />
          </div>

          <div className="min-h-0 border-r border-[var(--line)]">
            <IdeFileExplorer
              roomId={roomId}
              workspace={workspace}
              activeFileId={workspace.activeFileId}
              onSelect={handleSelectFile}
            />
          </div>

          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_360px]">
            <EditorPanel
              roomId={roomId}
              activeFile={displayedActiveFile}
              ideThemeId={ideThemeId}
              openFiles={displayedOpenFiles}
              presentationSnapshot={presentationSnapshot}
              isPresentationMode={isPresentationMode}
              onSelectTab={handleSelectFile}
              onChange={handleEditorChange}
              onCursorChange={handleCursorChange}
              remoteCursors={visibleRemoteCursors}
              onExitPresentation={handleExitPresentation}
              onPreviousSnapshot={handlePreviousPresentationSnapshot}
              onNextSnapshot={handleNextPresentationSnapshot}
              hasPreviousSnapshot={presentationSnapshotIndex < snapshots.length - 1}
              hasNextSnapshot={presentationSnapshotIndex > 0}
            />

            <div className="min-h-0 border-l border-[var(--line)]">
              <IdeSidePanel
                title="Inspector"
                subtitle="Preview and AI tools stay docked to the right, like a real IDE side view."
                tabs={[
                  { id: "preview", label: "Preview" },
                  { id: "ai", label: "AI Suggestions" },
                ]}
                activeTabId={inspectorView}
                onSelectTab={(view) => setInspectorView(view as InspectorView)}
              >
                <div className="h-full min-h-0">
                  {inspectorView === "preview" ? (
                    <IdePreviewPanel
                      activeFile={liveActiveFile}
                      workspace={workspace}
                      connectionLabel={connectionLabel}
                      participantCount={participants.length}
                      snapshotCount={snapshots.length}
                      terminalEntryCount={terminalEntries.length}
                      isRunningCode={isRunningCode}
                    />
                  ) : null}

                  {inspectorView === "ai" ? (
                    <AiSuggestionsPanel
                      blocks={aiBlocks}
                      isLoading={isAskingAi}
                      onAccept={handleAcceptAiBlock}
                      onReject={handleRejectAiBlock}
                    />
                  ) : null}
                </div>
              </IdeSidePanel>
            </div>
          </div>

          <div className="min-h-0 border-t border-[var(--line)] lg:col-[2/4]">
            <IdeBottomPanel
              activeTab={bottomPanelView}
              onSelectTab={setBottomPanelView}
              terminalEntries={terminalEntries}
              canSubmitTerminal={connectionStatus === "connected"}
              onSubmitTerminal={handleTerminalCommand}
              consoleEntries={consoleEntries}
              consoleStatus={consoleStatus}
              snapshots={snapshots}
              previewSnapshotId={previewSnapshotId}
              liveWorkspace={workspace}
              canRestoreSnapshot={connectionStatus === "connected"}
              isPresentationMode={isPresentationMode}
              onPreviewSnapshot={handlePreviewSnapshot}
              onRestoreSnapshot={handleRestoreSnapshot}
              onTogglePresentation={handleTogglePresentation}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
