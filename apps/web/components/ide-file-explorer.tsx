"use client";

import type { WorkspaceNode, WorkspaceState } from "@/lib/socket";

type IdeFileExplorerProps = {
  roomId: string;
  workspace: WorkspaceState;
  activeFileId: string;
  onSelect: (fileId: string) => void;
};

type ExplorerRow = {
  id: string;
  kind: WorkspaceNode["kind"];
  name: string;
  path: string;
  depth: number;
  language?: string;
};

function fileDotClasses(language: string | undefined) {
  if (language === "javascript") {
    return "bg-[var(--accent)]";
  }

  if (language === "python") {
    return "bg-amber-300";
  }

  if (language === "html") {
    return "bg-rose-300";
  }

  if (language === "css") {
    return "bg-cyan-300";
  }

  if (language === "cpp") {
    return "bg-violet-300";
  }

  if (language === "markdown") {
    return "bg-emerald-300";
  }

  if (language === "json") {
    return "bg-sky-300";
  }

  return "bg-slate-500";
}

function buildExplorerRows(workspace: WorkspaceState) {
  const childrenByParent = new Map<string | null, WorkspaceNode[]>();

  for (const node of workspace.nodes) {
    const currentChildren = childrenByParent.get(node.parentId) ?? [];
    currentChildren.push(node);
    childrenByParent.set(node.parentId, currentChildren);
  }

  for (const entries of childrenByParent.values()) {
    entries.sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "folder" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  const rows: ExplorerRow[] = [];

  function visit(parentId: string | null, depth: number) {
    const nodes = childrenByParent.get(parentId) ?? [];

    for (const node of nodes) {
      rows.push({
        id: node.id,
        kind: node.kind,
        name: node.name,
        path: node.path,
        depth,
        language: node.kind === "file" ? node.language : undefined,
      });

      if (node.kind === "folder") {
        visit(node.id, depth + 1);
      }
    }
  }

  visit(null, 0);

  return rows;
}

export function IdeFileExplorer({
  roomId,
  workspace,
  activeFileId,
  onSelect,
}: IdeFileExplorerProps) {
  const rows = buildExplorerRows(workspace);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
      <div className="border-b border-[var(--line)] px-3 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Explorer
        </p>
        <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
          {roomId}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1 py-2">
        {rows.map((row) =>
          row.kind === "folder" ? (
            <div
              key={row.id}
              className="px-2 py-1 text-left"
              style={{ paddingLeft: `${10 + row.depth * 14}px` }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {row.name}
              </p>
            </div>
          ) : (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row.id)}
              className={`flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left transition ${
                row.id === activeFileId
                  ? "border-l-[var(--accent)] bg-[var(--editor-tab-hover-bg)]"
                  : "border-l-transparent bg-transparent hover:bg-[var(--editor-tab-hover-bg)]"
              }`}
              style={{ paddingLeft: `${10 + row.depth * 14}px` }}
            >
              <span
                className={`h-2 w-2 rounded-full ${fileDotClasses(
                  row.language,
                )}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                  {row.name}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-muted)]">
                  {row.path}
                </p>
              </div>
            </button>
          ),
        )}
      </div>
    </aside>
  );
}
