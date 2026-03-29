"use client";

import type { ReactNode } from "react";
import type { Participant, RemoteCursor, WorkspaceFileLanguage } from "@/lib/socket";
import { formatSessionCodeForDisplay } from "@/lib/session";
import type { RunCodeStatus } from "@/lib/run-code";
import { getWorkspaceLanguageLabel } from "@/lib/workspace";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

type TopBarProps = {
  roomId: string;
  connectionStatus: ConnectionStatus;
  consoleStatus: RunCodeStatus;
  isRunningCode: boolean;
  participants: Participant[];
  currentUserName: string;
  shareFeedback: string | null;
  onCopyInviteLink: () => void;
  onSignOut?: () => void;
  isSigningOut?: boolean;
};

export function ItecifyTopBar({
  roomId,
  connectionStatus,
  consoleStatus,
  isRunningCode,
  participants,
  currentUserName,
  shareFeedback,
  onCopyInviteLink,
  onSignOut,
  isSigningOut = false,
}: TopBarProps) {
  const sessionDisplay = formatSessionCodeForDisplay(roomId);
  const conn =
    connectionStatus === "connected"
      ? { dot: "bg-[#4ecdc4] shadow-[0_0_5px_#4ecdc4]", label: "connected" }
      : connectionStatus === "connecting"
        ? { dot: "bg-[#e8a23a]", label: "connecting" }
        : { dot: "bg-[#e05c6a]", label: "disconnected" };

  const run =
    isRunningCode || consoleStatus === "running"
      ? { dot: "bg-[#4ecdc4]", label: "running" }
      : consoleStatus === "error"
        ? { dot: "bg-[#e05c6a]", label: "run error" }
        : { dot: "bg-[#e8a23a]", label: "idle" };

  const avatars = participants.slice(0, 6);
  const avClass = (i: number) => {
    const palette = ["av-teal", "av-pur", "av-amb"] as const;
    const k = palette[i % palette.length];
    if (k === "av-teal") return "bg-[rgba(78,205,196,0.2)] text-[#4ecdc4]";
    if (k === "av-pur") return "bg-[rgba(139,124,248,0.2)] text-[#8b7cf8]";
    return "bg-[rgba(232,162,58,0.18)] text-[#e8a23a]";
  };

  return (
    <header className="flex h-[38px] flex-shrink-0 select-none items-center border-b border-[rgba(255,255,255,0.055)] bg-[#0f1118] px-3 text-[12px] text-[#e8eaf2]">
      <div className="flex-shrink-0 font-[family-name:var(--font-syne)] text-[14px] font-bold tracking-[-0.02em] text-[#4ecdc4]">
        iTECify
      </div>

      <div className="ml-5 flex flex-1 items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-normal uppercase tracking-[0.12em] text-[#3d4259]">session</span>
          <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#3d4259]" />
          <span className="tracking-[0.06em] text-[#a8abbe]">{sessionDisplay}</span>
        </div>
        <div className="h-3.5 w-px flex-shrink-0 bg-[rgba(255,255,255,0.09)]" />
        <div className="flex items-center gap-1.5 text-[10px] text-[#626880]">
          <span className={`h-[5px] w-[5px] flex-shrink-0 rounded-full ${conn.dot}`} />
          <span>{conn.label}</span>
        </div>
        <div className="h-3.5 w-px flex-shrink-0 bg-[rgba(255,255,255,0.09)]" />
        <div className="flex items-center gap-1.5 text-[10px] text-[#626880]">
          <span className={`h-[5px] w-[5px] flex-shrink-0 rounded-full ${run.dot}`} />
          <span>{run.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center">
          {avatars.map((p, i) => (
            <div
              key={p.socketId}
              className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#0f1118] font-[family-name:var(--font-syne)] text-[8.5px] font-semibold first:ml-0 -ml-[5px] cursor-default ${avClass(i)}`}
              title={p.name}
            >
              {initials(p.name)}
            </div>
          ))}
        </div>
        <div className="rounded border border-[rgba(255,255,255,0.09)] bg-[#181c27] px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.03em] text-[#a8abbe]">
          {currentUserName}
          <span className="ml-1 text-[9px] text-[#4ecdc4]">you</span>
        </div>
        <button
          type="button"
          onClick={onCopyInviteLink}
          className="rounded border border-[rgba(78,205,196,0.22)] bg-[rgba(78,205,196,0.04)] px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#4ecdc4] transition hover:bg-[rgba(78,205,196,0.1)]"
          title="Copy invite link"
        >
          Share link
        </button>
        {shareFeedback ? (
          <span className="max-w-[140px] truncate text-[10px] text-[#4ecdc4]">{shareFeedback}</span>
        ) : null}
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="rounded px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#626880] transition hover:text-[#a8abbe] disabled:opacity-50"
            title="Sign out of your account"
          >
            {isSigningOut ? "…" : "Sign out"}
          </button>
        ) : null}
      </div>
    </header>
  );
}

