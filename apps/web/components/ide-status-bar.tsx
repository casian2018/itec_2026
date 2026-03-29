"use client";

import type { ConnectionStatus } from "@/components/itecify-workspace-chrome";

type SaveState = "saved" | "saving" | "unsaved";

type IdeStatusBarProps = {
  line: number;
  column: number;
  languageLabel: string;
  connectionStatus: ConnectionStatus;
  saveState: SaveState;
  isRunningCode: boolean;
  lastRunExitCode: number | null;
  lastRunFailed: boolean;
};

export function IdeStatusBar({
  line,
  column,
  languageLabel,
  connectionStatus,
  saveState,
  isRunningCode,
  lastRunExitCode,
  lastRunFailed,
}: IdeStatusBarProps) {
  const conn =
    connectionStatus === "connected"
      ? { label: "Connected", className: "text-[#4ecdc4]" }
      : connectionStatus === "connecting"
        ? { label: "Connecting", className: "text-[#e8a23a]" }
        : { label: "Disconnected", className: "text-[#e05c6a]" };

  const save =
    saveState === "unsaved"
      ? "Unsaved"
      : saveState === "saving"
        ? "Saving…"
        : "Saved";

  let runLabel = "Idle";
  if (isRunningCode) runLabel = "Running…";
  else if (lastRunExitCode !== null) {
    if (lastRunExitCode === 124) runLabel = "Last run: timed out (10s)";
    else runLabel = `Last run: exit ${lastRunExitCode}${lastRunFailed ? " (failed)" : ""}`;
  }

  return (
    <div
      className="flex h-5.5 shrink-0 select-none items-center gap-4 border-t border-[rgba(255,255,255,0.055)] bg-(--statusbar-bg,#0f1118) px-3 font-(family-name:--font-jetbrains-mono) text-[10px] text-(--statusbar-text,#a8abbe)"
      role="status"
    >
      <span>
        Ln {line}, Col {column}
      </span>
      <span className="text-[#626880]">|</span>
      <span>{languageLabel}</span>
      <span className="text-[#626880]">|</span>
      <span>UTF-8</span>
      <span className="text-[#626880]">|</span>
      <span className={conn.className}>{conn.label}</span>
      <span className="text-[#626880]">|</span>
      <span className={saveState === "unsaved" ? "text-[#e8a23a]" : ""}>{save}</span>
      <span className="ml-auto text-[#626880]">{runLabel}</span>
      <span className="text-[#3d4259]" title="Docker runs stop after 10s">
        Exec ≤10s
      </span>
    </div>
  );
}
