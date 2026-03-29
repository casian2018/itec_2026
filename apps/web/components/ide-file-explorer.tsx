"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  WorkspaceTemplateKind,
  WorkspaceFileLanguage,
  WorkspaceNode,
  WorkspaceState,
} from "@/lib/socket";
import { formatSessionCodeForDisplay } from "@/lib/session";
import { getFileIcon, isHiddenWorkspacePath } from "@/lib/workspace";

type IdeFileExplorerProps = {
  roomId: string;
  workspace: WorkspaceState;
  activeFileId: string;
  isImportingProject: boolean;
  isEmptyWorkspacePromptDismissed: boolean;
  importStatusMessage?: string | null;
  onSelect: (fileId: string) => void;
  onDismissEmptyWorkspacePrompt: () => void;
  onUploadProjectZip: () => void;
  onCreateFile: (parentId: string | null, name: string) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onRename: (nodeId: string, newName: string) => void;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onMove: (nodeId: string, targetParentId: string | null) => void;
  onFormatFile: (fileId: string) => void;
  onCreateTemplate: (template: WorkspaceTemplateKind) => void;
  showHiddenFiles: boolean;
  onToggleHiddenFiles: () => void;
  onCopyFileContent: (fileId: string) => void;
  onDownloadFile: (fileId: string) => void;
  onAiFileAction: (
    action:
      | "generate-readme"
      | "add-inline-docs"
      | "refactor-file"
      | "generate-tests",
    nodeId: string | null,
  ) => void;
};

type ExplorerRow = {
  id: string;
  kind: WorkspaceNode["kind"];
  name: string;
  path: string;
  depth: number;
  language?: string;
  parentId: string | null;
};

type InlineInputMode =
  | { type: "create-file"; parentId: string | null }
  | { type: "create-folder"; parentId: string | null }
  | { type: "rename"; nodeId: string; currentName: string }
  | null;

type ContextMenuState = {
  x: number;
  y: number;
  nodeId: string | null;
  kind: "folder" | "file" | "root";
};

type MoveDialogState = {
  nodeId: string;
};

type ContextMenuAction = {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function fileAccentClasses(language: string | undefined) {
  if (language === "javascript") {
    return "border-l-[var(--accent)] text-[var(--accent)]";
  }

  if (language === "typescript") {
    return "border-l-sky-400 text-sky-300";
  }

  if (language === "python") {
    return "border-l-amber-400 text-amber-300";
  }

  if (language === "c") {
    return "border-l-lime-400 text-lime-300";
  }

  if (language === "html") {
    return "border-l-rose-400 text-rose-300";
  }

  if (language === "css") {
    return "border-l-cyan-400 text-cyan-300";
  }

  if (language === "cpp") {
    return "border-l-violet-400 text-violet-300";
  }

  if (language === "markdown") {
    return "border-l-emerald-400 text-emerald-300";
  }

  if (language === "json") {
    return "border-l-sky-300 text-sky-200";
  }

  return "border-l-slate-500 text-slate-300";
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
        parentId: node.parentId,
      });

      if (node.kind === "folder") {
        visit(node.id, depth + 1);
      }
    }
  }

  visit(null, 0);

  return rows;
}

function fileExtension(name: string) {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(dotIndex + 1).toUpperCase() : "";
}

function supportsFormatting(language: string | undefined) {
  return Boolean(
    language &&
      [
        "javascript",
        "typescript",
        "html",
        "css",
        "markdown",
        "json",
      ].includes(language),
  );
}

function isFolderDescendant(
  workspace: WorkspaceState,
  nodeId: string,
  candidateParentId: string | null,
) {
  if (!candidateParentId) {
    return false;
  }

  if (candidateParentId === nodeId) {
    return true;
  }

  let currentParentId: string | null = candidateParentId;

  while (currentParentId) {
    if (currentParentId === nodeId) {
      return true;
    }

    const currentNode = workspace.nodes.find((node) => node.id === currentParentId);
    currentParentId = currentNode?.parentId ?? null;
  }

  return false;
}

