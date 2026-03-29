"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type AiSelectionContext,
  type AiSuggestionMode,
  type ChatMessage,
  createSocketClient,
  type CursorPosition,
  type ItecifySocket,
  type Participant,
  type RemoteCursor,
  type RoomSnapshot,
  type RunDonePayload,
  type RunOutputPayload,
  type SessionActivityEvent,
  type WorkspaceTemplateKind,
  type TerminalEntry,
  type WorkspaceFileLanguage,
  type WorkspaceFileNode,
  type WorkspaceState,
} from "@/lib/socket";
import {
  buildWorkspacePreviewDocument,
  createWorkspaceZipBlob,
  applyWorkspaceTreeUpdate,
  createFallbackWorkspace,
  getFileExecutionRoute,
  getFileIcon,
  getWorkspaceFileReadOnlyState,
  searchWorkspaceContents,
  searchWorkspaceFiles,
  getWorkspaceFile,
  getWorkspaceFiles,
  getWorkspaceLanguageLabel,
  toMonacoLanguage,
  updateWorkspaceFileContent,
  updateWorkspaceFileLanguage,
} from "@/lib/workspace";
import {
  buildSessionInviteUrl,
  uploadSessionProjectZip,
} from "@/lib/session";
import { CollaborativeEditor } from "./collaborative-editor";
import { IdeBottomPanel } from "./ide-bottom-panel";
import { IdeEditorTabs } from "./ide-editor-tabs";
import { IdeFileExplorer } from "./ide-file-explorer";
import { CollaborationSidebar } from "./collaboration-sidebar";
import {
  WorkspaceOmnibar,
  type WorkspaceCommandPrompt,
  type WorkspaceOmnibarCommandItem,
  type WorkspaceOmnibarMode,
} from "./workspace-omnibar";
import {
  ItecifyTopBar,
  ItecifyCmdBar,
  ItecifyActivityBar,
  ItecifySidebarPresence,
  type ActivityKey,
} from "./itecify-workspace-chrome";
import { IdeStatusBar } from "./ide-status-bar";

const DOCUMENT_SYNC_DELAY_MS = 120;
const MAX_SHARED_CHAT_MESSAGES = 200;
const MAX_RECENT_FILE_IDS = 12;
const MAX_CLOSED_TAB_HISTORY = 12;

type SaveState = "saved" | "saving" | "unsaved";
type ConnectionStatus = "connecting" | "connected" | "disconnected";
type BottomPanelView = "terminal" | "output" | "timeline";
type EditorRevealRequest = { fileId: string; lineNumber: number; nonce: number };
type PendingFileUpdate = { fileId: string; content: string };
type EditorSelection = { startLineNumber: number; endLineNumber: number; selectedText: string };
type EditorViewState = { activeFileId: string; openFileIds: string[] };
type ProjectImportState = { isImporting: boolean; progress: number | null; message: string | null };


// ─── Helpers ───────────────────────────────────────────────────────────────

function upsertChatMessage(messages: ChatMessage[], message: ChatMessage, limit: number) {
  const existingIndex = messages.findIndex((m) => m.id === message.id);
  if (existingIndex < 0) return [...messages, message].slice(-limit);
  const next = [...messages];
  next[existingIndex] = message;
  return next;
}

function persistRecentFiles(roomId: string, fileIds: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`itecify:recent-files:${roomId}`, JSON.stringify(fileIds.slice(0, MAX_RECENT_FILE_IDS)));
}
function loadRecentFiles(roomId: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`itecify:recent-files:${roomId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch { return []; }
}
function persistHiddenFilesPreference(isVisible: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("itecify:show-hidden-files", isVisible ? "true" : "false");
}
function loadHiddenFilesPreference() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("itecify:show-hidden-files") === "true";
}
function createLocalParticipant(name: string, userId?: string): Participant {
  return { socketId: "local-user", name, userId };
}
function normalizeEditorViewState(
  workspace: WorkspaceState,
  currentView: EditorViewState | null,
  preferredView?: Partial<EditorViewState>,
): EditorViewState {
  const validFileIds = new Set(getWorkspaceFiles(workspace).map((f) => f.id));
  const preferredActiveFileId = preferredView?.activeFileId && validFileIds.has(preferredView.activeFileId) ? preferredView.activeFileId : null;
  const currentActiveFileId = currentView?.activeFileId && validFileIds.has(currentView.activeFileId) ? currentView.activeFileId : null;
  const activeFileId =
    preferredActiveFileId ?? currentActiveFileId ??
    (validFileIds.has(workspace.activeFileId) && workspace.openFileIds.includes(workspace.activeFileId) ? workspace.activeFileId : null) ?? "";
  const nextOpenFileIds = [
    ...(preferredView?.openFileIds ?? []),
    ...(currentView?.openFileIds ?? []),
    ...workspace.openFileIds,
  ].filter((id, i, arr) => validFileIds.has(id) && arr.indexOf(id) === i);
  if (activeFileId && !nextOpenFileIds.includes(activeFileId)) nextOpenFileIds.unshift(activeFileId);
  return { activeFileId, openFileIds: nextOpenFileIds };
}
function isNativeTextInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".monaco-editor") || target.closest(".xterm") || target.classList.contains("xterm-helper-textarea")) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

// ─── iTECify editor breadcrumb ─────────────────────────────────────────────
type ItecifyBreadcrumbProps = {
  activeFile: WorkspaceFileNode | null;
  saveState: SaveState;
  isReadOnly: boolean;
};

function ItecifyBreadcrumb({ activeFile, saveState, isReadOnly }: ItecifyBreadcrumbProps) {
  const crumbs = activeFile ? activeFile.path.split("/").filter(Boolean) : [];

  return (
    <div className="flex h-6.5 shrink-0 items-center border-b border-[rgba(255,255,255,0.055)] bg-[#0b0d12] px-3.5 text-[10.5px] text-[#626880]">
      {activeFile ? (
        <>
          {crumbs.slice(0, -1).map((c, i) => (
            <span key={`${c}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <span className="text-[#3d4259]">/</span> : null}
              <span className="cursor-default hover:text-[#a8abbe]">{c}</span>
            </span>
          ))}
          {crumbs.length > 1 ? <span className="text-[#3d4259]">/</span> : null}
          <span className="text-[#a8abbe]">{activeFile.name}</span>
          {isReadOnly ? (
            <span className="ml-2 rounded border border-[rgba(232,162,58,0.25)] px-1.5 py-px text-[9px] text-[#e8a23a]">read-only</span>
          ) : null}
          {saveState === "unsaved" ? (
            <span className="ml-2 text-[9px] text-[#e8a23a]">unsaved</span>
          ) : null}
          <span className="ml-auto rounded border border-[rgba(78,205,196,0.22)] bg-[rgba(78,205,196,0.04)] px-1.5 py-px text-[9.5px] tracking-[0.04em] text-[#4ecdc4]">
            shared
          </span>
        </>
      ) : (
        <span className="italic opacity-50">No file open — use Explorer or Quick open</span>
      )}
    </div>
  );
}

