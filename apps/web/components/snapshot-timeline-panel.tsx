"use client";

import type { RoomSnapshot, WorkspaceState } from "@/lib/socket";
import { getWorkspaceFile, serializeWorkspace } from "@/lib/workspace";

type SnapshotTimelinePanelProps = {
  snapshots: RoomSnapshot[];
  previewSnapshotId: string | null;
  liveWorkspace: WorkspaceState;
  canRestore: boolean;
  isPresentationMode: boolean;
  onPreview: (snapshotId: string) => void;
  onRestore: (snapshotId: string) => void;
  onTogglePresentation: () => void;
};

function formatSnapshotTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmptyState() {
  return (
    <div className="border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel-soft)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
        No Snapshots Yet
      </p>
      <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">
        Auto checkpoints will appear here after meaningful workspace edits, runs, and restore actions.
      </p>
    </div>
  );
}

export function SnapshotTimelinePanel({
  snapshots,
  previewSnapshotId,
  liveWorkspace,
  canRestore,
  isPresentationMode,
  onPreview,
  onRestore,
  onTogglePresentation,
}: SnapshotTimelinePanelProps) {
  const selectedSnapshot =
    snapshots.find((snapshot) => snapshot.id === previewSnapshotId) ??
    snapshots[0] ??
    null;
  const liveWorkspaceFingerprint = serializeWorkspace(liveWorkspace);
  const selectedFile = selectedSnapshot
    ? getWorkspaceFile(
        selectedSnapshot.workspace,
        selectedSnapshot.workspace.activeFileId,
      )
    : null;

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--panel-bg)] p-3">
      <div className="mb-3 border-b border-[var(--line)] pb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">
          Time Travel
        </h2>
        <p className="mt-2 max-w-sm text-[12px] leading-5 text-[var(--text-muted)]">
          Workspace snapshots now capture the file tree, tabs, active file, and per-file content together.
        </p>
      </div>

      {snapshots.length === 0 ? <EmptyState /> : null}

      {snapshots.length > 0 ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-rows-[minmax(0,0.95fr)_minmax(220px,1.05fr)]">
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {snapshots.map((snapshot, index) => {
              const isSelected = selectedSnapshot?.id === snapshot.id;
              const isLive =
                serializeWorkspace(snapshot.workspace) === liveWorkspaceFingerprint;

              return (
                <button
                  key={snapshot.id}
                  type="button"
                  onClick={() => onPreview(snapshot.id)}
                  className={`w-full border p-3 text-left transition ${
                    isSelected
                      ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] bg-[var(--bg-panel-soft)] hover:border-[var(--line-strong)] hover:bg-[var(--editor-tab-hover-bg)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {snapshot.label}
                      </p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {snapshot.workspace.openFileIds.length} tabs ·{" "}
                        {snapshot.workspace.nodes.filter((node) => node.kind === "file").length} files
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {formatSnapshotTime(snapshot.createdAt)}
                      </span>
                      {index === 0 ? (
                        <span className="border border-cyan-400/12 bg-cyan-400/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-300">
                          Latest
                        </span>
                      ) : null}
                      {isLive ? (
                        <span className="border border-emerald-400/12 bg-emerald-400/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                          Live
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedSnapshot ? (
            <div className="flex min-h-0 flex-col border border-[var(--line)] bg-[var(--editor-inline)] p-4">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedSnapshot.label}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Preview only. Restore explicitly to replace the live workspace.
                  </p>
                </div>
                <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {selectedFile?.name ?? "No file"}
                </span>
              </div>

              <pre className="mt-3 min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-6 text-[var(--terminal-text)]">
                <code>{selectedFile?.content ?? "No file content available in this snapshot."}</code>
              </pre>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
                <p className="text-xs text-[var(--text-muted)]">
                  {formatSnapshotTime(selectedSnapshot.createdAt)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onTogglePresentation}
                    className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)]"
                  >
                    {isPresentationMode ? "Exit Present" : "Present"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !canRestore ||
                      serializeWorkspace(selectedSnapshot.workspace) ===
                        liveWorkspaceFingerprint
                    }
                    onClick={() => onRestore(selectedSnapshot.id)}
                    className="border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent)] transition hover:border-[rgba(82,199,184,0.32)] hover:bg-[rgba(82,199,184,0.18)] disabled:cursor-not-allowed disabled:border-[rgba(148,163,184,0.08)] disabled:bg-white/[0.03] disabled:text-[var(--text-muted)]"
                  >
                    {serializeWorkspace(selectedSnapshot.workspace) ===
                    liveWorkspaceFingerprint
                      ? "Live Now"
                      : "Restore Snapshot"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