function InlineInput({
  defaultValue,
  placeholder,
  onSubmit,
  onCancel,
}: {
  defaultValue: string;
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.focus();

    const dotIndex = defaultValue.lastIndexOf(".");

    if (dotIndex > 0) {
      input.setSelectionRange(0, dotIndex);
    } else {
      input.select();
    }
  }, [defaultValue]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit(inputRef.current?.value.trim() ?? "");
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  function handleBlur() {
    onSubmit(inputRef.current?.value.trim() ?? "");
  }

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={defaultValue}
      placeholder={placeholder}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="w-full border border-[var(--accent)] bg-[var(--editor-tab-hover-bg)] px-2 py-1 font-mono text-[12px] text-[var(--text-primary)] outline-none"
    />
  );
}

function ContextMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[196px] overflow-hidden border border-[var(--line)] bg-[var(--bg-panel)] py-1 shadow-[0_18px_36px_rgba(0,0,0,0.42)]"
      style={{ left: x, top: y }}
    >
      {actions.map((action, index) => (
        <button
          key={`${action.label}-${index}`}
          type="button"
          disabled={action.disabled}
          onClick={() => {
            action.onClick();
            onClose();
          }}
          className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12px] transition ${
            action.danger
              ? "text-rose-300 hover:bg-rose-400/10"
              : "text-[var(--text-primary)] hover:bg-[var(--editor-tab-hover-bg)]"
          } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
        >
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}

function MoveDialog({
  workspace,
  nodeId,
  onCancel,
  onConfirm,
}: {
  workspace: WorkspaceState;
  nodeId: string;
  onCancel: () => void;
  onConfirm: (targetParentId: string | null) => void;
}) {
  const node = workspace.nodes.find((entry) => entry.id === nodeId) ?? null;
  const [targetParentId, setTargetParentId] = useState<string>(
    node?.parentId ?? "__ROOT__",
  );

  const availableTargets = useMemo(() => {
    return workspace.nodes
      .filter((entry) => entry.kind === "folder")
      .filter((entry) => !isFolderDescendant(workspace, nodeId, entry.id))
      .sort((left, right) => left.path.localeCompare(right.path));
  }, [nodeId, workspace]);

  if (!node) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-sm border border-[var(--line)] bg-[var(--bg-panel)] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.42)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Move Node
        </p>
        <h3 className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
          Move {node.name}
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          Choose a destination folder. Invalid moves like moving a folder into itself
          or a descendant are blocked.
        </p>

        <label className="mt-4 block">
          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Destination
          </span>
          <select
            value={targetParentId}
            onChange={(event) => setTargetParentId(event.target.value)}
            className="mt-2 h-10 w-full border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 text-sm text-[var(--text-primary)] outline-none"
          >
            <option value="__ROOT__">Workspace Root</option>
            {availableTargets.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.path}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 text-xs text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm(targetParentId === "__ROOT__" ? null : targetParentId)
            }
            className="h-8 border border-[var(--accent-line)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-contrast)] transition hover:brightness-110"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

