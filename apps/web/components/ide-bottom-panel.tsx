"use client";

import { ConsolePanel } from "./console-panel";
import { SharedTerminalPanel } from "./shared-terminal-panel";
import { SnapshotTimelinePanel } from "./snapshot-timeline-panel";
import type { ConsoleEntry, RunCodeStatus } from "@/lib/run-code";
import type { RoomSnapshot, TerminalEntry, WorkspaceState } from "@/lib/socket";

type BottomPanelTab = "terminal" | "output" | "timeline";

type IdeBottomPanelProps = {
  activeTab: BottomPanelTab;
  onSelectTab: (tab: BottomPanelTab) => void;
  roomId: string;
  terminalEntries: TerminalEntry[];
  canInteractTerminal: boolean;
  onInputTerminal: (data: string) => void;
  onResizeTerminal: (cols: number, rows: number) => void;
  onClearTerminal: () => void;
  onTerminalCommand: (command: string) => void;
  onRunActiveFileFromTerminal: () => void;
  canRunActiveFileFromTerminal: boolean;
  activeFileLabel?: string | null;
  consoleEntries: ConsoleEntry[];
  consoleStatus: RunCodeStatus;
  snapshots: RoomSnapshot[];
  previewSnapshotId: string | null;
  liveWorkspace: WorkspaceState;
  canRestoreSnapshot: boolean;
  isPresentationMode: boolean;
  onPreviewSnapshot: (snapshotId: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onTogglePresentation: () => void;
  onHelp?: () => void;
  onRunActive?: () => void;
  onLivePty?: () => void;
};

function tabButtonClasses(active: boolean) {
  return active
    ? "border-b-[var(--accent)] bg-[var(--editor-tab-active-bg)] text-[var(--text-primary)]"
    : "border-b-transparent bg-[var(--editor-tab-bg)] text-[var(--text-muted)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)]";
}

export function IdeBottomPanel({
  activeTab,
  onSelectTab,
  roomId,
  terminalEntries,
  canInteractTerminal,
  onInputTerminal,
  onResizeTerminal,
  onClearTerminal,
  onTerminalCommand,
  onRunActiveFileFromTerminal,
  canRunActiveFileFromTerminal,
  activeFileLabel,
  consoleEntries,
  consoleStatus,
  snapshots,
  previewSnapshotId,
  liveWorkspace,
  canRestoreSnapshot,
  isPresentationMode,
  onPreviewSnapshot,
  onRestoreSnapshot,
  onTogglePresentation,
  onHelp,
  onRunActive,
  onLivePty,
}: IdeBottomPanelProps) {
  const tabs: Array<{ id: BottomPanelTab; label: string }> = [
    { id: "terminal", label: "Terminal" },
    { id: "output", label: "Output" },
    { id: "timeline", label: "Timeline" },
  ];
  const timelineBadge = snapshots.length;

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--panel-bg)]">
      <div className="flex h-7.5 shrink-0 items-center border-b border-[var(--line)] px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`flex h-7.5 items-center gap-1 border-b-2 px-3 text-[11px] font-medium transition ${tabButtonClasses(
              activeTab === tab.id,
            )}`}
          >
            {tab.label}
            {tab.id === "timeline" && timelineBadge > 0 ? (
              <span className="rounded bg-[rgba(224,92,106,0.15)] px-1 py-px text-[9px] text-[#e05c6a]">
                {timelineBadge}
              </span>
            ) : null}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 pr-1">
          {onHelp ? (
            <button
              type="button"
              onClick={onHelp}
              className="h-5.5 rounded border border-[rgba(255,255,255,0.09)] bg-[#181c27] px-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#626880] hover:bg-[#1e2230] hover:text-[#a8abbe]"
              title="Command palette (⌘⇧P)"
            >
              Help
            </button>
          ) : null}
          {onRunActive ? (
            <button
              type="button"
              onClick={onRunActive}
              disabled={!canRunActiveFileFromTerminal}
              className="h-5.5 rounded border border-[rgba(78,205,196,0.22)] bg-[rgba(78,205,196,0.04)] px-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#4ecdc4] hover:bg-[rgba(78,205,196,0.12)] disabled:opacity-40"
              title="Run the active file"
            >
              Run active
            </button>
          ) : null}
          {onLivePty ? (
            <button
              type="button"
              onClick={onLivePty}
              className="h-5.5 rounded border border-[rgba(232,162,58,0.25)] bg-[rgba(232,162,58,0.06)] px-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#e8a23a] hover:bg-[rgba(232,162,58,0.12)]"
              title="Show the shared terminal"
            >
              Live PTY
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClearTerminal}
            className="h-5.5 rounded border border-[rgba(255,255,255,0.09)] bg-[#181c27] px-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[#626880] hover:bg-[#1e2230]"
            title="Clear terminal buffer"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "terminal" ? (
          <SharedTerminalPanel
            roomId={roomId}
            entries={terminalEntries}
            canInteract={canInteractTerminal}
            onInput={onInputTerminal}
            onResize={onResizeTerminal}
            onClear={onClearTerminal}
            onCommand={onTerminalCommand}
            onRunActiveFile={onRunActiveFileFromTerminal}
            canRunActiveFile={canRunActiveFileFromTerminal}
            activeFileLabel={activeFileLabel}
          />
        ) : null}

        {activeTab === "output" ? (
          <ConsolePanel entries={consoleEntries} status={consoleStatus} />
        ) : null}

        {activeTab === "timeline" ? (
          <SnapshotTimelinePanel
            snapshots={snapshots}
            previewSnapshotId={previewSnapshotId}
            liveWorkspace={liveWorkspace}
            canRestore={canRestoreSnapshot}
            isPresentationMode={isPresentationMode}
            onPreview={onPreviewSnapshot}
            onRestore={onRestoreSnapshot}
            onTogglePresentation={onTogglePresentation}
          />
        ) : null}
      </div>
    </section>
  );
}