type CmdBarProps = {
  isExplorerVisible: boolean;
  isTerminalLayoutActive: boolean;
  activeLanguage: WorkspaceFileLanguage;
  languageDisabled: boolean;
  onToggleExplorer: () => void;
  onToggleTerminal: () => void;
  onQuickOpen: () => void;
  onPalette: () => void;
  onLanguageChange: (l: WorkspaceFileLanguage) => void;
  onFormat: () => void;
  onPreview: () => void;
  onFocusAi: () => void;
};

export function ItecifyCmdBar({
  isExplorerVisible,
  isTerminalLayoutActive,
  activeLanguage,
  languageDisabled,
  onToggleExplorer,
  onToggleTerminal,
  onQuickOpen,
  onPalette,
  onLanguageChange,
  onFormat,
  onPreview,
  onFocusAi,
}: CmdBarProps) {
  const cmd = (active: boolean) =>
    active
      ? "bg-[#1e2230] text-[#e8eaf2]"
      : "bg-transparent text-[#626880] hover:bg-[#1e2230] hover:text-[#a8abbe]";

  return (
    <div className="flex h-[34px] flex-shrink-0 items-center gap-0.5 border-b border-[rgba(255,255,255,0.055)] bg-[#0f1118] px-3">
      <div className="flex items-center gap-px">
        <button
          type="button"
          onClick={onToggleExplorer}
          className={`flex h-6 items-center gap-1.5 rounded px-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] transition ${cmd(isExplorerVisible)}`}
          title="Files (⌘B)"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1" y="1" width="4" height="4" rx="0.8" />
            <rect x="7" y="1" width="4" height="4" rx="0.8" />
            <rect x="1" y="7" width="4" height="4" rx="0.8" />
            <rect x="7" y="7" width="4" height="4" rx="0.8" />
          </svg>
          Explorer
        </button>
        <button
          type="button"
          onClick={onToggleTerminal}
          className={`flex h-6 items-center gap-1.5 rounded px-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] transition ${cmd(isTerminalLayoutActive)}`}
          title="Terminal panel (⌘J)"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1" y="1" width="10" height="10" rx="1.5" />
            <line x1="3.5" y1="4.5" x2="8.5" y2="4.5" />
            <line x1="3.5" y1="6.5" x2="8.5" y2="6.5" />
            <line x1="3.5" y1="8.5" x2="6" y2="8.5" />
          </svg>
          Terminal
        </button>
      </div>

      <div className="mx-1.5 h-4 w-px flex-shrink-0 bg-[rgba(255,255,255,0.09)]" />

      <div className="flex items-center gap-px">
        <button
          type="button"
          onClick={onQuickOpen}
          className="flex h-6 items-center gap-1.5 rounded px-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[#626880] transition hover:bg-[#1e2230] hover:text-[#a8abbe]"
          title="Quick open (⌘P)"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="5" cy="5" r="3.5" />
            <line x1="8" y1="8" x2="11" y2="11" />
          </svg>
          Quick open
        </button>
        <button
          type="button"
          onClick={onPalette}
          className="flex h-6 items-center gap-1.5 rounded px-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[#626880] transition hover:bg-[#1e2230] hover:text-[#a8abbe]"
          title="Command palette (⌘⇧P)"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M2 4h8M2 8h5" strokeLinecap="round" />
          </svg>
          Palette
        </button>
      </div>

      <div className="mx-1.5 h-4 w-px flex-shrink-0 bg-[rgba(255,255,255,0.09)]" />

      <div className="flex items-center gap-1">
        <select
          value={activeLanguage}
          disabled={languageDisabled}
          onChange={(e) => onLanguageChange(e.target.value as WorkspaceFileLanguage)}
          className="h-6 cursor-pointer rounded border border-[rgba(255,255,255,0.09)] bg-[#181c27] px-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[#626880] disabled:opacity-40"
        >
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {getWorkspaceLanguageLabel(l)}
            </option>
          ))}
        </select>
        <button type="button" onClick={onFormat} className="rounded px-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[#626880] hover:bg-[#1e2230] hover:text-[#a8abbe]">
          Format
        </button>
        <button type="button" onClick={onPreview} className="rounded px-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[#626880] hover:bg-[#1e2230] hover:text-[#a8abbe]">
          Preview
        </button>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onFocusAi}
        className="flex h-6 items-center gap-1.5 rounded border border-[rgba(78,205,196,0.22)] bg-[rgba(78,205,196,0.04)] px-3 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[#4ecdc4] transition hover:border-[#4ecdc4] hover:bg-[rgba(78,205,196,0.1)]"
        title="AI assistant"
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.5 2.5l1.4 1.4M8.1 8.1l1.4 1.4M2.5 9.5l1.4-1.4M8.1 3.9l1.4-1.4" strokeLinecap="round" />
        </svg>
        AI
      </button>
    </div>
  );
}