export function IdeFileExplorer({
  roomId,
  workspace,
  activeFileId,
  isImportingProject,
  isEmptyWorkspacePromptDismissed,
  importStatusMessage,
  onSelect,
  onDismissEmptyWorkspacePrompt,
  onUploadProjectZip,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onDuplicate,
  onMove,
  onFormatFile,
  onCreateTemplate,
  showHiddenFiles,
  onToggleHiddenFiles,
  onCopyFileContent,
  onDownloadFile,
  onAiFileAction,
}: IdeFileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [inlineInput, setInlineInput] = useState<InlineInputMode>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [moveDialog, setMoveDialog] = useState<MoveDialogState | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(workspace.nodes.filter((node) => node.kind === "folder").map((node) => node.id)),
  );

  const rows = useMemo(() => buildExplorerRows(workspace), [workspace]);

  useEffect(() => {
    const nodeIds = new Set(workspace.nodes.map((node) => node.id));
    const folderIds = new Set(
      workspace.nodes
        .filter((node) => node.kind === "folder")
        .map((node) => node.id),
    );

    const frameId = window.requestAnimationFrame(() => {
      setExpandedFolders((currentFolders) => {
        const nextFolders = new Set<string>();

        for (const folderId of currentFolders) {
          if (folderIds.has(folderId)) {
            nextFolders.add(folderId);
          }
        }

        return nextFolders;
      });
      setSelectedNodeId((currentNodeId) =>
        currentNodeId && nodeIds.has(currentNodeId) ? currentNodeId : null,
      );
      setContextMenu((currentMenu) => {
        if (!currentMenu) {
          return null;
        }

        if (!currentMenu.nodeId) {
          return currentMenu;
        }

        return nodeIds.has(currentMenu.nodeId) ? currentMenu : null;
      });
      setInlineInput((currentInlineInput) => {
        if (!currentInlineInput) {
          return null;
        }

        if (currentInlineInput.type === "rename") {
          return nodeIds.has(currentInlineInput.nodeId)
            ? currentInlineInput
            : null;
        }

        if (currentInlineInput.parentId === null) {
          return currentInlineInput;
        }

        return folderIds.has(currentInlineInput.parentId)
          ? currentInlineInput
          : null;
      });
      setMoveDialog((currentMoveDialog) =>
        currentMoveDialog && nodeIds.has(currentMoveDialog.nodeId)
          ? currentMoveDialog
          : null,
      );
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [workspace]);

  const visibleRows = rows.filter((row) => {
    if (!showHiddenFiles && isHiddenWorkspacePath(row.path)) {
      return false;
    }

    let currentParentId = row.parentId;

    while (currentParentId) {
      if (!expandedFolders.has(currentParentId)) {
        return false;
      }

      const parentNode = workspace.nodes.find((node) => node.id === currentParentId);
      currentParentId = parentNode?.parentId ?? null;
    }

    return true;
  });

  const effectiveSelectedNodeId =
    (selectedNodeId &&
      workspace.nodes.some((node) => node.id === selectedNodeId) &&
      selectedNodeId) ||
    activeFileId ||
    null;
  const selectedNode = effectiveSelectedNodeId
    ? workspace.nodes.find((node) => node.id === effectiveSelectedNodeId) ?? null
    : null;
  const contextNode = contextMenu?.nodeId
    ? workspace.nodes.find((node) => node.id === contextMenu.nodeId) ?? null
    : null;

  const handleContextMenu = useCallback(
    (
      event: React.MouseEvent,
      nodeId: string | null,
      kind: "folder" | "file" | "root",
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedNodeId(nodeId);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId,
        kind,
      });
    },
    [],
  );

  const handleToggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((previous) => {
      const next = new Set(previous);

      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }

      return next;
    });
  }, []);

  const handleInlineSubmit = useCallback(
    (value: string) => {
      if (!inlineInput || !value) {
        setInlineInput(null);
        return;
      }

      if (inlineInput.type === "create-file") {
        const parentId = inlineInput.parentId;

        if (parentId) {
          setExpandedFolders((previous) => {
            const next = new Set(previous);
            next.add(parentId);
            return next;
          });
        }

        onCreateFile(parentId, value);
      } else if (inlineInput.type === "create-folder") {
        const parentId = inlineInput.parentId;

        if (parentId) {
          setExpandedFolders((previous) => {
            const next = new Set(previous);
            next.add(parentId);
            return next;
          });
        }

        onCreateFolder(parentId, value);
      } else if (inlineInput.type === "rename" && value !== inlineInput.currentName) {
        onRename(inlineInput.nodeId, value);
      }

      setInlineInput(null);
    },
    [inlineInput, onCreateFile, onCreateFolder, onRename],
  );

  const handleCopyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      return;
    }
  }, []);

  const contextActions: ContextMenuAction[] = useMemo(() => {
    if (!contextMenu) {
      return [];
    }

    const node = contextNode;
    const isFile = node?.kind === "file";
    const isFolder = node?.kind === "folder";
    const createParentId = isFolder ? node.id : node?.parentId ?? null;

    const actions: ContextMenuAction[] = [];

    if (contextMenu.kind === "root" || node) {
      actions.push({
        label: "New File",
        onClick: () =>
          setInlineInput({
            type: "create-file",
            parentId: createParentId,
          }),
      });
      actions.push({
        label: "New Folder",
        onClick: () =>
          setInlineInput({
            type: "create-folder",
            parentId: createParentId,
          }),
      });
      actions.push({
        label: "Python Starter",
        onClick: () => onCreateTemplate("python-starter"),
      });
      actions.push({
        label: "C++ Starter",
        onClick: () => onCreateTemplate("cpp-starter"),
      });
      actions.push({
        label: "HTML/CSS Starter",
        onClick: () => onCreateTemplate("html-css-starter"),
      });

      if (contextMenu.kind === "root" && !node) {
        actions.push({
          label: "Generate README Documentation",
          onClick: () => onAiFileAction("generate-readme", null),
        });
      }
    }

    if (node) {
      actions.push({
        label: "Rename",
        onClick: () =>
          setInlineInput({
            type: "rename",
            nodeId: node.id,
            currentName: node.name,
          }),
      });

      actions.push({
        label: isFolder ? "Duplicate Folder" : "Duplicate File",
        onClick: () => onDuplicate(node.id),
      });

      actions.push({
        label: "Move",
        onClick: () => setMoveDialog({ nodeId: node.id }),
      });

      actions.push({
        label: "Copy Path",
        onClick: () => void handleCopyPath(node.path),
      });

      if (isFile) {
        actions.push({
          label: "Copy File Content",
          onClick: () => onCopyFileContent(node.id),
        });
        actions.push({
          label: "Download File",
          onClick: () => onDownloadFile(node.id),
        });
        actions.push({
          label: "Generate README Documentation",
          onClick: () => onAiFileAction("generate-readme", node.id),
        });
        actions.push({
          label: "Add Inline Documentation",
          onClick: () => onAiFileAction("add-inline-docs", node.id),
        });
        actions.push({
          label: "Refactor This File",
          onClick: () => onAiFileAction("refactor-file", node.id),
        });
        actions.push({
          label: "Generate Unit Tests",
          onClick: () => onAiFileAction("generate-tests", node.id),
        });
        actions.push({
          label: "Format File",
          disabled: !supportsFormatting(node.language),
          onClick: () => onFormatFile(node.id),
        });
      } else {
        actions.push({
          label: "Generate README Documentation",
          onClick: () => onAiFileAction("generate-readme", node.id),
        });
      }

      actions.push({
        label: "Delete",
        danger: true,
        onClick: () => onDelete(node.id),
      });
    }

    return actions;
  }, [
    contextMenu,
    contextNode,
    handleCopyPath,
    onCopyFileContent,
    onCreateTemplate,
    onAiFileAction,
    onDelete,
    onDownloadFile,
    onDuplicate,
    onFormatFile,
  ]);

  return (
    <aside className="relative flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Explorer
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
            Session {formatSessionCodeForDisplay(roomId)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
            onClick={onToggleHiddenFiles}
            className="inline-flex h-6 items-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
          >
            {showHiddenFiles ? "DOT ON" : "DOT OFF"}
          </button>
          <button
            type="button"
            title="Upload Project ZIP"
            disabled={isImportingProject}
            onClick={onUploadProjectZip}
            className="inline-flex h-6 items-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImportingProject ? "Uploading..." : "ZIP"}
          </button>
          <button
            type="button"
            title="New File"
            onClick={() => setInlineInput({ type: "create-file", parentId: null })}
            className="flex h-6 w-6 items-center justify-center text-[11px] text-[var(--text-muted)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M4.5 1.5H10l4 4v8.5a1 1 0 01-1 1h-9a1 1 0 01-1-1v-11a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M9 1.5v4h4" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 8.5h4M8 6.5v4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            type="button"
            title="New Folder"
            onClick={() =>
              setInlineInput({ type: "create-folder", parentId: null })
            }
            className="flex h-6 w-6 items-center justify-center text-[11px] text-[var(--text-muted)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M1.5 3.5h4l2 2h7a1 1 0 011 1v7.5a1 1 0 01-1 1h-12a1 1 0 01-1-1v-10a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M6 8.5h4M8 6.5v4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1 py-2"
        onContextMenu={(event) => handleContextMenu(event, null, "root")}
      >
        {inlineInput?.type === "create-file" && inlineInput.parentId === null ? (
          <div className="px-2 py-1">
            <InlineInput
              defaultValue="untitled.js"
              placeholder="filename.js"
              onSubmit={handleInlineSubmit}
              onCancel={() => setInlineInput(null)}
            />
          </div>
        ) : null}

        {inlineInput?.type === "create-folder" &&
        inlineInput.parentId === null ? (
          <div className="px-2 py-1">
            <InlineInput
              defaultValue="new-folder"
              placeholder="folder name"
              onSubmit={handleInlineSubmit}
              onCancel={() => setInlineInput(null)}
            />
          </div>
        ) : null}

        {visibleRows.map((row) => {
          const node = workspace.nodes.find((entry) => entry.id === row.id) ?? null;
          const isRenaming =
            inlineInput?.type === "rename" && inlineInput.nodeId === row.id;
          const isSelected = effectiveSelectedNodeId === row.id;
          const isActiveFile = row.id === activeFileId;
          const extensionLabel = row.kind === "file" ? fileExtension(row.name) : "";

          return (
            <div key={row.id}>
              {row.kind === "folder" ? (
                <div
                  className={`group flex items-center gap-1 border-l-2 px-2 py-1 text-left transition ${
                    isSelected
                      ? "border-l-[var(--accent)] bg-[var(--editor-tab-hover-bg)]"
                      : "border-l-transparent hover:bg-[var(--editor-tab-hover-bg)]"
                  }`}
                  style={{ paddingLeft: `${10 + row.depth * 14}px` }}
                  onClick={() => {
                    setSelectedNodeId(row.id);
                    handleToggleFolder(row.id);
                  }}
                  onContextMenu={(event) => handleContextMenu(event, row.id, "folder")}
                >
                  {isRenaming && node ? (
                    <div className="flex-1 py-0.5 pr-2">
                      <InlineInput
                        defaultValue={node.name}
                        placeholder="folder name"
                        onSubmit={handleInlineSubmit}
                        onCancel={() => setInlineInput(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <span className="flex h-4 w-4 items-center justify-center text-[10px] text-[var(--text-muted)]">
                        {expandedFolders.has(row.id) ? "▾" : "▸"}
                      </span>
                      <span className="font-mono text-[11px] text-amber-300">DIR</span>
                      <p className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                        {row.name}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div
                  className={`group flex items-center gap-2 border-l-2 transition ${
                    isActiveFile
                      ? "border-l-[var(--accent)] bg-[var(--editor-tab-hover-bg)]"
                      : isSelected
                        ? "border-l-[var(--line-strong)] bg-[var(--bg-panel-soft)]"
                        : "border-l-transparent hover:bg-[var(--editor-tab-hover-bg)]"
                  }`}
                  style={{ paddingLeft: `${10 + row.depth * 14}px` }}
                  onContextMenu={(event) => handleContextMenu(event, row.id, "file")}
                >
                  {isRenaming && node ? (
                    <div className="flex-1 py-1 pr-2">
                      <InlineInput
                        defaultValue={node.name}
                        placeholder="filename"
                        onSubmit={handleInlineSubmit}
                        onCancel={() => setInlineInput(null)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNodeId(row.id);
                        onSelect(row.id);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left"
                    >
                      <span
                        className={`inline-flex min-w-[34px] items-center justify-center border-l-2 px-1.5 py-0.5 font-mono text-[10px] ${fileAccentClasses(
                          row.language,
                        )}`}
                      >
                        {getFileIcon(
                          {
                            name: row.name,
                            path: row.path,
                            language:
                              (row.language as WorkspaceFileLanguage | undefined) ??
                              "plaintext",
                          },
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {row.name}
                        </p>
                        <p className="truncate text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                          {extensionLabel || "FILE"} · {row.path}
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {inlineInput?.type === "create-file" &&
              inlineInput.parentId === row.id ? (
                <div
                  className="px-2 py-1"
                  style={{ paddingLeft: `${10 + (row.depth + 1) * 14}px` }}
                >
                  <InlineInput
                    defaultValue="untitled.js"
                    placeholder="filename.js"
                    onSubmit={handleInlineSubmit}
                    onCancel={() => setInlineInput(null)}
                  />
                </div>
              ) : null}

              {inlineInput?.type === "create-folder" &&
              inlineInput.parentId === row.id ? (
                <div
                  className="px-2 py-1"
                  style={{ paddingLeft: `${10 + (row.depth + 1) * 14}px` }}
                >
                  <InlineInput
                    defaultValue="new-folder"
                    placeholder="folder name"
                    onSubmit={handleInlineSubmit}
                    onCancel={() => setInlineInput(null)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}

        {visibleRows.length === 0 ? (
          !isEmptyWorkspacePromptDismissed ? (
            <div className="mx-2 border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel-soft)] px-4 py-5 text-left">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Empty Session Workspace
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                    This room starts with no files. Import a project ZIP, create a new
                    file, or create a folder to begin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDismissEmptyWorkspacePrompt}
                  className="inline-flex h-7 w-7 items-center justify-center border border-[var(--line)] bg-[var(--bg-panel)] text-sm text-[var(--text-muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
                  title="Close empty workspace prompt"
                >
                  ×
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isImportingProject}
                  onClick={onUploadProjectZip}
                  className="border border-[var(--accent-line)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isImportingProject ? "Uploading ZIP..." : "Upload Project ZIP"}
                </button>
                <button
                  type="button"
                  onClick={() => onCreateTemplate("python-starter")}
                  className="border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
                >
                  Python Starter
                </button>
                <button
                  type="button"
                  onClick={() => onCreateTemplate("html-css-starter")}
                  className="border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
                >
                  HTML/CSS Starter
                </button>
                <button
                  type="button"
                  onClick={() => setInlineInput({ type: "create-file", parentId: null })}
                  className="border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
                >
                  New File
                </button>
                <button
                  type="button"
                  onClick={() => setInlineInput({ type: "create-folder", parentId: null })}
                  className="border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
                >
                  New Folder
                </button>
              </div>
              {importStatusMessage ? (
                <p className="mt-3 text-[11px] leading-5 text-[var(--text-muted)]">
                  {importStatusMessage}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] text-[var(--text-muted)]">
                Workspace empty. Use the header controls to upload or create files.
              </p>
            </div>
          )
        ) : null}
      </div>
        

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextActions}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      {moveDialog ? (
        <MoveDialog
          workspace={workspace}
          nodeId={moveDialog.nodeId}
          onCancel={() => setMoveDialog(null)}
          onConfirm={(targetParentId) => {
            onMove(moveDialog.nodeId, targetParentId);
            setMoveDialog(null);
          }}
        />
      ) : null}
    </aside>
  );
}
