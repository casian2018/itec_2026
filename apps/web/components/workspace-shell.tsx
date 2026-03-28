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
  applyWorkspaceTreeUpdate,
  createFallbackWorkspace,
  getFileExecutionRoute,
  getFileIcon,
  getWorkspaceFile,
  getWorkspaceFiles,
  getWorkspaceLanguageLabel,
  toMonacoLanguage,
  updateWorkspaceFileContent,
  updateWorkspaceFileLanguage,
} from "@/lib/workspace";
import {
  formatSessionCodeForDisplay,
  uploadSessionProjectZip,
} from "@/lib/session";
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

type EditorViewState = {
  activeFileId: string;
  openFileIds: string[];
};

type ProjectImportState = {
  isImporting: boolean;
  progress: number | null;
  message: string | null;
};

type TopBarProps = {
  currentUserName: string;
  connectionStatus: ConnectionStatus;
  consoleStatus: RunCodeStatus;
  participantCount: number;
  roomId: string;
  isSigningOut: boolean;
  themeId: IdeThemeId;
  onThemeChange: (themeId: IdeThemeId) => void;
  onLogout: () => void;
};

const LANGUAGE_OPTIONS: WorkspaceFileLanguage[] = [
  "javascript",
  "typescript",
  "python",
  "c",
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
  participantCount,
  roomId,
  isSigningOut,
  themeId,
  onThemeChange,
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

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--titlebar-bg)] px-3 py-2">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--accent)]">
            iTECify
          </span>
          <StatusBadge
            label="session"
            value={formatSessionCodeForDisplay(roomId)}
            tone="accent"
          />
          <StatusBadge label="conn" value={statusLabel} tone={connectionTone} />
          <StatusBadge label="run" value={runStatusLabel} tone={runStatusTone} />
          <StatusBadge label="team" value={`${participantCount}`} />
          <span className="inline-flex h-6 items-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            {currentUserName}
          </span>
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium text-[var(--text-primary)]">
            EXPLORER / Collaborative Session
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
          <ActionButton>Share</ActionButton>
          <ActionButton>Invite</ActionButton>
          <ActionButton disabled={isSigningOut} onClick={onLogout}>
            {isSigningOut ? "Signing Out..." : "Log Out"}
          </ActionButton>
        </div>
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
  activeFile: WorkspaceFileNode | null;
  hasFiles: boolean;
  isEmptyWorkspacePromptDismissed: boolean;
  connectionStatus: ConnectionStatus;
  ideThemeId: IdeThemeId;
  openFiles: WorkspaceFileNode[];
  canRunCode: boolean;
  canFormatFile: boolean;
  isAskingAi: boolean;
  projectImportState: ProjectImportState;
  isRunningCode: boolean;
  isPreviewFocused: boolean;
  presentationSnapshot: RoomSnapshot | null;
  isPresentationMode: boolean;
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  onChange: (value: string) => void;
  onCursorChange: (position: CursorPosition) => void;
  onAskAi: () => void;
  onFormatFile: () => void;
  onLanguageChange: (language: WorkspaceFileLanguage) => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDismissEmptyWorkspacePrompt: () => void;
  onTogglePreview: () => void;
  onUploadProjectZip: () => void;
  onRunCode: () => void;
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
  hasFiles,
  isEmptyWorkspacePromptDismissed,
  connectionStatus,
  ideThemeId,
  openFiles,
  canRunCode,
  canFormatFile,
  isAskingAi,
  projectImportState,
  isRunningCode,
  isPreviewFocused,
  presentationSnapshot,
  isPresentationMode,
  onSelectTab,
  onCloseTab,
  onChange,
  onCursorChange,
  onAskAi,
  onFormatFile,
  onLanguageChange,
  onCreateFile,
  onCreateFolder,
  onDismissEmptyWorkspacePrompt,
  onTogglePreview,
  onUploadProjectZip,
  onRunCode,
  remoteCursors,
  onExitPresentation,
  onPreviousSnapshot,
  onNextSnapshot,
  hasPreviousSnapshot,
  hasNextSnapshot,
}: EditorPanelProps) {
  const isReadOnly = isPresentationMode;
  const activeFileCanPreview =
    activeFile ? getFileExecutionRoute(activeFile) === "preview" : false;
  const activeFileCanExecute =
    activeFile
      ? (() => {
          const route = getFileExecutionRoute(activeFile);
          return route !== "unsupported" && route !== "preview";
        })()
      : false;
  const runButtonLabel = isRunningCode
    ? "Running..."
    : !activeFile
      ? "Open File"
      : activeFileCanPreview
        ? "Open Preview"
        : connectionStatus !== "connected"
          ? "Connect to Run"
          : activeFileCanExecute
            ? "Run"
            : "Run";
  const actionHint = isPresentationMode
    ? "Presentation mode este doar pentru preview și nu rulează fișiere."
    : projectImportState.isImporting
      ? `Importing ZIP into session ${roomId}${projectImportState.progress !== null ? ` (${projectImportState.progress}%)` : ""}.`
    : !activeFile
      ? "Sessionul este gol. Importa un ZIP sau creeaza fisiere noi direct din IDE."
      : isAskingAi
        ? `Gemini pregătește o sugestie pentru ${activeFile.name}.`
        : isRunningCode
          ? `Rulează ${activeFile.name} din editorul tău curent.`
          : `Run folosește fișierul activ local: ${activeFile.name}.`;

  return (
    <section className="flex min-h-0 flex-col border border-[var(--line)] bg-[var(--editor-shell)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--editor-tab-bg)] px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Editor
          </p>
          <p className="mt-1 truncate font-mono text-xs text-[var(--text-secondary)]">
            {(activeFile?.path ?? "No file open") + ` · ${roomId}`}
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
          {activeFile ? (
            <span className="border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1 font-mono text-[var(--text-muted)]">
              {getWorkspaceLanguageLabel(activeFile.language)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-b border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="inline-flex h-8 items-center gap-2 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2.5 text-xs text-[var(--text-secondary)]">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Lang
            </span>
            <select
              value={activeFile?.language ?? "plaintext"}
              onChange={(event) =>
                onLanguageChange(event.target.value as WorkspaceFileLanguage)
              }
              disabled={!activeFile || isPresentationMode}
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
          <ActionButton disabled={isAskingAi || isPresentationMode} onClick={onAskAi}>
            {isAskingAi ? "Thinking..." : "AI Assist"}
          </ActionButton>
          <ActionButton
            disabled={projectImportState.isImporting || isPresentationMode}
            onClick={onUploadProjectZip}
          >
            {projectImportState.isImporting
              ? projectImportState.progress !== null
                ? `Uploading ${projectImportState.progress}%`
                : "Uploading..."
              : "Upload Project ZIP"}
          </ActionButton>
          <ActionButton disabled={!canFormatFile} onClick={onFormatFile}>
            Format
          </ActionButton>
          <ActionButton disabled={isPresentationMode} onClick={onTogglePreview}>
            {isPreviewFocused ? "Hide Preview" : "Show Preview"}
          </ActionButton>
          <ActionButton accent disabled={!canRunCode} onClick={onRunCode}>
            {runButtonLabel}
          </ActionButton>
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">{actionHint}</p>
        {projectImportState.message ? (
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            {projectImportState.message}
          </p>
        ) : null}
      </div>

      <IdeEditorTabs
        tabs={openFiles.map((file) => ({
          id: file.id,
          name: file.name,
          path: file.path,
          icon: getFileIcon(file.language),
          extension: file.name.includes(".")
            ? `.${file.name.split(".").pop() ?? ""}`
            : undefined,
          editable: true,
        }))}
        activeTabId={activeFile?.id ?? ""}
        onSelect={onSelectTab}
        onClose={onCloseTab}
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

        {activeFile ? (
          <CollaborativeEditor
            ideTheme={ideThemeId}
            readOnly={isReadOnly}
            language={toMonacoLanguage(activeFile.language)}
            value={activeFile.content}
            onChange={onChange}
            onCursorChange={onCursorChange}
            remoteCursors={isReadOnly ? [] : remoteCursors}
          />
        ) : (
          <div className="flex h-full min-h-[320px] items-center justify-center bg-[var(--editor-shell)]">
            {hasFiles || !isEmptyWorkspacePromptDismissed ? (
              <div className="max-w-lg border border-[var(--line)] bg-[var(--empty-overlay)] px-5 py-4 text-left">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {hasFiles ? "No Open Tabs" : "Empty Session Workspace"}
                    </p>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">
                      {hasFiles
                        ? "The editor has no active tab."
                        : "This collaborative room starts with no project files."}
                    </p>
                  </div>
                  {!hasFiles ? (
                    <button
                      type="button"
                      onClick={onDismissEmptyWorkspacePrompt}
                      className="inline-flex h-7 w-7 items-center justify-center border border-[var(--line)] bg-[var(--bg-panel-soft)] text-sm text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
                      title="Close empty workspace prompt"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                  {hasFiles
                    ? "Select a file from the explorer to reopen it, or create a new file in the workspace."
                    : "Upload a project ZIP to import a full codebase into this session, or create a file or folder manually."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton
                    accent
                    disabled={projectImportState.isImporting}
                    onClick={onUploadProjectZip}
                  >
                    {projectImportState.isImporting ? "Uploading ZIP..." : "Upload Project ZIP"}
                  </ActionButton>
                  <ActionButton onClick={onCreateFile}>New File</ActionButton>
                  <ActionButton onClick={onCreateFolder}>New Folder</ActionButton>
                </div>
              </div>
            ) : (
              <div className="border border-[var(--line)] bg-[var(--empty-overlay)] px-4 py-3 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Workspace Empty
                </p>
                <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
                  Use the explorer controls above to upload or create files.
                </p>
              </div>
            )}
          </div>
        )}
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

function normalizeEditorViewState(
  workspace: WorkspaceState,
  currentView: EditorViewState | null,
  preferredView?: Partial<EditorViewState>,
): EditorViewState {
  const validFileIds = new Set(getWorkspaceFiles(workspace).map((file) => file.id));
  const preferredActiveFileId =
    preferredView?.activeFileId && validFileIds.has(preferredView.activeFileId)
      ? preferredView.activeFileId
      : null;
  const currentActiveFileId =
    currentView?.activeFileId && validFileIds.has(currentView.activeFileId)
      ? currentView.activeFileId
      : null;
  const activeFileId =
    preferredActiveFileId ??
    currentActiveFileId ??
    (validFileIds.has(workspace.activeFileId) &&
    workspace.openFileIds.includes(workspace.activeFileId)
      ? workspace.activeFileId
      : null) ??
    "";

  const nextOpenFileIds = [
    ...(preferredView?.openFileIds ?? []),
    ...(currentView?.openFileIds ?? []),
    ...workspace.openFileIds,
  ].filter(
    (openFileId, index, collection) =>
      validFileIds.has(openFileId) && collection.indexOf(openFileId) === index,
  );

  if (activeFileId && !nextOpenFileIds.includes(activeFileId)) {
    nextOpenFileIds.unshift(activeFileId);
  }

  return {
    activeFileId,
    openFileIds: nextOpenFileIds,
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
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
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
  const [projectImportState, setProjectImportState] = useState<ProjectImportState>({
    isImporting: false,
    progress: null,
    message: null,
  });
  const [isEmptyWorkspacePromptDismissed, setIsEmptyWorkspacePromptDismissed] =
    useState(false);
  const [editorView, setEditorView] = useState<EditorViewState>(() =>
    normalizeEditorViewState(createFallbackWorkspace(), null),
  );
  const socketRef = useRef<ItecifySocket | null>(null);
  const projectZipInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<WorkspaceState>(createFallbackWorkspace());
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

  const liveActiveFile = getWorkspaceFile(workspace, editorView.activeFileId);
  const workspaceFiles = getWorkspaceFiles(workspace);
  const inspectorActiveFile = liveActiveFile ?? workspaceFiles[0] ?? null;
  const presentationSnapshot =
    isPresentationMode
      ? snapshots.find((snapshot) => snapshot.id === previewSnapshotId) ?? null
      : null;
  const displayedWorkspace = presentationSnapshot?.workspace ?? workspace;
  const displayedActiveFile = getWorkspaceFile(
    displayedWorkspace,
    isPresentationMode ? displayedWorkspace.activeFileId : editorView.activeFileId,
  );
  const displayedOpenFiles = (isPresentationMode
    ? displayedWorkspace.openFileIds
    : editorView.openFileIds)
    .map((fileId) => getWorkspaceFile(displayedWorkspace, fileId))
    .filter((file): file is WorkspaceFileNode => Boolean(file));
  const visibleRemoteCursors = liveActiveFile
    ? remoteCursors.filter((cursor) => cursor.fileId === liveActiveFile.id)
    : [];
  const liveActiveFileExecutionRoute = liveActiveFile
    ? getFileExecutionRoute(liveActiveFile)
    : "unsupported";
  const liveActiveFileCanPreview = liveActiveFileExecutionRoute === "preview";
  const canRunCode =
    !isPresentationMode &&
    !isRunningCode &&
    !!liveActiveFile &&
    connectionStatus === "connected" &&
    (
      liveActiveFileCanPreview ||
      (
        liveActiveFileExecutionRoute !== "unsupported" &&
        liveActiveFile.content.trim().length > 0
      )
    );
  const canFormatFile =
    !isPresentationMode &&
    !!liveActiveFile &&
    [
      "javascript",
      "typescript",
      "html",
      "css",
      "json",
      "markdown",
    ].includes(liveActiveFile.language);
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
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    const nextWorkspace = createFallbackWorkspace();

    clearScheduledSync();
    pendingFileUpdateRef.current = null;
    applyingRemoteFileIdRef.current = null;
    latestCursorRef.current = null;
    activeRunIdRef.current = null;
    joinedParticipantNameRef.current = null;
    workspaceRef.current = nextWorkspace;
    setWorkspace(nextWorkspace);
    setEditorView(normalizeEditorViewState(nextWorkspace, null));
    setConnectionStatus("connecting");
    setParticipants([createLocalParticipant(currentUserNameRef.current)]);
    setAiBlocks([]);
    setSnapshots([]);
    setTerminalEntries([]);
    setIsAskingAi(false);
    setAiErrorMessage(null);
    setIsRunningCode(false);
    setConsoleStatus("idle");
    setConsoleEntries([]);
    setRemoteCursors([]);
    setCurrentSocketId(null);
    setPreviewSnapshotId(null);
    setIsPresentationMode(false);
    setInspectorView("preview");
    setBottomPanelView("terminal");
    setProjectImportState({
      isImporting: false,
      progress: null,
      message: null,
    });
  }, [roomId]);

  useEffect(() => {
    setIsEmptyWorkspacePromptDismissed(false);
  }, [roomId]);

  useEffect(() => {
    if (workspaceFiles.length > 0) {
      setIsEmptyWorkspacePromptDismissed(false);
    }
  }, [workspaceFiles.length]);

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

  function emitWorkspaceViewUpdate(nextView: EditorViewState) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:view:update", {
      roomId,
      activeFileId: nextView.activeFileId,
      openFileIds: nextView.openFileIds,
    });
  }

  function emitWorkspacePreviewUpdate(
    isVisible: boolean,
    targetFileId: string | null,
  ) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:preview:update", {
      roomId,
      isVisible,
      targetFileId,
    });
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
      if (room.roomId !== roomId) {
        return;
      }

      clearScheduledSync();
      pendingFileUpdateRef.current = null;
      workspaceRef.current = room.workspace;
      setWorkspace(room.workspace);
      setEditorView((currentView) =>
        normalizeEditorViewState(room.workspace, currentView, room.workspace),
      );
      setParticipants(room.participants);
      setAiBlocks(room.aiBlocks);
      setSnapshots(room.snapshots);
      setTerminalEntries(room.terminalEntries);
      setIsAskingAi(false);
      setInspectorView(room.ui?.preview?.isVisible ? "preview" : "ai");
      if (
        room.ui?.theme &&
        IDE_THEMES.some((theme) => theme.id === room.ui?.theme)
      ) {
        setIdeThemeId(room.ui.theme as IdeThemeId);
      }
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

      setEditorView((currentView) =>
        normalizeEditorViewState(workspaceRef.current, currentView, {
          activeFileId,
          openFileIds,
        }),
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

    socket.on("workspace:preview", ({ roomId: updatedRoomId, preview }) => {
      if (updatedRoomId !== roomId) {
        return;
      }

      setInspectorView(preview.isVisible ? "preview" : "ai");
    });

    socket.on("workspace:theme", ({ roomId: updatedRoomId, theme }) => {
      if (
        updatedRoomId !== roomId ||
        !IDE_THEMES.some((currentTheme) => currentTheme.id === theme)
      ) {
        return;
      }

      setIdeThemeId(theme as IdeThemeId);
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
      setAiErrorMessage(null);
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

    socket.on("ai:block:error", ({ roomId: updatedRoomId, message }) => {
      if (updatedRoomId !== roomId) {
        return;
      }

      setAiErrorMessage(message);
      setIsAskingAi(false);
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

    socket.on("terminal:history:init", ({ roomId: initializedRoomId, entries }) => {
      if (initializedRoomId !== roomId) {
        return;
      }

      setTerminalEntries(entries);
    });

    socket.on("terminal:entry", ({ entry }) => {
      if (entry.roomId !== roomId) {
        return;
      }

      setTerminalEntries((currentEntries) => [...currentEntries, entry].slice(-600));
    });

    socket.on("terminal:systemMessage", ({ entry }) => {
      if (entry.roomId !== roomId) {
        return;
      }

      setTerminalEntries((currentEntries) => [...currentEntries, entry].slice(-600));
    });

    socket.on("terminal:clear", ({ roomId: clearedRoomId }) => {
      if (clearedRoomId !== roomId) {
        return;
      }

      setTerminalEntries([]);
    });

    socket.on("workspace:tree", ({ workspace: incomingWorkspace }) => {
      clearScheduledSync();
      pendingFileUpdateRef.current = null;
      workspaceRef.current = incomingWorkspace;
      setWorkspace((currentWorkspace) => {
        const nextWorkspace = applyWorkspaceTreeUpdate(currentWorkspace, incomingWorkspace);
        setEditorView((currentView) =>
          normalizeEditorViewState(nextWorkspace, currentView, incomingWorkspace),
        );
        return nextWorkspace;
      });
    });

    socket.on("workspace:tab:closed", ({ activeFileId, openFileIds }) => {
      setEditorView((currentView) =>
        normalizeEditorViewState(workspaceRef.current, currentView, {
          activeFileId,
          openFileIds,
        }),
      );
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

    flushPendingFileUpdate();
    setInspectorView("ai");
    setIsAskingAi(true);
    setAiErrorMessage(null);
    socketRef.current.emit("ai:block:create", {
      roomId,
      fileId: liveActiveFile.id,
      prompt:
        "Suggest one practical code improvement that helps the user keep coding faster in this file.",
      code: liveActiveFile.content,
    });
  }

  function handleTogglePreview() {
    const nextInspectorView = inspectorView === "preview" ? "ai" : "preview";

    setInspectorView(nextInspectorView);
    emitWorkspacePreviewUpdate(
      nextInspectorView === "preview",
      nextInspectorView === "preview"
        ? inspectorActiveFile?.id ?? liveActiveFile?.id ?? null
        : null,
    );
  }

  function handleThemeChange(nextThemeId: IdeThemeId) {
    setIdeThemeId(nextThemeId);

    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:theme:update", {
      roomId,
      theme: nextThemeId,
    });
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

    if (!socketRef.current?.connected) {
      return;
    }

    flushPendingFileUpdate();
    setBottomPanelView("terminal");

    if (!liveActiveFileCanPreview) {
      activeRunIdRef.current = null;
      setConsoleEntries([]);
      setConsoleStatus("running");
      setIsRunningCode(true);
    }

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

  const handleTerminalInput = useCallback((data: string) => {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("terminal:input", {
      roomId,
      data,
    });
  }, [roomId]);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("terminal:resize", {
      roomId,
      cols,
      rows,
    });
  }, [roomId]);

  function handleClearTerminal() {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("terminal:clear", {
      roomId,
    });
  }

  function handleSelectFile(fileId: string) {
    if (isPresentationMode) {
      return;
    }

    flushPendingFileUpdate();

    const nextView = normalizeEditorViewState(workspaceRef.current, editorView, {
      activeFileId: fileId,
      openFileIds: [...editorView.openFileIds, fileId],
    });

    setEditorView(nextView);
    emitWorkspaceViewUpdate(nextView);
  }

  function handleCreateFile(parentId: string | null, name: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:create:file", {
      roomId,
      parentId,
      name,
    });
  }

  function handleCreateFolder(parentId: string | null, name: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:create:folder", {
      roomId,
      parentId,
      name,
    });
  }

  function handleRename(nodeId: string, newName: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:rename", {
      roomId,
      nodeId,
      newName,
    });
  }

  function handleDelete(nodeId: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:delete", {
      roomId,
      nodeId,
    });
  }

  function handleDuplicate(nodeId: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:duplicate", {
      roomId,
      nodeId,
    });
  }

  function handleMove(nodeId: string, targetParentId: string | null) {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:move", {
      roomId,
      nodeId,
      targetParentId,
    });
  }

  function handleFormatFile(fileId: string) {
    if (!socketRef.current?.connected) {
      return;
    }

    flushPendingFileUpdate();

    socketRef.current.emit("workspace:file:format", {
      roomId,
      fileId,
    });
  }

  function handleFormatActiveFile() {
    if (!liveActiveFile) {
      return;
    }

    handleFormatFile(liveActiveFile.id);
  }

  function handleCloseTab(fileId: string) {
    flushPendingFileUpdate();

    const closedTabIndex = editorView.openFileIds.indexOf(fileId);

    if (closedTabIndex < 0) {
      return;
    }

    const nextOpenFileIds = editorView.openFileIds.filter(
      (openFileId) => openFileId !== fileId,
    );
    const nextActiveFileId =
      editorView.activeFileId === fileId
        ? nextOpenFileIds[closedTabIndex] ??
          nextOpenFileIds[closedTabIndex - 1] ??
          ""
        : editorView.activeFileId;
    const nextView = normalizeEditorViewState(workspaceRef.current, editorView, {
      activeFileId: nextActiveFileId,
      openFileIds: nextOpenFileIds,
    });

    setEditorView(nextView);

    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit("workspace:tab:close", {
      roomId,
      fileId,
    });
  }

  function handleCreateRootFile() {
    handleCreateFile(null, "untitled.js");
  }

  function handleCreateRootFolder() {
    handleCreateFolder(null, "new-folder");
  }

  function handleUploadProjectZipClick() {
    projectZipInputRef.current?.click();
  }

  async function handleProjectZipSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) {
      return;
    }

    setProjectImportState({
      isImporting: true,
      progress: 0,
      message: `Uploading ${selectedFile.name} into session ${roomId}.`,
    });

    try {
      const result = await uploadSessionProjectZip(
        roomId,
        selectedFile,
        (progress) => {
          setProjectImportState((currentState) => ({
            ...currentState,
            isImporting: true,
            progress,
          }));
        },
      );

      setProjectImportState({
        isImporting: false,
        progress: null,
        message: `Imported ${result.importedFileCount} files and ${result.importedFolderCount} folders.${result.skippedCount > 0 ? ` Skipped ${result.skippedCount} unsupported entries.` : ""}`,
      });
    } catch (error) {
      setProjectImportState({
        isImporting: false,
        progress: null,
        message:
          error instanceof Error
            ? error.message
            : "Unable to import that project ZIP right now.",
      });
    } finally {
      event.target.value = "";
    }
  }

  const connectionLabel =
    connectionStatus === "connected"
      ? "Connected"
      : connectionStatus === "connecting"
        ? "Connecting"
        : "Disconnected";

  return (
    <main
      className="ide-theme-root flex h-full min-h-0 w-full overflow-hidden text-[var(--text-primary)]"
      data-ide-theme={ideThemeId}
    >
      <input
        ref={projectZipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={handleProjectZipSelected}
      />
      <div className="mx-auto flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden bg-[var(--bg-elevated)]">
        <TopBar
          currentUserName={currentUserName}
          connectionStatus={connectionStatus}
          consoleStatus={consoleStatus}
          participantCount={participants.length}
          roomId={roomId}
          isSigningOut={isSigningOut}
          themeId={ideThemeId}
          onThemeChange={handleThemeChange}
          onLogout={handleLogout}
        />
        <ParticipantsBar
          participants={participants}
          currentUserName={currentUserName}
          currentUserSocketId={currentSocketId}
        />

        <div className="grid min-h-0 flex-1 grid-cols-[48px_minmax(220px,18vw)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_minmax(220px,32vh)] overflow-hidden">
          <div className="row-span-2">
            <ActivityRail
              inspectorView={inspectorView}
              bottomPanelView={bottomPanelView}
              onSelectInspectorView={setInspectorView}
              onSelectBottomPanelView={setBottomPanelView}
            />
          </div>

          <div className="min-h-0 overflow-hidden border-r border-[var(--line)]">
            <IdeFileExplorer
              roomId={roomId}
              workspace={workspace}
              activeFileId={editorView.activeFileId}
              isImportingProject={projectImportState.isImporting}
              isEmptyWorkspacePromptDismissed={isEmptyWorkspacePromptDismissed}
              importStatusMessage={projectImportState.message}
              onSelect={handleSelectFile}
              onDismissEmptyWorkspacePrompt={() =>
                setIsEmptyWorkspacePromptDismissed(true)
              }
              onUploadProjectZip={handleUploadProjectZipClick}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onRename={handleRename}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onMove={handleMove}
              onFormatFile={handleFormatFile}
            />
          </div>

          <div className="grid min-h-0 overflow-hidden grid-cols-[minmax(0,1fr)_minmax(300px,30vw)]">
            <EditorPanel
              roomId={roomId}
              activeFile={displayedActiveFile}
              hasFiles={workspaceFiles.length > 0}
              isEmptyWorkspacePromptDismissed={isEmptyWorkspacePromptDismissed}
              connectionStatus={connectionStatus}
              ideThemeId={ideThemeId}
              openFiles={displayedOpenFiles}
              canRunCode={canRunCode}
              canFormatFile={canFormatFile}
              isAskingAi={isAskingAi}
              projectImportState={projectImportState}
              isRunningCode={isRunningCode}
              isPreviewFocused={inspectorView === "preview"}
              presentationSnapshot={presentationSnapshot}
              isPresentationMode={isPresentationMode}
              onSelectTab={handleSelectFile}
              onCloseTab={handleCloseTab}
              onChange={handleEditorChange}
              onCursorChange={handleCursorChange}
              onAskAi={handleAskAi}
              onFormatFile={handleFormatActiveFile}
              onLanguageChange={handleLanguageChange}
              onCreateFile={handleCreateRootFile}
              onCreateFolder={handleCreateRootFolder}
              onDismissEmptyWorkspacePrompt={() =>
                setIsEmptyWorkspacePromptDismissed(true)
              }
              onTogglePreview={handleTogglePreview}
              onUploadProjectZip={handleUploadProjectZipClick}
              onRunCode={handleRunCode}
              remoteCursors={visibleRemoteCursors}
              onExitPresentation={handleExitPresentation}
              onPreviousSnapshot={handlePreviousPresentationSnapshot}
              onNextSnapshot={handleNextPresentationSnapshot}
              hasPreviousSnapshot={presentationSnapshotIndex < snapshots.length - 1}
              hasNextSnapshot={presentationSnapshotIndex > 0}
            />

            <div className="min-h-0 overflow-hidden border-l border-[var(--line)]">
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
                <div className="h-full min-h-0 overflow-hidden">
                  {inspectorView === "preview" ? (
                    <IdePreviewPanel
                      activeFile={
                        inspectorActiveFile ??
                        displayedOpenFiles[0] ??
                        workspaceFiles[0] ??
                        null
                      }
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
                      errorMessage={aiErrorMessage}
                      onAccept={handleAcceptAiBlock}
                      onReject={handleRejectAiBlock}
                    />
                  ) : null}
                </div>
              </IdeSidePanel>
            </div>
          </div>

          <div className="min-h-0 overflow-hidden border-t border-[var(--line)] lg:col-[2/4]">
            <IdeBottomPanel
              activeTab={bottomPanelView}
              onSelectTab={setBottomPanelView}
              roomId={roomId}
              terminalEntries={terminalEntries}
              canInteractTerminal={connectionStatus === "connected"}
              onInputTerminal={handleTerminalInput}
              onResizeTerminal={handleTerminalResize}
              onClearTerminal={handleClearTerminal}
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