export type ActivityKey = "explorer" | "search" | "git" | "settings";

type ActivityBarProps = {
  active: ActivityKey | null;
  onSelect: (key: ActivityKey) => void;
};

export function ItecifyActivityBar({ active, onSelect }: ActivityBarProps) {
  const ring = (key: ActivityKey, title: string, node: ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={() => onSelect(key)}
      className={`relative flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-md text-[#3d4259] transition hover:bg-[#1e2230] hover:text-[#a8abbe] ${
        active === key ? "bg-[#1e2230] text-[#4ecdc4] before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-r before:bg-[#4ecdc4]" : ""
      }`}
    >
      {node}
    </button>
  );

  return (
    <nav
      className="flex w-11 flex-shrink-0 flex-col items-center gap-0.5 border-r border-[rgba(255,255,255,0.055)] bg-[#0f1118] py-2"
      aria-label="Workspace tools"
    >
      {ring(
        "explorer",
        "Files",
        <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z" />
        </svg>,
      )}
      {ring(
        "search",
        "Search workspace (⌘⇧F)",
        <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="6.5" cy="6.5" r="4" />
          <line x1="10" y1="10" x2="14" y2="14" />
        </svg>,
      )}
      {ring(
        "git",
        "Command palette",
        <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="4" cy="4" r="2" />
          <circle cx="12" cy="4" r="2" />
          <circle cx="4" cy="12" r="2" />
          <line x1="4" y1="6" x2="4" y2="10" />
          <path d="M12 6Q12 10 4 10" />
        </svg>,
      )}
      <div className="min-h-0 flex-1" />
      {ring(
        "settings",
        "Settings & themes",
        <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1" />
        </svg>,
      )}
    </nav>
  );
}

type PresenceProps = {
  participants: Participant[];
  currentUserName: string;
  currentUserSocketId: string | null;
  workspaceFiles: { id: string; name: string }[];
  remoteCursors: RemoteCursor[];
};

export function ItecifySidebarPresence({
  participants,
  currentUserName,
  currentUserSocketId,
  workspaceFiles,
  remoteCursors,
}: PresenceProps) {
  const fileLabel = (fileId: string) => workspaceFiles.find((f) => f.id === fileId)?.name ?? "…";

  return (
    <div className="mt-auto border-t border-[rgba(255,255,255,0.055)] px-2.5 py-2">
      <p className="mb-1.5 text-[9px] uppercase tracking-[0.1em] text-[#3d4259]">Team · {participants.length}</p>
      <div className="max-h-[140px] space-y-1 overflow-y-auto">
        {participants.map((p, i) => {
          const isYou =
            p.socketId === currentUserSocketId ||
            (p.socketId === "local-user" && p.name === currentUserName);
          const cursor = remoteCursors.find((c) => c.socketId === p.socketId);
          const loc = cursor
            ? `${fileLabel(cursor.fileId)} · line ${cursor.position.lineNumber}`
            : isYou
              ? "in this session"
              : "viewing…";
          const dot = i % 3 === 0 ? "bg-[#4ecdc4]" : i % 3 === 1 ? "bg-[#8b7cf8]" : "bg-[#3d4259]";
          const av =
            i % 3 === 0
              ? "bg-[rgba(78,205,196,0.2)] text-[#4ecdc4]"
              : i % 3 === 1
                ? "bg-[rgba(139,124,248,0.2)] text-[#8b7cf8]"
                : "bg-[rgba(232,162,58,0.18)] text-[#e8a23a]";

          return (
            <div key={p.socketId} className="flex items-center gap-1.5 py-1">
              <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-syne)] text-[8px] font-semibold ${av}`}>
                {initials(p.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10.5px] text-[#a8abbe]">{p.name}</div>
                <div className="truncate text-[9.5px] text-[#626880]" title={loc}>
                  {loc}
                </div>
              </div>
              <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