// ─── Presentation overlay ──────────────────────────────────────────────────
type PresentationOverlayProps = {
  snapshot: RoomSnapshot;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
};
function PresentationOverlay({ snapshot, hasPrevious, hasNext, onPrevious, onNext, onExit }: PresentationOverlayProps) {
  return (
    <div className="absolute inset-x-4 top-3 z-30 flex items-center justify-between gap-3 bg-[#1e1e1e] border border-[#cca700]/40 px-4 py-2.5 shadow-xl rounded-md">
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[#CCA700]">Presentation Mode</p>
        <p className="text-[13px] font-medium text-[#CCCCCC] truncate mt-0.5">{snapshot.label}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button type="button" disabled={!hasPrevious} onClick={onPrevious} className="px-3 py-1 text-[12px] text-[#CCCCCC] border border-[#3C3C3C] hover:bg-[#3C3C3C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">← Prev</button>
        <button type="button" disabled={!hasNext} onClick={onNext} className="px-3 py-1 text-[12px] text-[#CCCCCC] border border-[#3C3C3C] hover:bg-[#3C3C3C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next →</button>
        <button type="button" onClick={onExit} className="px-3 py-1 text-[12px] text-[#CCA700] border border-[#CCA700]/40 hover:bg-[#CCA700]/10 transition-colors">Exit</button>
      </div>
    </div>
  );
}

// ─── Main WorkspaceShell ───────────────────────────────────────────────────
type WorkspaceShellProps = {
  roomId: string;
  currentUserName: string;
  currentUserId: string;
};

export function WorkspaceShell({ roomId, currentUserName, currentUserId }: WorkspaceShellProps) {
  const { signOutUser } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspaceState>(() => createFallbackWorkspace());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [participants, setParticipants] = useState<Participant[]>(() => [createLocalParticipant(currentUserName, currentUserId)]);
  const [sharedChatMessages, setSharedChatMessages] = useState<ChatMessage[]>([]);
  const [aiBlocks, setAiBlocks] = useState<AiBlock[]>([]);
  const [snapshots, setSnapshots] = useState<RoomSnapshot[]>([]);
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);
  const [isAiBlockLoading, setIsAiBlockLoading] = useState(false);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [consoleStatus, setConsoleStatus] = useState<RunCodeStatus>("idle");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [currentSocketId, setCurrentSocketId] = useState<string | null>(null);
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  
  const [bottomPanelView, setBottomPanelView] = useState<BottomPanelView>("terminal");
  const [isExplorerVisible, setIsExplorerVisible] = useState(true);
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);
  const [omnibarMode, setOmnibarMode] = useState<WorkspaceOmnibarMode>("quick-open");
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false);
  const [omnibarQuery, setOmnibarQuery] = useState("");
  const [commandPrompt, setCommandPrompt] = useState<WorkspaceCommandPrompt | null>(null);
  const [ideThemeId, setIdeThemeId] = useState<IdeThemeId>(() => getStoredIdeTheme());
  const [projectImportState, setProjectImportState] = useState<ProjectImportState>({ isImporting: false, progress: null, message: null });
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [dirtyFileIds, setDirtyFileIds] = useState<string[]>([]);
  const [closedTabHistory, setClosedTabHistory] = useState<string[]>([]);
  const [recentFileIds, setRecentFileIds] = useState<string[]>([]);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [isEmptyWorkspacePromptDismissed, setIsEmptyWorkspacePromptDismissed] = useState(false);
  const [editorView, setEditorView] = useState<EditorViewState>(() => normalizeEditorViewState(createFallbackWorkspace(), null));
  const [editorRevealRequest, setEditorRevealRequest] = useState<EditorRevealRequest | null>(null);
  const [editorSelection, setEditorSelection] = useState<EditorSelection | null>(null);
  const [activityKey, setActivityKey] = useState<ActivityKey>("explorer");
  const [activityFeed, setActivityFeed] = useState<SessionActivityEvent[]>([]);
  const [editorCursorPos, setEditorCursorPos] = useState({ lineNumber: 1, column: 1 });
  const [lastRunInfo, setLastRunInfo] = useState<{ exitCode: number; failed: boolean } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const socketRef = useRef<ItecifySocket | null>(null);
  const projectZipInputRef = useRef<HTMLInputElement | null>(null);
  const shareFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRef = useRef<WorkspaceState>(createFallbackWorkspace());
  const roomIdRef = useRef(roomId);
  const isRunningCodeRef = useRef(false);
  const flushPendingFileUpdateRef = useRef<() => void>(() => {});
  const showShareFeedbackRef = useRef<(message: string) => void>(() => {});
  const pendingFileUpdateRef = useRef<PendingFileUpdate | null>(null);
  const aiBlockAutoSuggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAiBlockSignatureRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteFileIdRef = useRef<string | null>(null);
  const latestCursorRef = useRef<{ fileId: string; position: CursorPosition } | null>(null);
  const saveStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const currentUserNameRef = useRef(currentUserName);
  const joinedParticipantNameRef = useRef<string | null>(null);
  const dirtyFileIdsRef = useRef<string[]>([]);
  const closedTabHistoryRef = useRef<string[]>([]);
  const requestCloseTabRef = useRef<(fileId: string) => void>(() => {});
  const reopenClosedTabRef = useRef<() => void>(() => {});
  const canFormatFileRef = useRef(false);
  const liveActiveFileRef = useRef<WorkspaceFileNode | null>(null);
  const editorViewRef = useRef<EditorViewState>(editorView);
  const bottomPanelViewRef = useRef<BottomPanelView>(bottomPanelView);

  const liveActiveFile = getWorkspaceFile(workspace, editorView.activeFileId);
  const liveActiveFileReadOnlyState = getWorkspaceFileReadOnlyState(liveActiveFile);
  const workspaceFiles = useMemo(() => getWorkspaceFiles(workspace), [workspace]);
  const inspectorActiveFile = liveActiveFile ?? workspaceFiles[0] ?? null;
  const presentationSnapshot = isPresentationMode ? snapshots.find((s) => s.id === previewSnapshotId) ?? null : null;
  const displayedWorkspace = presentationSnapshot?.workspace ?? workspace;
  const displayedActiveFile = getWorkspaceFile(displayedWorkspace, isPresentationMode ? displayedWorkspace.activeFileId : editorView.activeFileId);
  const displayedOpenFiles = (isPresentationMode ? displayedWorkspace.openFileIds : editorView.openFileIds)
    .map((id) => getWorkspaceFile(displayedWorkspace, id))
    .filter((f): f is WorkspaceFileNode => Boolean(f));
  const visibleRemoteCursors = liveActiveFile ? remoteCursors.filter((c) => c.fileId === liveActiveFile.id) : [];
  const liveActiveFileExecutionRoute = liveActiveFile ? getFileExecutionRoute(liveActiveFile) : "unsupported";
  const liveActiveFileCanPreview = liveActiveFileExecutionRoute === "preview";
  const canRunCode =
    !isPresentationMode && !isRunningCode && !!liveActiveFile && connectionStatus === "connected" &&
    (liveActiveFileCanPreview || (liveActiveFileExecutionRoute !== "unsupported" && liveActiveFile.content.trim().length > 0));
  const canFormatFile =
    !isPresentationMode && !!liveActiveFile && !liveActiveFileReadOnlyState.isReadOnly &&
    ["javascript","typescript","html","css","json","markdown"].includes(liveActiveFile.language);

  const previewDocument = useMemo(() => buildWorkspacePreviewDocument(workspace), [workspace]);
  const quickOpenItems = useMemo(() => {
    const searchResults = searchWorkspaceFiles(workspace, omnibarQuery);
    const openFileSet = new Set(editorView.openFileIds);
    const recentRank = new Map(recentFileIds.map((id, i) => [id, i] as const));
    return searchResults.sort((l, r) => {
      if (l.fileId === editorView.activeFileId) return -1;
      if (r.fileId === editorView.activeFileId) return 1;
      const lo = openFileSet.has(l.fileId), ro = openFileSet.has(r.fileId);
      if (lo !== ro) return lo ? -1 : 1;
      if (!omnibarQuery.trim()) {
        const lr = recentRank.get(l.fileId) ?? Infinity;
        const rr = recentRank.get(r.fileId) ?? Infinity;
        if (lr !== rr) return lr - rr;
      }
      if (r.score !== l.score) return r.score - l.score;
      return l.path.localeCompare(r.path);
    }).slice(0, 24).map((result) => ({
      id: result.id, fileId: result.fileId, title: result.name, subtitle: result.path, icon: result.icon,
      badge: result.fileId === editorView.activeFileId ? "Active" : openFileSet.has(result.fileId) ? "Open" : recentRank.has(result.fileId) ? "Recent" : undefined,
    }));
  }, [editorView.activeFileId, editorView.openFileIds, omnibarQuery, recentFileIds, workspace]);
  const pendingAiBlocksForActiveFile = useMemo(() => aiBlocks.filter((b) => b.fileId === liveActiveFile?.id && b.status === "pending"), [aiBlocks, liveActiveFile?.id]);
  const fileSearchItems = useMemo(() => searchWorkspaceFiles(workspace, omnibarQuery).slice(0, 20).map((r) => ({ id: r.id, fileId: r.fileId, title: r.name, subtitle: r.path, icon: r.icon })), [omnibarQuery, workspace]);
  const contentSearchItems = useMemo(() => searchWorkspaceContents(workspace, omnibarQuery).map((r) => ({ id: r.id, fileId: r.fileId, title: r.name, subtitle: r.path, icon: r.icon, lineNumber: r.lineNumber, lineText: r.lineText })), [omnibarQuery, workspace]);
  const commandItems = useMemo<WorkspaceOmnibarCommandItem[]>(() => {
    const q = omnibarQuery.trim().toLowerCase();
    const all: WorkspaceOmnibarCommandItem[] = [
      { id: "create-file", title: "Create File", subtitle: "New file in workspace", icon: "FILE" },
      { id: "create-folder", title: "Create Folder", subtitle: "New folder in workspace", icon: "DIR" },
      { id: "rename-active", title: "Rename Active File", subtitle: liveActiveFile ? `Rename ${liveActiveFile.name}` : "Open a file first", icon: "REN", disabled: !liveActiveFile },
      { id: "format-active", title: "Format Document", subtitle: "Shift+Alt+F", icon: "FMT", shortcut: "⇧⌥F", disabled: !canFormatFile },
      { id: "run-active", title: "Run File", subtitle: liveActiveFile?.name ?? "Open a file", icon: "RUN", disabled: !canRunCode },
      { id: "reopen-closed-tab", title: "Reopen Closed Editor", subtitle: "⌘⇧T", icon: "TAB", shortcut: "⌘⇧T", disabled: closedTabHistory.length === 0 },
      { id: "open-preview", title: "Open Preview", subtitle: "Focus live preview panel", icon: "PRV", disabled: !previewDocument },
      { id: "toggle-explorer", title: isExplorerVisible ? "Hide Explorer" : "Show Explorer", subtitle: "⌘B", icon: "EXP", shortcut: "⌘B" },
      { id: "toggle-terminal", title: isBottomPanelVisible ? "Hide Terminal" : "Show Terminal", subtitle: "⌘J", icon: "TRM", shortcut: "⌘J" },
      { id: "download-workspace", title: "Download Workspace ZIP", subtitle: "Export session", icon: "ZIP" },
      { id: "template:python-starter", title: "New Python Starter", subtitle: "ready-to-run Python workspace", icon: "PY" },
      { id: "template:cpp-starter", title: "New C++ Starter", subtitle: "console starter", icon: "C++" },
      { id: "template:html-css-starter", title: "New HTML/CSS Starter", subtitle: "index.html + style.css + script.js", icon: "WEB" },
      { id: "template:readme-starter", title: "New README", subtitle: "structured README.md", icon: "MD" },
      { id: "template:json-config-starter", title: "New JSON Config", subtitle: "config.json starter", icon: "{}" },
      { id: "summarize-project", title: "Summarize project", subtitle: "AI overview of workspace files", icon: "Σ" },
      { id: "keyboard-shortcuts", title: "Keyboard shortcuts", subtitle: "Reference for this IDE", icon: "⌨" },
      ...IDE_THEMES.map((t) => ({ id: `theme:${t.id}`, title: `Theme: ${t.label}`, subtitle: "Switch IDE theme", icon: "THM", badge: t.id === ideThemeId ? "Active" : undefined })),
    ];
    if (!q) return all;
    return all.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(q));
  }, [canFormatFile, canRunCode, closedTabHistory.length, ideThemeId, isBottomPanelVisible, isExplorerVisible, liveActiveFile, omnibarQuery, previewDocument]);
  const presentationSnapshotIndex = presentationSnapshot ? snapshots.findIndex((s) => s.id === presentationSnapshot.id) : -1;

  // ── Ref syncs ──
  useEffect(() => { isRunningCodeRef.current = isRunningCode; }, [isRunningCode]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { canFormatFileRef.current = canFormatFile; }, [canFormatFile]);
  useEffect(() => { liveActiveFileRef.current = liveActiveFile; }, [liveActiveFile]);
  useEffect(() => { setEditorSelection(null); }, [editorView.activeFileId]);
  useEffect(() => { editorViewRef.current = editorView; }, [editorView]);
  useEffect(() => { bottomPanelViewRef.current = bottomPanelView; }, [bottomPanelView]);
  useEffect(() => { persistIdeTheme(ideThemeId); }, [ideThemeId]);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  // ── Room reset ──
  useEffect(() => {
    const next = createFallbackWorkspace();
    clearScheduledSync();
    pendingFileUpdateRef.current = null;
    applyingRemoteFileIdRef.current = null;
    latestCursorRef.current = null;
    activeRunIdRef.current = null;
    joinedParticipantNameRef.current = null;
    workspaceRef.current = next;
    setWorkspace(next);
    setEditorView(normalizeEditorViewState(next, null));
    setConnectionStatus("connecting");
    setParticipants([createLocalParticipant(currentUserNameRef.current, currentUserId)]);
    setSharedChatMessages([]); setAiBlocks([]); setSnapshots([]);
    setTerminalEntries([]);
    setIsAiBlockLoading(false); setIsRunningCode(false); setConsoleStatus("idle"); setConsoleEntries([]);
    setRemoteCursors([]); setCurrentSocketId(null); setPreviewSnapshotId(null); setIsPresentationMode(false);
    setBottomPanelView("terminal"); setIsExplorerVisible(true); setIsBottomPanelVisible(true);
    setOmnibarMode("quick-open"); setIsOmnibarOpen(false); setOmnibarQuery(""); setCommandPrompt(null);
    setProjectImportState({ isImporting: false, progress: null, message: null });
    setSaveState("saved"); setDirtyFileIds([]); setClosedTabHistory([]);
    setRecentFileIds(loadRecentFiles(roomId)); setShowHiddenFiles(loadHiddenFilesPreference());
    setShareFeedback(null); setEditorRevealRequest(null); setEditorSelection(null);
    setActivityFeed([]); setLastRunInfo(null);
    setEditorCursorPos({ lineNumber: 1, column: 1 });
    lastAiBlockSignatureRef.current = null;
    if (aiBlockAutoSuggestTimerRef.current) { clearTimeout(aiBlockAutoSuggestTimerRef.current); aiBlockAutoSuggestTimerRef.current = null; }
    if (shareFeedbackTimerRef.current) { clearTimeout(shareFeedbackTimerRef.current); shareFeedbackTimerRef.current = null; }
    if (saveStateTimerRef.current) { clearTimeout(saveStateTimerRef.current); saveStateTimerRef.current = null; }
  }, [currentUserId, roomId]);

  useEffect(() => () => {
    if (shareFeedbackTimerRef.current) clearTimeout(shareFeedbackTimerRef.current);
    if (aiBlockAutoSuggestTimerRef.current) clearTimeout(aiBlockAutoSuggestTimerRef.current);
    if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
  }, []);

  useEffect(() => { setIsEmptyWorkspacePromptDismissed(false); }, [roomId]);
  useEffect(() => { if (workspaceFiles.length > 0) setIsEmptyWorkspacePromptDismissed(false); }, [workspaceFiles.length]);

  useEffect(() => {
    const valid = new Set(workspaceFiles.map((f) => f.id));
    setDirtyFileIds((ids) => ids.filter((id) => valid.has(id)));
    setClosedTabHistory((ids) => ids.filter((id) => valid.has(id)));
    setRecentFileIds((ids) => ids.filter((id) => valid.has(id)));
  }, [workspaceFiles]);

  useEffect(() => { persistHiddenFilesPreference(showHiddenFiles); }, [showHiddenFiles]);
  useEffect(() => { persistRecentFiles(roomId, recentFileIds); }, [recentFileIds, roomId]);

  useEffect(() => {
    if (!editorView.activeFileId) return;
    setRecentFileIds((ids) => [editorView.activeFileId, ...ids.filter((id) => id !== editorView.activeFileId)].slice(0, MAX_RECENT_FILE_IDS));
  }, [editorView.activeFileId]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyFileIds.length === 0) return;
      e.preventDefault(); e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyFileIds]);

  useEffect(() => {
    if (previewSnapshotId && !snapshots.some((s) => s.id === previewSnapshotId)) {
      setPreviewSnapshotId(snapshots[0]?.id ?? null); setIsPresentationMode(false);
    }
    if (!previewSnapshotId && snapshots.length > 0) setPreviewSnapshotId(snapshots[0].id);
  }, [previewSnapshotId, snapshots]);

  useEffect(() => {
    currentUserNameRef.current = currentUserName;
    setParticipants((ps) => {
      if (currentSocketId) return ps.map((p) => p.socketId === currentSocketId ? { ...p, name: currentUserName, userId: currentUserId } : p);
      if (ps.length === 0) return [createLocalParticipant(currentUserName, currentUserId)];
      return ps.map((p, i) => i === 0 && p.socketId === "local-user" ? { ...p, name: currentUserName, userId: currentUserId } : p);
    });
  }, [currentSocketId, currentUserId, currentUserName]);

  useEffect(() => { dirtyFileIdsRef.current = dirtyFileIds; }, [dirtyFileIds]);
  useEffect(() => { closedTabHistoryRef.current = closedTabHistory; }, [closedTabHistory]);

  useEffect(() => {
    if (aiBlockAutoSuggestTimerRef.current) { clearTimeout(aiBlockAutoSuggestTimerRef.current); aiBlockAutoSuggestTimerRef.current = null; }
    if (connectionStatus !== "connected" || isPresentationMode || !liveActiveFile || liveActiveFile.content.trim().length < 24 || pendingAiBlocksForActiveFile.length > 0 || isAiBlockLoading) return;
    const cursorLine = latestCursorRef.current?.fileId === liveActiveFile.id ? latestCursorRef.current.position.lineNumber : 1;
    const signature = [roomId, liveActiveFile.id, liveActiveFile.content.length, cursorLine, liveActiveFile.content.slice(-120)].join(":");
    if (lastAiBlockSignatureRef.current === signature) return;
    aiBlockAutoSuggestTimerRef.current = setTimeout(() => {
      lastAiBlockSignatureRef.current = signature;
      const activeFile = liveActiveFileRef.current;
      if (socketRef.current?.connected && activeFile) {
        flushPendingFileUpdateRef.current();
        setIsAiBlockLoading(true);
        socketRef.current.emit("ai:block:create", { roomId: roomIdRef.current, fileId: activeFile.id, code: activeFile.content, cursorLine: latestCursorRef.current?.fileId === activeFile.id ? latestCursorRef.current.position.lineNumber : null, mode: "next-line", prompt: "Suggest one short, high-value code block or next logical continuation near the current cursor. Keep it reviewable and no more than 12 lines." });
      }
      aiBlockAutoSuggestTimerRef.current = null;
    }, 5000);
    return () => { if (aiBlockAutoSuggestTimerRef.current) { clearTimeout(aiBlockAutoSuggestTimerRef.current); aiBlockAutoSuggestTimerRef.current = null; } };
  }, [connectionStatus, isAiBlockLoading, isPresentationMode, liveActiveFile, pendingAiBlocksForActiveFile.length, roomId]);

  function clearScheduledSync() {
    if (!syncTimerRef.current) return;
    clearTimeout(syncTimerRef.current); syncTimerRef.current = null;
  }

  function showShareFeedback(message: string) {
    setShareFeedback(message);
    if (shareFeedbackTimerRef.current) clearTimeout(shareFeedbackTimerRef.current);
    shareFeedbackTimerRef.current = setTimeout(() => { setShareFeedback(null); shareFeedbackTimerRef.current = null; }, 2200);
  }

  function openOmnibar(mode: WorkspaceOmnibarMode) { setOmnibarMode(mode); setOmnibarQuery(""); setCommandPrompt(null); setIsOmnibarOpen(true); }
  function closeOmnibar() { setIsOmnibarOpen(false); setOmnibarQuery(""); setCommandPrompt(null); }

  function openPreviewInspector() {
    emitWorkspacePreviewUpdate(true, inspectorActiveFile?.id ?? liveActiveFile?.id ?? null);
  }

  function handleToggleExplorer() { setIsExplorerVisible((s) => !s); }

  function handleSelectBottomPanelView(next: BottomPanelView) { setBottomPanelView(next); setIsBottomPanelVisible(true); }
  function handleToggleBottomPanel(next: BottomPanelView = "terminal") {
    setBottomPanelView(next);
    setIsBottomPanelVisible((s) => !(s && bottomPanelView === next));
  }

  function handleOpenFileFromOmnibar(fileId: string, lineNumber?: number) {
    if (lineNumber) setEditorRevealRequest({ fileId, lineNumber, nonce: Date.now() });
    handleSelectFile(fileId); closeOmnibar();
  }

  function handleSelectCommand(commandId: string) {
    if (commandId === "create-file") { setCommandPrompt({ commandId, title: "Create File", description: "New file in workspace.", label: "File name", placeholder: "untitled.js", defaultValue: "untitled.js", submitLabel: "Create" }); return; }
    if (commandId === "create-folder") { setCommandPrompt({ commandId, title: "Create Folder", description: "New folder in workspace.", label: "Folder name", placeholder: "new-folder", defaultValue: "new-folder", submitLabel: "Create" }); return; }
    if (commandId === "rename-active" && liveActiveFile) { setCommandPrompt({ commandId, title: "Rename", description: `Rename ${liveActiveFile.name}`, label: "New name", placeholder: liveActiveFile.name, defaultValue: liveActiveFile.name, submitLabel: "Rename" }); return; }
    if (commandId === "format-active") { handleFormatActiveFile(); closeOmnibar(); return; }
    if (commandId === "run-active") { void handleRunCode(); closeOmnibar(); return; }
    if (commandId === "reopen-closed-tab") { handleReopenClosedTab(); closeOmnibar(); return; }
    if (commandId === "open-preview") { openPreviewInspector(); closeOmnibar(); return; }
    if (commandId === "toggle-explorer") { handleToggleExplorer(); closeOmnibar(); return; }
    if (commandId === "toggle-terminal") { handleToggleBottomPanel("terminal"); closeOmnibar(); return; }
    if (commandId === "download-workspace") { void handleDownloadWorkspace(); closeOmnibar(); return; }
    if (commandId.startsWith("template:")) { handleCreateTemplate(commandId.replace("template:", "") as WorkspaceTemplateKind); closeOmnibar(); return; }
    if (commandId === "summarize-project") { handleSummarizeProject(); closeOmnibar(); return; }
    if (commandId === "keyboard-shortcuts") { setShortcutsOpen(true); closeOmnibar(); return; }
    if (commandId.startsWith("theme:")) { handleThemeChange(commandId.replace("theme:", "") as IdeThemeId); closeOmnibar(); }
  }

  function handleSubmitCommandPrompt(value: string) {
    const v = value.trim();
    if (!commandPrompt || !v) return;
    if (commandPrompt.commandId === "create-file") { handleCreateFile(liveActiveFile?.parentId ?? null, v); closeOmnibar(); return; }
    if (commandPrompt.commandId === "create-folder") { handleCreateFolder(liveActiveFile?.parentId ?? null, v); closeOmnibar(); return; }
    if (commandPrompt.commandId === "rename-active" && liveActiveFile) { handleRename(liveActiveFile.id, v); closeOmnibar(); }
  }

  function flushPendingFileUpdate() {
    clearScheduledSync();
    const pending = pendingFileUpdateRef.current;
    const socket = socketRef.current;
    if (!pending || !socket?.connected) return;
    setSaveState("saving");
    pendingFileUpdateRef.current = null;
    socket.emit("workspace:file:update", { roomId: roomIdRef.current, fileId: pending.fileId, content: pending.content });
    setDirtyFileIds((ids) => ids.filter((id) => id !== pending.fileId));
    if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
    saveStateTimerRef.current = setTimeout(() => { if (!pendingFileUpdateRef.current && dirtyFileIdsRef.current.length === 0) setSaveState("saved"); saveStateTimerRef.current = null; }, 140);
  }

  flushPendingFileUpdateRef.current = flushPendingFileUpdate;
  showShareFeedbackRef.current = showShareFeedback;

  function scheduleFileSync() {
    if (syncTimerRef.current) return;
    syncTimerRef.current = setTimeout(() => { flushPendingFileUpdate(); }, DOCUMENT_SYNC_DELAY_MS);
  }

  function emitWorkspaceViewUpdate(next: EditorViewState) {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("workspace:view:update", { roomId: roomIdRef.current, activeFileId: next.activeFileId, openFileIds: next.openFileIds });
  }

  function emitWorkspacePreviewUpdate(isVisible: boolean, targetFileId: string | null) {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("workspace:preview:update", { roomId: roomIdRef.current, isVisible, targetFileId });
  }

  const applyRemoteFileUpdate = useCallback((fileId: string, content: string) => {
    clearScheduledSync();
    if (pendingFileUpdateRef.current?.fileId === fileId) pendingFileUpdateRef.current = null;
    applyingRemoteFileIdRef.current = fileId;
    setWorkspace((ws) => updateWorkspaceFileContent(ws, fileId, content));
    queueMicrotask(() => { applyingRemoteFileIdRef.current = null; });
  }, []);

  const appendRunOutput = useCallback((payload: RunOutputPayload) => {
    if (!payload.chunk.trim()) return;
    const entry = createConsoleEntry(payload.stream, payload.chunk, `${payload.runId}-${payload.timestamp}`);
    setConsoleEntries((es) => {
      if (activeRunIdRef.current !== payload.runId) { activeRunIdRef.current = payload.runId; return [entry]; }
      return [...es, entry];
    });
    setConsoleStatus("running"); setIsRunningCode(true);
  }, []);

  const completeRun = useCallback((payload: RunDonePayload) => {
    if (activeRunIdRef.current && activeRunIdRef.current !== payload.runId) return;
    activeRunIdRef.current = payload.runId;
    setConsoleEntries((es) => [...es, createConsoleEntry("system", payload.status === "completed" ? `Process exited with code ${payload.exitCode}.` : `Process failed with code ${payload.exitCode}.`, `${payload.runId}-done`)]);
    setConsoleStatus(payload.status === "completed" ? "completed" : "error");
    setIsRunningCode(false);
    setLastRunInfo({ exitCode: payload.exitCode, failed: payload.status !== "completed" });
  }, []);

  // ── Socket setup ──
  useEffect(() => {
    const socket = createSocketClient();
    socketRef.current = socket;

    socket.on("connect", () => { setConnectionStatus("connected"); setCurrentSocketId(socket.id ?? null); joinedParticipantNameRef.current = currentUserNameRef.current; socket.emit("room:join", { roomId, name: currentUserNameRef.current, userId: currentUserId }); });
    socket.on("disconnect", () => {
      const wasRunning = isRunningCodeRef.current;
      setConnectionStatus("disconnected"); setCurrentSocketId(null); setIsAiBlockLoading(false); setIsRunningCode(false);
      setSaveState(pendingFileUpdateRef.current || dirtyFileIdsRef.current.length > 0 ? "unsaved" : "saved");
      setRemoteCursors([]); setParticipants([createLocalParticipant(currentUserNameRef.current, currentUserId)]);
      joinedParticipantNameRef.current = null;
      if (wasRunning) { activeRunIdRef.current = null; setConsoleStatus("error"); setConsoleEntries((es) => [...es, createConsoleEntry("stderr", "Connection lost during run.", `run-disconnect-${Date.now()}`)]); }
    });
    socket.on("room:state", (room) => {
      if (room.roomId !== roomId) return;
      clearScheduledSync(); pendingFileUpdateRef.current = null; setSaveState("saved"); setDirtyFileIds([]);
      workspaceRef.current = room.workspace; setWorkspace(room.workspace);
      setEditorView((v) => normalizeEditorViewState(room.workspace, v, room.workspace));
      setParticipants(room.participants); setAiBlocks(room.aiBlocks); setSnapshots(room.snapshots);
      setTerminalEntries(room.terminalEntries); setIsAiBlockLoading(false);
      setActivityFeed(room.activityFeed ?? []);
      if (room.ui?.theme && IDE_THEMES.some((t) => t.id === room.ui?.theme)) setIdeThemeId(room.ui.theme as IdeThemeId);
      setRemoteCursors((cs) => cs.filter((c) => room.participants.some((p: Participant) => p.socketId === c.socketId)));
    });
    socket.on("session:activity", (ev) => {
      if (ev.roomId !== roomId) return;
      setActivityFeed((prev) => [ev, ...prev.filter((x) => x.id !== ev.id)].slice(0, 80));
    });
    socket.on("session:comment:created", ({ comment }) => {
      if (comment.roomId !== roomId) return;
    });
    socket.on("room:participants", (ps) => {
      setParticipants(ps.length > 0 ? ps : [createLocalParticipant(currentUserNameRef.current, currentUserId)]);
      setRemoteCursors((cs) => cs.filter((c) => ps.some((p: Participant) => p.socketId === c.socketId)));
    });
    socket.on("workspace:file:updated", ({ fileId, content }) => applyRemoteFileUpdate(fileId, content));
    socket.on("workspace:view", ({ roomId: rid, activeFileId, openFileIds }) => { if (rid !== roomId) return; setEditorView((v) => normalizeEditorViewState(workspaceRef.current, v, { activeFileId, openFileIds })); });
    socket.on("workspace:file:language", ({ roomId: rid, fileId, language }) => { if (rid !== roomId) return; setWorkspace((ws) => updateWorkspaceFileLanguage(ws, fileId, language)); });
    socket.on("workspace:preview", ({ roomId: rid }) => { if (rid !== roomId) return; });
    socket.on("workspace:theme", ({ roomId: rid, theme }) => { if (rid !== roomId || !IDE_THEMES.some((t) => t.id === theme)) return; setIdeThemeId(theme as IdeThemeId); });
    socket.on("cursor:updated", (cursor) => { if (cursor.socketId === socket.id) return; setRemoteCursors((cs) => [...cs.filter((c) => c.socketId !== cursor.socketId), cursor]); });
    socket.on("cursor:cleared", ({ socketId }) => { setRemoteCursors((cs) => cs.filter((c) => c.socketId !== socketId)); });
    socket.on("run:output", (payload) => { if (payload.roomId !== roomId) return; appendRunOutput(payload); });
    socket.on("run:done", (payload) => { if (payload.roomId !== roomId) return; completeRun(payload); });
    socket.on("chat:shared:init", ({ roomId: rid, messages }) => { if (rid !== roomId) return; setSharedChatMessages(messages); });
    socket.on("chat:shared:message", ({ message }) => { if (message.roomId !== roomId) return; setSharedChatMessages((ms) => upsertChatMessage(ms, message, MAX_SHARED_CHAT_MESSAGES)); });
    socket.on("chat:shared:message:updated", ({ message }) => { if (message.roomId !== roomId) return; setSharedChatMessages((ms) => upsertChatMessage(ms, message, MAX_SHARED_CHAT_MESSAGES)); });
    socket.on("chat:private:init", ({ roomId: rid }) => { if (rid !== roomId) return; });
    socket.on("chat:private:message", ({ message }) => { if (message.roomId !== roomId) return; });
    socket.on("chat:private:message:updated", ({ message }) => { if (message.roomId !== roomId) return; });
    socket.on("ai:proposal:init", ({ roomId: rid }) => { if (rid !== roomId) return; });
    socket.on("ai:proposal:created", () => { });
    socket.on("ai:proposal:updated", () => { });
    socket.on("ai:proposal:error", ({ roomId: rid }) => { if (rid !== roomId) return; });
    socket.on("ai:block:created", ({ block }) => { if (block.roomId !== roomId) return; setAiBlocks((bs) => [block, ...bs.filter((b) => b.id !== block.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setIsAiBlockLoading(false); });
    socket.on("ai:block:updated", ({ block }) => { if (block.roomId !== roomId) return; setAiBlocks((bs) => { const has = bs.some((b) => b.id === block.id); return (has ? bs.map((b) => b.id === block.id ? block : b) : [block, ...bs]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }); });
    socket.on("ai:block:error", ({ roomId: rid }) => { if (rid !== roomId) return; lastAiBlockSignatureRef.current = null; setIsAiBlockLoading(false); });
    socket.on("snapshot:created", ({ snapshot }) => { setSnapshots((ss) => [snapshot, ...ss.filter((s) => s.id !== snapshot.id)].slice(0, 12)); });
    socket.on("terminal:history:init", ({ roomId: rid, entries }) => { if (rid !== roomId) return; setTerminalEntries(entries); });
    socket.on("terminal:entry", ({ entry }) => { if (entry.roomId !== roomId) return; setTerminalEntries((es) => [...es, entry].slice(-600)); });
    socket.on("terminal:systemMessage", ({ entry }) => { if (entry.roomId !== roomId) return; setTerminalEntries((es) => [...es, entry].slice(-600)); });
    socket.on("terminal:clear", ({ roomId: rid }) => { if (rid !== roomId) return; setTerminalEntries([]); });
    socket.on("workspace:tree", ({ workspace: ws }) => { clearScheduledSync(); pendingFileUpdateRef.current = null; workspaceRef.current = ws; setWorkspace((cur) => { const next = applyWorkspaceTreeUpdate(cur, ws); setEditorView((v) => normalizeEditorViewState(next, v, ws)); return next; }); });
    socket.on("workspace:tab:closed", ({ activeFileId, openFileIds }) => { setEditorView((v) => normalizeEditorViewState(workspaceRef.current, v, { activeFileId, openFileIds })); });

    socket.connect();
    return () => { clearScheduledSync(); socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
  }, [appendRunOutput, applyRemoteFileUpdate, completeRun, currentUserId, roomId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || joinedParticipantNameRef.current === currentUserName) return;
    joinedParticipantNameRef.current = currentUserName;
    socket.emit("room:join", { roomId, name: currentUserName, userId: currentUserId });
  }, [currentUserId, currentUserName, roomId]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isNativeTextInputTarget(e.target)) return;
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && key === "p") { e.preventDefault(); setOmnibarMode("command"); setOmnibarQuery(""); setCommandPrompt(null); setIsOmnibarOpen(true); return; }
      if (mod && e.shiftKey && key === "f") { e.preventDefault(); setOmnibarMode("search"); setOmnibarQuery(""); setCommandPrompt(null); setIsOmnibarOpen(true); return; }
      if (mod && key === "p") { e.preventDefault(); setOmnibarMode("quick-open"); setOmnibarQuery(""); setCommandPrompt(null); setIsOmnibarOpen(true); return; }
      if (e.shiftKey && e.altKey && key === "f") { const af = liveActiveFileRef.current; if (!af || !canFormatFileRef.current || !socketRef.current?.connected) return; e.preventDefault(); flushPendingFileUpdateRef.current(); socketRef.current.emit("workspace:file:format", { roomId: roomIdRef.current, fileId: af.id }); return; }
      if (mod && key === "s") { e.preventDefault(); if (!liveActiveFileRef.current) { showShareFeedbackRef.current("No active file"); return; } flushPendingFileUpdateRef.current(); showShareFeedbackRef.current("Saved"); return; }
      if (mod && key === "b") { e.preventDefault(); setIsExplorerVisible((s) => !s); return; }
      if (mod && key === "j") { e.preventDefault(); setBottomPanelView("terminal"); setIsBottomPanelVisible((s) => !(s && bottomPanelViewRef.current === "terminal")); return; }
      if (mod && e.shiftKey && key === "t") { e.preventDefault(); reopenClosedTabRef.current(); return; }
      if (mod && key === "w") { const af = liveActiveFileRef.current; if (!af) return; e.preventDefault(); requestCloseTabRef.current(af.id); }
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);

  // ── Editor handlers ──
  function handleEditorChange(nextValue: string) {
    if (!liveActiveFile || liveActiveFileReadOnlyState.isReadOnly) return;
    if (applyingRemoteFileIdRef.current === liveActiveFile.id) return;
    if (nextValue === liveActiveFile.content) return;
    setWorkspace((ws) => updateWorkspaceFileContent(ws, liveActiveFile.id, nextValue));
    setDirtyFileIds((ids) => [liveActiveFile.id, ...ids.filter((id) => id !== liveActiveFile.id)]);
    setSaveState("unsaved");
    pendingFileUpdateRef.current = { fileId: liveActiveFile.id, content: nextValue };
    scheduleFileSync();
  }

  function handleCursorChange(position: CursorPosition) {
    setEditorCursorPos({ lineNumber: position.lineNumber, column: position.column });
    if (!liveActiveFile) return;
    if (latestCursorRef.current?.fileId === liveActiveFile.id && latestCursorRef.current.position.lineNumber === position.lineNumber && latestCursorRef.current.position.column === position.column) return;
    latestCursorRef.current = { fileId: liveActiveFile.id, position };
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("cursor:update", { roomId, fileId: liveActiveFile.id, position });
  }

  function handleSelectionChange(selection: EditorSelection | null) { setEditorSelection(selection); }

  function toAiSelectionContext(sel: EditorSelection | null): AiSelectionContext | null {
    if (!sel || !sel.selectedText.trim()) return null;
    return { startLineNumber: sel.startLineNumber, endLineNumber: sel.endLineNumber, selectedText: sel.selectedText };
  }

  function sendPrivateAiRequest({ prompt, mode, intent = "edit", fileId, selection = null }: { prompt: string; mode: AiSuggestionMode | null; intent?: "edit" | "explain" | "generate-files" | "summarize"; fileId?: string | null; selection?: EditorSelection | null }) {
    if (!socketRef.current?.connected || (!fileId && intent !== "generate-files" && intent !== "summarize")) return;
    const cursorLine =
      fileId && latestCursorRef.current?.fileId === fileId
        ? latestCursorRef.current.position.lineNumber
        : null;
    flushPendingFileUpdate();
    socketRef.current.emit("chat:private:send", {
      roomId,
      fileId: fileId ?? null,
      content: prompt,
      intent,
      mode: mode ?? undefined,
      cursorLine,
      selection: toAiSelectionContext(selection),
    });
  }

  function handleSummarizeProject() {
    sendPrivateAiRequest({ prompt: "", mode: "assist", intent: "summarize", fileId: liveActiveFile?.id ?? null });
  }
  function handleGenerateFilesFromPrompt(prompt: string, fileId?: string | null) { sendPrivateAiRequest({ prompt, mode: "assist", intent: "generate-files", fileId: fileId ?? liveActiveFile?.id ?? null, selection: editorSelection }); }


  

  function downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  }

  function handleThemeChange(next: IdeThemeId) {
    setIdeThemeId(next);
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("workspace:theme:update", { roomId, theme: next });
  }

  function handleLanguageChange(next: WorkspaceFileLanguage) {
    if (!liveActiveFile || liveActiveFileReadOnlyState.isReadOnly || next === liveActiveFile.language) return;
    setWorkspace((ws) => updateWorkspaceFileLanguage(ws, liveActiveFile.id, next));
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("workspace:file:language", { roomId, fileId: liveActiveFile.id, language: next });
  }

  function handleCreateTemplate(template: WorkspaceTemplateKind) {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("workspace:create:template", { roomId, template });
  }

  async function handleRunCode() {
    if (!canRunCode || !liveActiveFile) return;
    flushPendingFileUpdate();
    if (liveActiveFileCanPreview) { openPreviewInspector(); return; }
    if (!socketRef.current?.connected) return;
    setIsBottomPanelVisible(true); setBottomPanelView("terminal");
    activeRunIdRef.current = null; setConsoleEntries([]); setConsoleStatus("running"); setIsRunningCode(true);
    socketRef.current.emit("code:run", { roomId, fileId: liveActiveFile.id });
  }

  function handleSendSharedChatMessage(content: string) { if (!socketRef.current?.connected) return; socketRef.current.emit("chat:shared:send", { roomId, content }); }

  async function handleDownloadWorkspace() {
    try { const blob = await createWorkspaceZipBlob(workspaceRef.current); downloadBlob(blob, `itecify-${roomId.toLowerCase()}.zip`); showShareFeedback("ZIP downloaded"); }
    catch { showShareFeedback("Export failed"); }
  }

  async function handleCopyFileContent(fileId: string) {
    const file = getWorkspaceFile(workspaceRef.current, fileId);
    if (!file) return;
    try { await navigator.clipboard.writeText(file.content); showShareFeedback("Copied"); }
    catch { showShareFeedback("Copy failed"); }
  }

  function handleDownloadFile(fileId: string) {
    const file = getWorkspaceFile(workspaceRef.current, fileId);
    if (!file) return;
    downloadBlob(new Blob([file.content], { type: "text/plain;charset=utf-8" }), file.name);
    showShareFeedback("Downloaded");
  }

  async function handleLogout() { setIsSigningOut(true); try { await signOutUser(); } finally { setIsSigningOut(false); } }

  function handlePreviewSnapshot(snapshotId: string) { setIsBottomPanelVisible(true); setBottomPanelView("timeline"); setPreviewSnapshotId(snapshotId); }
  function handleTogglePresentation() { if (snapshots.length === 0) return; setPreviewSnapshotId((id) => id ?? snapshots[0]?.id ?? null); setIsPresentationMode((m) => !m); }
  function handleExitPresentation() { setIsPresentationMode(false); }
  function handlePreviousPresentationSnapshot() { if (presentationSnapshotIndex < 0 || presentationSnapshotIndex >= snapshots.length - 1) return; setPreviewSnapshotId(snapshots[presentationSnapshotIndex + 1].id); }
  function handleNextPresentationSnapshot() { if (presentationSnapshotIndex <= 0) return; setPreviewSnapshotId(snapshots[presentationSnapshotIndex - 1].id); }
  function handleRestoreSnapshot(snapshotId: string) { if (!socketRef.current?.connected) return; setPreviewSnapshotId(snapshotId); socketRef.current.emit("snapshot:restore", { roomId, snapshotId }); }

  const handleTerminalInput = useCallback((data: string) => { if (!socketRef.current?.connected) return; socketRef.current.emit("terminal:input", { roomId, data }); }, [roomId]);
  const handleTerminalCommand = useCallback((command: string) => { if (!socketRef.current?.connected) return; socketRef.current.emit("terminal:command", { roomId, command }); }, [roomId]);
  const handleTerminalResize = useCallback((cols: number, rows: number) => { if (!socketRef.current?.connected) return; socketRef.current.emit("terminal:resize", { roomId, cols, rows }); }, [roomId]);
  function handleClearTerminal() { if (!socketRef.current?.connected) return; socketRef.current.emit("terminal:clear", { roomId }); }

  async function handleCopyInviteLink() { try { await navigator.clipboard.writeText(buildSessionInviteUrl(roomId, window.location.origin)); showShareFeedback("Link copied"); } catch { showShareFeedback("Copy failed"); } }

  function handleSelectFile(fileId: string) {
    if (isPresentationMode) return;
    flushPendingFileUpdate();
    const next = normalizeEditorViewState(workspaceRef.current, editorView, { activeFileId: fileId, openFileIds: [...editorView.openFileIds, fileId] });
    setEditorView(next); emitWorkspaceViewUpdate(next);
  }

  function handleCreateFile(parentId: string | null, name: string) { if (!socketRef.current?.connected) return; socketRef.current.emit("workspace:create:file", { roomId, parentId, name }); }
  function handleCreateFolder(parentId: string | null, name: string) { if (!socketRef.current?.connected) return; socketRef.current.emit("workspace:create:folder", { roomId, parentId, name }); }
  function handleRename(nodeId: string, newName: string) { if (!socketRef.current?.connected) return; socketRef.current.emit("workspace:rename", { roomId, nodeId, newName }); }
  function handleDelete(nodeId: string) { if (!socketRef.current?.connected) return; socketRef.current.emit("workspace:delete", { roomId, nodeId }); }
  function handleDuplicate(nodeId: string) { if (!socketRef.current?.connected) return; socketRef.current.emit("workspace:duplicate", { roomId, nodeId }); }
  function handleMove(nodeId: string, targetParentId: string | null) { if (!socketRef.current?.connected) return; socketRef.current.emit("workspace:move", { roomId, nodeId, targetParentId }); }
  function handleFormatFile(fileId: string) { if (!socketRef.current?.connected) return; flushPendingFileUpdate(); socketRef.current.emit("workspace:file:format", { roomId, fileId }); }
  function handleFormatActiveFile() { if (!liveActiveFile) return; handleFormatFile(liveActiveFile.id); }

  function closeTabLocally(fileId: string) {
    const view = editorViewRef.current;
    const idx = view.openFileIds.indexOf(fileId);
    if (idx < 0) return null;
    const nextOpen = view.openFileIds.filter((id) => id !== fileId);
    const nextActive = view.activeFileId === fileId ? nextOpen[idx] ?? nextOpen[idx - 1] ?? "" : view.activeFileId;
    const next = normalizeEditorViewState(workspaceRef.current, view, { activeFileId: nextActive, openFileIds: nextOpen });
    editorViewRef.current = next; setEditorView(next);
    setClosedTabHistory((ids) => [fileId, ...ids.filter((id) => id !== fileId)].slice(0, MAX_CLOSED_TAB_HISTORY));
    return next;
  }

  function requestCloseTab(fileId: string) {
    const isDirty = dirtyFileIdsRef.current.includes(fileId);
    if (isDirty) { const ok = window.confirm(socketRef.current?.connected ? "Unsaved changes. Close and save?" : "Unsaved changes (offline). Close anyway?"); if (!ok) return; }
    if (isDirty && socketRef.current?.connected) { flushPendingFileUpdateRef.current(); }
    else if (isDirty) { setDirtyFileIds((ids) => ids.filter((id) => id !== fileId)); setSaveState("saved"); pendingFileUpdateRef.current = null; }
    const next = closeTabLocally(fileId);
    if (!next || !socketRef.current?.connected) return;
    socketRef.current.emit("workspace:tab:close", { roomId: roomIdRef.current, fileId });
  }

  function handleReopenClosedTab() {
    const id = closedTabHistoryRef.current.find((fid) => Boolean(getWorkspaceFile(workspaceRef.current, fid)));
    if (!id) return;
    flushPendingFileUpdateRef.current();
    setClosedTabHistory((ids) => ids.filter((fid) => fid !== id));
    const next = normalizeEditorViewState(workspaceRef.current, editorViewRef.current, { activeFileId: id, openFileIds: [...editorViewRef.current.openFileIds, id] });
    editorViewRef.current = next; setEditorView(next); emitWorkspaceViewUpdate(next);
  }

  requestCloseTabRef.current = requestCloseTab;
  reopenClosedTabRef.current = handleReopenClosedTab;

  function handleExplorerAiAction(action: "generate-readme" | "add-inline-docs" | "refactor-file" | "generate-tests", nodeId: string | null) {
    const targetNode = nodeId ? workspaceRef.current.nodes.find((n) => n.id === nodeId) ?? null : null;
    const targetFile = targetNode?.kind === "file" ? targetNode : null;
    if (targetFile) handleSelectFile(targetFile.id);
    if (action === "generate-readme") { handleGenerateFilesFromPrompt(targetFile ? `Generate a README.md for ${targetFile.path}.` : "Generate a README.md for this workspace.", targetFile?.id ?? null); return; }
    if (!targetFile) return;
    if (action === "add-inline-docs") { sendPrivateAiRequest({ prompt: "Add concise inline documentation to this file.", mode: "assist", intent: "edit", fileId: targetFile.id }); return; }
    if (action === "refactor-file") { sendPrivateAiRequest({ prompt: "Refactor this file for readability. Return explicit line-by-line edits.", mode: "assist", intent: "edit", fileId: targetFile.id }); return; }
    handleGenerateFilesFromPrompt(`Generate unit tests for ${targetFile.path}.`, targetFile.id);
  }

  function handleUploadProjectZipClick() { projectZipInputRef.current?.click(); }

  async function handleProjectZipSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setProjectImportState({ isImporting: true, progress: 0, message: `Uploading ${file.name}…` });
    try {
      const result = await uploadSessionProjectZip(roomId, file, (progress) => { setProjectImportState((s) => ({ ...s, isImporting: true, progress })); });
      setProjectImportState({ isImporting: false, progress: null, message: `Imported ${result.importedFileCount} files, ${result.importedFolderCount} folders.${result.skippedCount > 0 ? ` Skipped ${result.skippedCount}.` : ""}` });
    } catch (err) {
      setProjectImportState({ isImporting: false, progress: null, message: err instanceof Error ? err.message : "Import failed." });
    } finally { e.target.value = ""; }
  }

  useEffect(() => {
    if (isExplorerVisible) setActivityKey("explorer");
  }, [isExplorerVisible]);

  function handleItecifyActivity(key: ActivityKey) {
    setActivityKey(key);
    if (key === "explorer") {
      setIsExplorerVisible(true);
      return;
    }
    if (key === "search") {
      openOmnibar("search");
      return;
    }
    if (key === "git") {
      openOmnibar("command");
      setOmnibarQuery("");
      return;
    }
    openOmnibar("command");
    setOmnibarQuery("theme");
  }

  const isTerminalLayoutActive = isBottomPanelVisible && bottomPanelView === "terminal";

  return (
    <div
      className="ide-theme-root flex h-full w-full flex-col overflow-hidden bg-background text-foreground"
      data-ide-theme={ideThemeId}
      style={{
        fontFamily:
          ideThemeId === "itecify"
            ? "var(--font-jetbrains-mono), ui-monospace, monospace"
            : "'Segoe UI', var(--font-space-grotesk), system-ui, sans-serif",
      }}
    >
      <input ref={projectZipInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={handleProjectZipSelected} />

      <ItecifyTopBar
        roomId={roomId}
        connectionStatus={connectionStatus}
        consoleStatus={consoleStatus}
        isRunningCode={isRunningCode}
        participants={participants}
        currentUserName={currentUserName}
        shareFeedback={shareFeedback}
        onCopyInviteLink={handleCopyInviteLink}
        onSignOut={handleLogout}
        isSigningOut={isSigningOut}
      />

      <ItecifyCmdBar
        isExplorerVisible={isExplorerVisible}
        isTerminalLayoutActive={isTerminalLayoutActive}
        activeLanguage={liveActiveFile?.language ?? "plaintext"}
        languageDisabled={!liveActiveFile || isPresentationMode || liveActiveFileReadOnlyState.isReadOnly}
        onToggleExplorer={() => {
          handleToggleExplorer();
          setActivityKey("explorer");
        }}
        onToggleTerminal={() => handleToggleBottomPanel("terminal")}
        onQuickOpen={() => openOmnibar("quick-open")}
        onPalette={() => openOmnibar("command")}
        onLanguageChange={handleLanguageChange}
        onFormat={() => {
          if (canFormatFile) handleFormatActiveFile();
        }}
        onPreview={openPreviewInspector}
        onFocusAi={() => {
          openOmnibar("command");
          setOmnibarQuery("ai");
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ItecifyActivityBar active={activityKey} onSelect={handleItecifyActivity} />

          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-[rgba(255,255,255,0.055)] transition-[width] duration-150"
            style={{ width: isExplorerVisible ? 220 : 0 }}
          >
            {isExplorerVisible ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0f1118]">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <IdeFileExplorer
                    roomId={roomId}
                    workspace={workspace}
                    activeFileId={editorView.activeFileId}
                    isImportingProject={projectImportState.isImporting}
                    isEmptyWorkspacePromptDismissed={isEmptyWorkspacePromptDismissed}
                    importStatusMessage={projectImportState.message}
                    onSelect={handleSelectFile}
                    onDismissEmptyWorkspacePrompt={() => setIsEmptyWorkspacePromptDismissed(true)}
                    onUploadProjectZip={handleUploadProjectZipClick}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onMove={handleMove}
                    onFormatFile={handleFormatFile}
                    onCreateTemplate={handleCreateTemplate}
                    showHiddenFiles={showHiddenFiles}
                    onToggleHiddenFiles={() => setShowHiddenFiles((s) => !s)}
                    onCopyFileContent={handleCopyFileContent}
                    onDownloadFile={handleDownloadFile}
                    onAiFileAction={handleExplorerAiAction}
                  />
                </div>
                <div className="shrink-0 border-t border-[rgba(255,255,255,0.055)] px-3 py-2">
                  <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-[#626880]">Selection</p>
                  <p className="mt-1 truncate font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#a8abbe]">
                    {liveActiveFile ? liveActiveFile.path : "Workspace root"}
                  </p>
                </div>
                <ItecifySidebarPresence
                  participants={participants}
                  currentUserName={currentUserName}
                  currentUserSocketId={currentSocketId}
                  workspaceFiles={workspaceFiles.map((f) => ({ id: f.id, name: f.name }))}
                  remoteCursors={remoteCursors}
                />
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-[#0b0d12]">
                <div className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-[rgba(255,255,255,0.055)] bg-[#0f1118]">
                  <IdeEditorTabs
                    tabs={displayedOpenFiles.map((file) => ({
                      id: file.id,
                      name: file.name,
                      path: file.path,
                      icon: getFileIcon(file),
                      extension: file.name.includes(".") ? `.${file.name.split(".").pop() ?? ""}` : undefined,
                      editable: true,
                      isDirty: dirtyFileIds.includes(file.id),
                      isReadOnly: getWorkspaceFileReadOnlyState(file).isReadOnly,
                    }))}
                    activeTabId={displayedActiveFile?.id ?? ""}
                    onSelect={handleSelectFile}
                    onClose={(id) => requestCloseTab(id)}
                    disabled={isPresentationMode}
                  />
                </div>

                <ItecifyBreadcrumb
                  activeFile={displayedActiveFile}
                  saveState={saveState}
                  isReadOnly={liveActiveFileReadOnlyState.isReadOnly}
                />

                <div className="relative min-h-0 flex-1 overflow-hidden bg-[#0b0d12]">
                {isPresentationMode && presentationSnapshot && (
                  <PresentationOverlay
                    snapshot={presentationSnapshot}
                    hasPrevious={presentationSnapshotIndex < snapshots.length - 1}
                    hasNext={presentationSnapshotIndex > 0}
                    onPrevious={handlePreviousPresentationSnapshot}
                    onNext={handleNextPresentationSnapshot}
                    onExit={handleExitPresentation}
                  />
                )}

                {displayedActiveFile ? (
                  <CollaborativeEditor
                    ideTheme={ideThemeId}
                    readOnly={isPresentationMode || liveActiveFileReadOnlyState.isReadOnly}
                    language={toMonacoLanguage(displayedActiveFile.language)}
                    value={displayedActiveFile.content}
                    revealRequest={editorRevealRequest?.fileId === displayedActiveFile.id ? { lineNumber: editorRevealRequest.lineNumber, nonce: editorRevealRequest.nonce } : null}
                    onChange={handleEditorChange}
                    onCursorChange={handleCursorChange}
                    onSelectionChange={handleSelectionChange}
                    remoteCursors={isPresentationMode ? [] : visibleRemoteCursors}
                  />
                ) : (
                  /* Welcome / empty state — VS Code style */
                  <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
                    <div className="text-center max-w-sm px-6">
                      <p className="text-[13px] text-[#858585] mb-6">
                        {workspaceFiles.length > 0 ? "Open a file from the Explorer to start editing." : "No files in this workspace yet."}
                      </p>
                      <div className="flex flex-col gap-2 items-center">
                        {workspaceFiles.length === 0 && (
                          <button type="button" onClick={handleUploadProjectZipClick} disabled={projectImportState.isImporting} className="w-full px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-[12px] transition-colors disabled:opacity-50 rounded">
                            {projectImportState.isImporting ? `Uploading… ${projectImportState.progress ?? 0}%` : "Upload Project ZIP"}
                          </button>
                        )}
                        <button type="button" onClick={() => handleCreateFile(null, "untitled.js")} className="w-full px-4 py-2 border border-[#3C3C3C] text-[#CCCCCC] hover:bg-[#2A2D2E] text-[12px] transition-colors">New File</button>
                        {closedTabHistory.length > 0 && (
                          <button type="button" onClick={handleReopenClosedTab} className="w-full px-4 py-2 border border-[#3c3c3c] text-[#cccccc] hover:bg-[#2a2d2e] text-[12px] transition-colors rounded">Reopen Closed Tab</button>
                        )}
                      </div>
                      {projectImportState.message && (
                        <p className="mt-4 text-[11px] text-[#858585]">{projectImportState.message}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <IdeStatusBar
                line={editorCursorPos.lineNumber}
                column={editorCursorPos.column}
                languageLabel={liveActiveFile ? getWorkspaceLanguageLabel(liveActiveFile.language) : "Plain Text"}
                connectionStatus={connectionStatus}
                saveState={saveState}
                isRunningCode={isRunningCode}
                lastRunExitCode={lastRunInfo?.exitCode ?? null}
                lastRunFailed={lastRunInfo?.failed ?? false}
                onDownloadWorkspace={handleDownloadWorkspace}
              />
            </div>

            <div className="w-[min(280px,32vw)] shrink-0 overflow-hidden border-l border-[rgba(255,255,255,0.055)] bg-[#0f1118] min-h-0">
              <CollaborationSidebar
                messages={sharedChatMessages}
                participants={participants}
                activity={activityFeed}
                currentUserId={currentUserId}
                onSendMessage={handleSendSharedChatMessage}
                canSend={connectionStatus === "connected"}
                currentUserName={currentUserName}
                currentUserSocketId={currentSocketId}
                workspaceFiles={workspaceFiles.map((f) => ({ id: f.id, name: f.name }))}
                remoteCursors={remoteCursors}
              />
            </div>
          </div>

          <div
            className="shrink-0 overflow-hidden border-t border-[rgba(255,255,255,0.055)] transition-all duration-150"
            style={{ height: isBottomPanelVisible ? "clamp(140px, 28vh, 300px)" : 0 }}
          >
            {isBottomPanelVisible && (
              <IdeBottomPanel
                activeTab={bottomPanelView}
                onSelectTab={handleSelectBottomPanelView}
                roomId={roomId}
                terminalEntries={terminalEntries}
                canInteractTerminal={connectionStatus === "connected"}
                onInputTerminal={handleTerminalInput}
                onResizeTerminal={handleTerminalResize}
                onClearTerminal={handleClearTerminal}
                onTerminalCommand={handleTerminalCommand}
                onRunActiveFileFromTerminal={handleRunCode}
                canRunActiveFileFromTerminal={canRunCode}
                activeFileLabel={liveActiveFile?.name ?? null}
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
                onHelp={() => openOmnibar("command")}
                onRunActive={handleRunCode}
                onLivePty={() => {
                  setBottomPanelView("terminal");
                  setIsBottomPanelVisible(true);
                }}
              />
            )}
          </div>
        </div>
      </div>
      </div>

      {shortcutsOpen ? (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1a1d26] p-5 text-[#e8eaf2] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-[family-name:var(--font-syne)] text-lg font-semibold text-[#4ecdc4]">
              Keyboard shortcuts
            </h2>
            <ul className="mt-4 space-y-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] leading-6 text-[#a8abbe]">
              <li><span className="text-[#626880]">⌘/Ctrl+⇧P</span> — Command palette</li>
              <li><span className="text-[#626880]">⌘/Ctrl+P</span> — Quick open</li>
              <li><span className="text-[#626880]">⌘/Ctrl+⇧F</span> — Search in files</li>
              <li><span className="text-[#626880]">⌘/Ctrl+B</span> — Toggle explorer</li>
              <li><span className="text-[#626880]">⌘/Ctrl+J</span> — Toggle terminal</li>
              <li><span className="text-[#626880]">⌘/Ctrl+S</span> — Save (sync)</li>
              <li><span className="text-[#626880]">⌘/Ctrl+⇧T</span> — Reopen closed tab</li>
              <li><span className="text-[#626880]">⌘/Ctrl+W</span> — Close tab</li>
              <li><span className="text-[#626880]">⇧⌥F</span> — Format document</li>
            </ul>
            <button
              type="button"
              className="mt-5 w-full rounded border border-[rgba(78,205,196,0.35)] py-2 text-[12px] text-[#4ecdc4] transition hover:bg-[rgba(78,205,196,0.08)]"
              onClick={() => setShortcutsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {/* Command palette / omnibar */}
      <WorkspaceOmnibar
        isOpen={isOmnibarOpen}
        mode={omnibarMode}
        query={omnibarQuery}
        quickOpenItems={quickOpenItems}
        fileSearchItems={fileSearchItems}
        contentSearchItems={contentSearchItems}
        commandItems={commandItems}
        commandPrompt={commandPrompt}
        onClose={closeOmnibar}
        onModeChange={(m) => { setOmnibarMode(m); setCommandPrompt(null); setOmnibarQuery(""); }}
        onQueryChange={setOmnibarQuery}
        onSelectQuickOpen={(id) => handleOpenFileFromOmnibar(id)}
        onSelectSearch={(id, ln) => handleOpenFileFromOmnibar(id, ln)}
        onSelectCommand={handleSelectCommand}
        onSubmitCommandPrompt={handleSubmitCommandPrompt}
        onCancelCommandPrompt={() => setCommandPrompt(null)}
      />
    </div>
  );
}
