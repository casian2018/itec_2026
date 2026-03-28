"use client";

import type { WorkspaceFileNode, WorkspaceState } from "@/lib/socket";
import {
  buildWorkspacePreviewDocument,
  getPreviewFiles,
  getRuntimeLabel,
  getWorkspaceFiles,
  getWorkspaceLanguageLabel,
} from "@/lib/workspace";

type IdePreviewPanelProps = {
  activeFile: WorkspaceFileNode | null;
  workspace: WorkspaceState;
  connectionLabel: string;
  participantCount: number;
  snapshotCount: number;
  terminalEntryCount: number;
  isRunningCode: boolean;
};

function EmptyPreviewState() {
  return (
    <div className="border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel-soft)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Live Preview Not Ready
      </p>
      <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">
        Add an{" "}
        <span className="font-mono text-[var(--text-primary)]">index.html</span>{" "}
        file and optionally pair it with{" "}
        <span className="font-mono text-[var(--text-primary)]">style.css</span>{" "}
        and{" "}
        <span className="font-mono text-[var(--text-primary)]">script.js</span>{" "}
        to render a
        live website preview inside the IDE.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {["index.html", "style.css", "script.js"].map((chip) => (
          <span
            key={chip}
            className="border border-[var(--line)] bg-[var(--surface-chip)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)] scale-50"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function PreviewLaptopFrame({ srcDoc }: { srcDoc: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center">
      <div className="w-full rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="rounded-[14px] border border-black/40 bg-[#0a0a0a] p-2">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[10px] border border-black/50 bg-[var(--preview-frame)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-7 border-b border-black/10 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(235,239,244,0.94))]" />
            <div className="pointer-events-none absolute left-1/2 top-1.5 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-black/35" />
            <iframe
              title="iTECify live preview"
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              className="h-full w-full bg-[var(--preview-frame)] pt-7"
            />
          </div>
        </div>
      </div>

      <div className="relative h-3 w-[88%] rounded-b-[18px] bg-[linear-gradient(180deg,#9ca3af,#6b7280)] shadow-[0_14px_34px_rgba(0,0,0,0.35)]" />
      <div className="h-2 w-[28%] rounded-b-full bg-[linear-gradient(180deg,#d1d5db,#9ca3af)]" />
    </div>
  );
}

export function IdePreviewPanel({
  activeFile,
  workspace,
  connectionLabel,
  participantCount,
  snapshotCount,
  terminalEntryCount,
  isRunningCode,
}: IdePreviewPanelProps) {
  const fileCount = getWorkspaceFiles(workspace).length;
  const folderCount = workspace.nodes.filter((node) => node.kind === "folder").length;
  const previewDocument = buildWorkspacePreviewDocument(workspace);
  const previewFiles = getPreviewFiles(workspace);
  const activeFileLabel = activeFile?.name ?? "No file selected";

  if (!activeFile) {
    return (
      <section className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)] p-3">
        <div className="border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel-soft)] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Preview Waiting For Files
          </p>
          <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">
            Upload a project ZIP or create files in this session before the live
            preview can target HTML content.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)] p-3">
      <div className="mb-3 border-b border-[var(--line)] pb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--text-primary)]">
            Live Preview
          </h2>
          <span className="border border-cyan-400/14 bg-cyan-400/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-300">
            iframe srcDoc
          </span>
        </div>
        <p className="mt-2 max-w-sm text-[12px] leading-5 text-[var(--text-muted)]">
          The preview is rebuilt from workspace HTML, CSS, and JavaScript files
          as the room edits them.
        </p>
      </div>

      {previewDocument ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-rows-[minmax(280px,1.2fr)_auto]">
          <div className="min-h-0 overflow-hidden border border-[var(--line)] bg-[var(--editor-inline)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--editor-tab-bg)] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                {previewFiles.htmlFile?.name ?? "Preview"}
              </span>
            </div>
            <PreviewLaptopFrame srcDoc={previewDocument} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Active File", activeFileLabel],
              ["Connection", connectionLabel],
              ["Files", `${fileCount}`],
              ["Folders", `${folderCount}`],
              ["Collaborators", `${participantCount}`],
              ["Snapshots", `${snapshotCount}`],
              ["Terminal", `${terminalEntryCount} entries`],
              ["Execution", isRunningCode ? "Active run" : "Idle"],
              [
                "Preview HTML",
                previewFiles.htmlFile?.path ?? "Missing",
              ],
              [
                "Preview CSS",
                previewFiles.cssFile?.path ?? "Optional",
              ],
              [
                "Preview JS",
                previewFiles.jsFile?.path ?? "Optional",
              ],
              [
                "Runtime",
                `${getWorkspaceLanguageLabel(activeFile.language)} · ${getRuntimeLabel(
                  activeFile.executionRuntime,
                )}`,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-3"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {label}
                </p>
                <p className="mt-2 text-[13px] font-medium text-[var(--text-primary)]">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <EmptyPreviewState />

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Active File", activeFileLabel],
              ["Connection", connectionLabel],
              ["Files", `${fileCount}`],
              ["Folders", `${folderCount}`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-3"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {label}
                </p>
                <p className="mt-2 text-[13px] font-medium text-[var(--text-primary)]">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
