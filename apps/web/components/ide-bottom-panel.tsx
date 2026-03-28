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
}: IdeBottomPanelProps) {
  const tabs: Array<{ id: BottomPanelTab; label: string }> = [
    { id: "terminal", label: "Terminal" },
    { id: "output", label: "Output" },
    { id: "timeline", label: "Timeline" },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--panel-bg)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Integrated Panel
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            Shared terminal activity, run output, and time-travel tools live together below the editor.
          </p>
        </div>
        <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Bottom Panel
        </span>
      </div>

      <div className="flex border-b border-[var(--line)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition ${tabButtonClasses(
              activeTab === tab.id,
            )}`}
          >
            {tab.label}
          </button>
        ))}
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
