import prettier from "prettier";
import type {
  AiEditLineChange,
  ExecutionRuntime,
  WorkspaceFileLanguage,
  WorkspaceFileNode,
  WorkspaceNode,
  WorkspaceState,
} from "./types.js";

const DEFAULT_JAVASCRIPT = `export function createWorkspaceSummary() {
  const metrics = [3, 5, 8];
  const total = metrics.reduce((sum, value) => sum + value, 0);

  console.log("iTECify JavaScript workspace booted.");
  console.log("Shared metric total:", total);
}

createWorkspaceSummary();
`;

const DEFAULT_PYTHON = `def create_workspace_summary():
    metrics = [3, 5, 8]
    total = sum(metrics)

    print("iTECify Python workspace booted.")
    print("Shared metric total:", total)


create_workspace_summary()
`;

const DEFAULT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>iTECify Preview</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="shell">
      <h1>iTECify Live Preview</h1>
      <p>Edit HTML, CSS, or JS files to update this browser preview.</p>
      <button id="preview-button" type="button">Click me</button>
      <p id="preview-output">Preview ready.</p>
    </main>
    <script src="./script.js"></script>
  </body>
</html>
`;

const DEFAULT_CSS = `:root {
  color-scheme: dark;
  font-family: "IBM Plex Mono", monospace;
  background: #07101c;
  color: #e8f0fb;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at top left, rgba(82, 199, 184, 0.12), transparent 28%),
    linear-gradient(180deg, #0a1322 0%, #07101c 100%);
}

.shell {
  width: min(560px, calc(100vw - 48px));
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 24px;
  padding: 32px;
  background: rgba(12, 20, 34, 0.9);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
}

#preview-button {
  margin-top: 16px;
  border: 0;
  border-radius: 999px;
  padding: 10px 16px;
  background: #52c7b8;
  color: #07101c;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

#preview-output {
  margin-top: 16px;
  color: #c9d6ea;
}
`;

const DEFAULT_PREVIEW_SCRIPT = `const button = document.querySelector("#preview-button");
const output = document.querySelector("#preview-output");

if (button && output) {
  button.addEventListener("click", () => {
    output.textContent = "Live preview JavaScript executed successfully.";
  });
}
`;

const DEFAULT_CPP = `#include <iostream>

int main() {
  std::cout << "iTECify C++ workspace ready for a future executor." << std::endl;
  return 0;
}
`;

const DEFAULT_C = `#include <stdio.h>

int main(void) {
  printf("iTECify C workspace ready.\\n");
  return 0;
}
`;

const DEFAULT_README = `# iTECify Workspace

This room now behaves like an in-memory IDE workspace.

- folders and files are shared
- the active file is synchronized
- open tabs are synchronized
- execution routes through the active file runtime
`;

function createFolder(
  id: string,
  name: string,
  parentId: string | null,
  path: string,
): WorkspaceNode {
  return {
    id,
    kind: "folder",
    name,
    parentId,
    path,
  };
}

function createFile(
  id: string,
  name: string,
  parentId: string | null,
  path: string,
  language: WorkspaceFileLanguage,
  content: string,
  executionRuntime?: ExecutionRuntime,
): WorkspaceFileNode {
  return {
    id,
    kind: "file",
    name,
    parentId,
    path,
    language,
    content,
    executionRuntime,
  };
}

export function executionRuntimeForLanguage(
  language: WorkspaceFileLanguage,
): ExecutionRuntime | undefined {
  if (language === "javascript") {
    return "javascript";
  }

  if (language === "python") {
    return "python";
  }

  if (language === "c") {
    return "c";
  }

  if (language === "cpp") {
    return "cpp";
  }

  return undefined;
}

function getNode(workspace: WorkspaceState, nodeId: string) {
  return workspace.nodes.find((node) => node.id === nodeId) ?? null;
}

function getFolderPath(workspace: WorkspaceState, folderId: string | null) {
  if (!folderId) {
    return "";
  }

  const folder = workspace.nodes.find(
    (node) => node.id === folderId && node.kind === "folder",
  );

  return folder?.path ?? null;
}

function splitFileName(name: string) {
  const dotIndex = name.lastIndexOf(".");

  if (dotIndex <= 0) {
    return {
      baseName: name,
      extension: "",
    };
  }

  return {
    baseName: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  };
}

function siblingPath(parentPath: string, name: string) {
  return parentPath ? `${parentPath}/${name}` : name;
}

function getUniqueName(
  workspace: WorkspaceState,
  parentId: string | null,
  requestedName: string,
) {
  const parentPath = getFolderPath(workspace, parentId);

  if (parentPath === null) {
    return null;
  }

  const { baseName, extension } = splitFileName(requestedName);
  let candidate = requestedName;
  let counter = 1;

  while (
    workspace.nodes.some(
      (node) => node.path === siblingPath(parentPath, candidate),
    )
  ) {
    candidate =
      extension.length > 0
        ? `${baseName}-copy${counter > 1 ? `-${counter}` : ""}${extension}`
        : `${baseName}-copy${counter > 1 ? `-${counter}` : ""}`;
    counter += 1;
  }

  return candidate;
}

function sortNodes(nodes: WorkspaceNode[]) {
  return [...nodes].sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeTextContent(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trimEnd();
}

function prettierParserForLanguage(language: WorkspaceFileLanguage) {
  if (language === "javascript") {
    return "babel";
  }

  if (language === "typescript") {
    return "typescript";
  }

  if (language === "html") {
    return "html";
  }

  if (language === "css") {
    return "css";
  }

  if (language === "json") {
    return "json";
  }

  if (language === "markdown") {
    return "markdown";
  }

  return null;
}

async function formatWorkspaceFileContent(
  language: WorkspaceFileLanguage,
  content: string,
) {
  const normalized = normalizeTextContent(content);
  const parser = prettierParserForLanguage(language);

  if (!parser) {
    throw new Error(
      `Formatting is not supported yet for ${language} files in this MVP.`,
    );
  }

  if (!normalized) {
    return "";
  }

  return prettier.format(normalized, {
    parser,
    printWidth: 80,
    tabWidth: 2,
    singleQuote: false,
    trailingComma: "all",
    semi: true,
  });
}

function isDescendantPath(path: string, candidateParentPath: string) {
  return candidateParentPath === path || candidateParentPath.startsWith(`${path}/`);
}

export function createEmptyWorkspace(): WorkspaceState {
  return {
    nodes: [],
    activeFileId: "",
    openFileIds: [],
  };
}

export function createDefaultWorkspace(): WorkspaceState {
  return createEmptyWorkspace();
}

export function createLegacyDemoWorkspace(): WorkspaceState {
  const nodes: WorkspaceNode[] = [
    createFolder("folder-src", "src", null, "src"),
    createFolder("folder-public", "public", null, "public"),
    createFile(
      "file-js-entry",
      "index.js",
      "folder-src",
      "src/index.js",
      "javascript",
      DEFAULT_JAVASCRIPT,
      "javascript",
    ),
    createFile(
      "file-py-entry",
      "main.py",
      "folder-src",
      "src/main.py",
      "python",
      DEFAULT_PYTHON,
      "python",
    ),
    createFile(
      "file-c-entry",
      "main.c",
      "folder-src",
      "src/main.c",
      "c",
      DEFAULT_C,
      "c",
    ),
    createFile(
      "file-cpp-entry",
      "main.cpp",
      "folder-src",
      "src/main.cpp",
      "cpp",
      DEFAULT_CPP,
      "cpp",
    ),
    createFile(
      "file-html-entry",
      "index.html",
      "folder-public",
      "public/index.html",
      "html",
      DEFAULT_HTML,
    ),
    createFile(
      "file-css-entry",
      "style.css",
      "folder-public",
      "public/style.css",
      "css",
      DEFAULT_CSS,
    ),
    createFile(
      "file-preview-script",
      "script.js",
      "folder-public",
      "public/script.js",
      "javascript",
      DEFAULT_PREVIEW_SCRIPT,
    ),
    createFile(
      "file-readme",
      "README.md",
      null,
      "README.md",
      "markdown",
      DEFAULT_README,
    ),
  ];

  return {
    nodes,
    activeFileId: "file-js-entry",
    openFileIds: ["file-js-entry", "file-html-entry", "file-css-entry"],
  };
}

export function cloneWorkspaceState(workspace: WorkspaceState): WorkspaceState {
  return {
    activeFileId: workspace.activeFileId,
    openFileIds: [...workspace.openFileIds],
    nodes: workspace.nodes.map((node) => ({ ...node })),
  };
}

export function serializeWorkspace(workspace: WorkspaceState) {
  return JSON.stringify(workspace);
}

export function getWorkspaceFile(
  workspace: WorkspaceState,
  fileId: string,
): WorkspaceFileNode | null {
  const node = workspace.nodes.find((currentNode) => currentNode.id === fileId);

  if (!node || node.kind !== "file") {
    return null;
  }

  return node;
}

export function listWorkspaceFiles(workspace: WorkspaceState) {
  return workspace.nodes.filter(
    (node): node is WorkspaceFileNode => node.kind === "file",
  );
}

function getWorkspaceFileByPath(
  workspace: WorkspaceState,
  path: string,
): WorkspaceFileNode | null {
  const normalizedPath = path.trim().toLowerCase();

  return (
    listWorkspaceFiles(workspace).find(
      (file) => file.path.toLowerCase() === normalizedPath,
    ) ?? null
  );
}

function preferredPreviewFile(
  workspace: WorkspaceState,
  candidates: string[],
): WorkspaceFileNode | null {
  for (const candidate of candidates) {
    const file = getWorkspaceFileByPath(workspace, candidate);

    if (file) {
      return file;
    }
  }

  return null;
}

export function getPreviewFiles(workspace: WorkspaceState) {
  const htmlFile =
    preferredPreviewFile(workspace, ["public/index.html", "index.html"]) ??
    listWorkspaceFiles(workspace).find((file) => file.language === "html") ??
    null;
  const cssFile =
    preferredPreviewFile(workspace, [
      "public/style.css",
      "public/styles.css",
      "style.css",
      "styles.css",
    ]) ??
    listWorkspaceFiles(workspace).find((file) => file.language === "css") ??
    null;
  const jsFile =
    preferredPreviewFile(workspace, [
      "public/script.js",
      "public/index.js",
      "script.js",
      "index.js",
    ]) ??
    null;

  return {
    htmlFile,
    cssFile,
    jsFile,
  };
}

export function isPreviewWorkspaceFile(
  workspace: WorkspaceState,
  fileId: string,
) {
  const { htmlFile, cssFile, jsFile } = getPreviewFiles(workspace);

  return [htmlFile, cssFile, jsFile].some((file) => file?.id === fileId);
}

function normalizeOpenFileIds(workspace: WorkspaceState, openFileIds: string[]) {
  const validFileIds = new Set(listWorkspaceFiles(workspace).map((file) => file.id));
  const uniqueOpenFileIds: string[] = [];

  for (const openFileId of openFileIds) {
    if (!validFileIds.has(openFileId) || uniqueOpenFileIds.includes(openFileId)) {
      continue;
    }

    uniqueOpenFileIds.push(openFileId);
  }

  return uniqueOpenFileIds;
}

export function updateWorkspaceFileContent(
  workspace: WorkspaceState,
  fileId: string,
  content: string,
) {
  let changed = false;
  let nextFile: WorkspaceFileNode | null = null;

  const nextNodes = workspace.nodes.map((node) => {
    if (node.kind !== "file" || node.id !== fileId) {
      return node;
    }

    if (node.content === content) {
      nextFile = node;
      return node;
    }

    changed = true;
    nextFile = {
      ...node,
      content,
    };

    return nextFile;
  });

  return {
    workspace: changed ? { ...workspace, nodes: nextNodes } : workspace,
    changed,
    file: nextFile,
  };
}

export function applyApprovedLineChangesToWorkspaceFile(
  workspace: WorkspaceState,
  fileId: string,
  baseContent: string,
  changes: AiEditLineChange[],
) {
  const currentFile = getWorkspaceFile(workspace, fileId);

  if (!currentFile) {
    return {
      workspace,
      changed: false,
      file: null,
      error: "The target file no longer exists in this workspace.",
    };
  }

  const normalizedBaseContent = baseContent.replace(/\r\n/g, "\n");
  const normalizedCurrentContent = currentFile.content.replace(/\r\n/g, "\n");

  if (normalizedCurrentContent !== normalizedBaseContent) {
    return {
      workspace,
      changed: false,
      file: currentFile,
      error:
        "The file changed after the AI proposal was generated. Ask AI again on the latest file version.",
    };
  }

  const approvedChanges = changes.filter((change) => change.status === "approved");

  if (approvedChanges.length === 0) {
    return {
      workspace,
      changed: false,
      file: currentFile,
      error: "Approve at least one proposed line change before applying it.",
    };
  }

  const lines =
    normalizedBaseContent.length > 0 ? normalizedBaseContent.split("\n") : [];
  let lineOffset = 0;

  for (const change of approvedChanges) {
    if (change.type === "insert") {
      const insertionIndex = Math.max(
        0,
        Math.min(lines.length, change.lineNumber - 1 + lineOffset),
      );
      const insertedLines =
        change.newText.length > 0 ? change.newText.replace(/\r\n/g, "\n").split("\n") : [""];

      lines.splice(insertionIndex, 0, ...insertedLines);
      lineOffset += insertedLines.length;
      continue;
    }

    const targetIndex = change.lineNumber - 1 + lineOffset;

    if (targetIndex < 0 || targetIndex >= lines.length) {
      return {
        workspace,
        changed: false,
        file: currentFile,
        error: `AI change for line ${change.lineNumber} is no longer valid.`,
      };
    }

    if (change.type === "delete") {
      lines.splice(targetIndex, 1);
      lineOffset -= 1;
      continue;
    }

    const replacementLines =
      change.newText.length > 0 ? change.newText.replace(/\r\n/g, "\n").split("\n") : [""];

    lines.splice(targetIndex, 1, ...replacementLines);
    lineOffset += replacementLines.length - 1;
  }

  const nextContent = lines.join("\n");
  const updateResult = updateWorkspaceFileContent(workspace, fileId, nextContent);

  return {
    workspace: updateResult.workspace,
    changed: updateResult.changed,
    file: updateResult.file,
    error: null,
  };
}

export function updateWorkspaceView(
  workspace: WorkspaceState,
  activeFileId: string,
  openFileIds: string[],
) {
  const validFileIds = listWorkspaceFiles(workspace).map((file) => file.id);
  const normalizedOpenFileIds = normalizeOpenFileIds(workspace, openFileIds);
  const nextActiveFileId = validFileIds.includes(activeFileId)
    ? activeFileId
    : normalizedOpenFileIds[0] ?? "";

  if (
    nextActiveFileId &&
    !normalizedOpenFileIds.includes(nextActiveFileId)
  ) {
    normalizedOpenFileIds.unshift(nextActiveFileId);
  }

  const changed =
    workspace.activeFileId !== nextActiveFileId ||
    workspace.openFileIds.length !== normalizedOpenFileIds.length ||
    workspace.openFileIds.some(
      (openFileId, index) => openFileId !== normalizedOpenFileIds[index],
    );

  if (!changed) {
    return {
      workspace,
      changed: false,
    };
  }

  return {
    workspace: {
      ...workspace,
      activeFileId: nextActiveFileId,
      openFileIds: normalizedOpenFileIds,
    },
    changed: true,
  };
}

export function updateWorkspaceFileLanguage(
  workspace: WorkspaceState,
  fileId: string,
  language: WorkspaceFileLanguage,
) {
  let changed = false;
  let nextFile: WorkspaceFileNode | null = null;

  const nextNodes = workspace.nodes.map((node) => {
    if (node.kind !== "file" || node.id !== fileId) {
      return node;
    }

    const nextRuntime = executionRuntimeForLanguage(language);

    if (
      node.language === language &&
      node.executionRuntime === nextRuntime
    ) {
      nextFile = node;
      return node;
    }

    changed = true;
    nextFile = {
      ...node,
      language,
      executionRuntime: nextRuntime,
    };

    return nextFile;
  });

  return {
    workspace: changed ? { ...workspace, nodes: nextNodes } : workspace,
    changed,
    file: nextFile,
  };
}

export function insertCodeIntoWorkspaceFile(
  workspace: WorkspaceState,
  fileId: string,
  blockCode: string,
  insertAfterLine: number,
) {
  const currentFile = getWorkspaceFile(workspace, fileId);

  if (!currentFile) {
    return {
      workspace,
      changed: false,
      file: null,
    };
  }

  const normalizedDocument = currentFile.content.replace(/\r\n/g, "\n");
  const normalizedBlock = blockCode.replace(/\r\n/g, "\n").trimEnd();
  const documentLines =
    normalizedDocument.length > 0 ? normalizedDocument.split("\n") : [];
  const insertionIndex = Math.max(
    0,
    Math.min(insertAfterLine, documentLines.length),
  );
  const blockLines = normalizedBlock.split("\n");
  const nextContent = [
    ...documentLines.slice(0, insertionIndex),
    ...blockLines,
    ...documentLines.slice(insertionIndex),
  ].join("\n");

  return updateWorkspaceFileContent(workspace, fileId, nextContent);
}

export function inferLanguageFromExtension(
  filename: string,
): WorkspaceFileLanguage {
  const lower = filename.toLowerCase();

  if (
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs")
  ) {
    return "javascript";
  }

  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    return "typescript";
  }

  if (lower.endsWith(".py")) {
    return "python";
  }

  if (lower.endsWith(".c") || lower.endsWith(".h")) {
    return "c";
  }

  if (
    lower.endsWith(".html") ||
    lower.endsWith(".htm") ||
    lower.endsWith(".svg")
  ) {
    return "html";
  }

  if (lower.endsWith(".css") || lower.endsWith(".scss")) {
    return "css";
  }

  if (
    lower.endsWith(".cpp") ||
    lower.endsWith(".cc") ||
    lower.endsWith(".cxx") ||
    lower.endsWith(".hpp")
  ) {
    return "cpp";
  }

  if (lower.endsWith(".json")) {
    return "json";
  }

  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "markdown";
  }

  return "plaintext";
}

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createWorkspaceFile(
  workspace: WorkspaceState,
  parentId: string | null,
  name: string,
) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { workspace, changed: false, file: null };
  }

  const parentPath = getFolderPath(workspace, parentId);

  if (parentPath === null) {
    return { workspace, changed: false, file: null };
  }

  const path = siblingPath(parentPath, trimmedName);
  const existing = workspace.nodes.find((n) => n.path === path);

  if (existing) {
    return { workspace, changed: false, file: null };
  }

  const language = inferLanguageFromExtension(trimmedName);
  const runtime = executionRuntimeForLanguage(language);
  const id = generateId("file");

  const file = createFile(id, trimmedName, parentId, path, language, "", runtime);

  return {
    workspace: {
      ...workspace,
      nodes: sortNodes([...workspace.nodes, file]),
      activeFileId: file.id,
      openFileIds: [...workspace.openFileIds.filter((id) => id !== file.id), file.id],
    },
    changed: true,
    file,
  };
}

export function createWorkspaceFolder(
  workspace: WorkspaceState,
  parentId: string | null,
  name: string,
) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { workspace, changed: false, folder: null };
  }

  const parentPath = getFolderPath(workspace, parentId);

  if (parentPath === null) {
    return { workspace, changed: false, folder: null };
  }

  const path = siblingPath(parentPath, trimmedName);
  const existing = workspace.nodes.find((n) => n.path === path);

  if (existing) {
    return { workspace, changed: false, folder: null };
  }

  const id = generateId("folder");
  const folder = createFolder(id, trimmedName, parentId, path);

  return {
    workspace: {
      ...workspace,
      nodes: sortNodes([...workspace.nodes, folder]),
    },
    changed: true,
    folder,
  };
}

export function renameWorkspaceNode(
  workspace: WorkspaceState,
  nodeId: string,
  newName: string,
) {
  const trimmedName = newName.trim();

  if (!trimmedName) {
    return { workspace, changed: false, node: null };
  }

  const node = workspace.nodes.find((n) => n.id === nodeId);

  if (!node) {
    return { workspace, changed: false, node: null };
  }

  const oldPath = node.path;
  const parentPath = getFolderPath(workspace, node.parentId);

  if (parentPath === null) {
    return { workspace, changed: false, node: null };
  }

  const newPath = siblingPath(parentPath, trimmedName);
  const existing = workspace.nodes.find(
    (n) => n.id !== nodeId && n.path === newPath,
  );

  if (existing) {
    return { workspace, changed: false, node: null };
  }

  const pathPrefix = oldPath;
  const nextNodes = workspace.nodes.map((n) => {
    if (n.id === nodeId) {
      const updated = { ...n, name: trimmedName, path: newPath };

      if (updated.kind === "file") {
        const newLang = inferLanguageFromExtension(trimmedName);
        (updated as WorkspaceFileNode).language = newLang;
        (updated as WorkspaceFileNode).executionRuntime =
          executionRuntimeForLanguage(newLang);
      }

      return updated;
    }

    if (n.path.startsWith(`${pathPrefix}/`)) {
      return { ...n, path: n.path.replace(pathPrefix, newPath) };
    }

    return n;
  });

  const renamedNode = nextNodes.find((n) => n.id === nodeId) ?? null;

  let nextActiveFileId = workspace.activeFileId;
  let nextOpenFileIds = workspace.openFileIds;

  if (node.kind === "file") {
    nextOpenFileIds = workspace.openFileIds.map((id) =>
      id === nodeId ? nodeId : id,
    );
  }

  return {
    workspace: {
      ...workspace,
      nodes: sortNodes(nextNodes),
      activeFileId: nextActiveFileId,
      openFileIds: nextOpenFileIds,
    },
    changed: true,
    node: renamedNode,
  };
}

export function deleteWorkspaceNode(
  workspace: WorkspaceState,
  nodeId: string,
) {
  const node = workspace.nodes.find((n) => n.id === nodeId);

  if (!node) {
    return { workspace, changed: false };
  }

  const idsToDelete = new Set<string>([nodeId]);

  if (node.kind === "folder") {
    for (const n of workspace.nodes) {
      if (n.path.startsWith(`${node.path}/`)) {
        idsToDelete.add(n.id);
      }
    }
  }

  const nextNodes = workspace.nodes.filter((n) => !idsToDelete.has(n.id));
  const deletedFileIds = new Set(
    workspace.nodes
      .filter((n) => idsToDelete.has(n.id) && n.kind === "file")
      .map((n) => n.id),
  );

  let nextActiveFileId = workspace.activeFileId;
  let nextOpenFileIds = workspace.openFileIds.filter(
    (id) => !deletedFileIds.has(id),
  );

  if (deletedFileIds.has(nextActiveFileId)) {
    const activeIndex = workspace.openFileIds.indexOf(nextActiveFileId);
    nextActiveFileId =
      nextOpenFileIds[activeIndex] ??
      nextOpenFileIds[activeIndex - 1] ??
      nextOpenFileIds[0] ??
      "";
  }

  return {
    workspace: {
      ...workspace,
      nodes: nextNodes,
      activeFileId: nextActiveFileId,
      openFileIds: nextOpenFileIds,
    },
    changed: true,
  };
}

export function duplicateWorkspaceFile(
  workspace: WorkspaceState,
  nodeId: string,
) {
  const node = getNode(workspace, nodeId);

  if (!node || node.kind !== "file") {
    return { workspace, changed: false, file: null };
  }

  const uniqueName = getUniqueName(workspace, node.parentId, node.name);

  if (!uniqueName) {
    return { workspace, changed: false, file: null };
  }

  const parentPath = getFolderPath(workspace, node.parentId);

  if (parentPath === null) {
    return { workspace, changed: false, file: null };
  }

  const duplicate: WorkspaceFileNode = {
    ...node,
    id: generateId("file"),
    name: uniqueName,
    path: siblingPath(parentPath, uniqueName),
  };

  return {
    workspace: {
      ...workspace,
      nodes: sortNodes([...workspace.nodes, duplicate]),
      activeFileId: duplicate.id,
      openFileIds: [...workspace.openFileIds.filter((id) => id !== duplicate.id), duplicate.id],
    },
    changed: true,
    file: duplicate,
  };
}

export function moveWorkspaceNode(
  workspace: WorkspaceState,
  nodeId: string,
  targetParentId: string | null,
) {
  const node = getNode(workspace, nodeId);

  if (!node) {
    return { workspace, changed: false, node: null };
  }

  if (node.parentId === targetParentId) {
    return { workspace, changed: false, node };
  }

  const targetParentPath = getFolderPath(workspace, targetParentId);

  if (targetParentPath === null) {
    return { workspace, changed: false, node: null };
  }

  if (node.kind === "folder" && targetParentPath && isDescendantPath(node.path, targetParentPath)) {
    return { workspace, changed: false, node: null };
  }

  const nextPath = siblingPath(targetParentPath, node.name);

  if (
    workspace.nodes.some(
      (currentNode) => currentNode.id !== node.id && currentNode.path === nextPath,
    )
  ) {
    return { workspace, changed: false, node: null };
  }

  const nextNodes = workspace.nodes.map((currentNode) => {
    if (currentNode.id === node.id) {
      return {
        ...currentNode,
        parentId: targetParentId,
        path: nextPath,
      };
    }

    if (currentNode.path.startsWith(`${node.path}/`)) {
      return {
        ...currentNode,
        path: currentNode.path.replace(node.path, nextPath),
      };
    }

    return currentNode;
  });

  return {
    workspace: {
      ...workspace,
      nodes: sortNodes(nextNodes),
    },
    changed: true,
    node: nextNodes.find((currentNode) => currentNode.id === node.id) ?? null,
  };
}

export async function formatWorkspaceFile(
  workspace: WorkspaceState,
  fileId: string,
) {
  const file = getWorkspaceFile(workspace, fileId);

  if (!file) {
    return {
      workspace,
      changed: false,
      file: null,
      error: "The selected file was not found in the workspace.",
    };
  }

  try {
    const formattedContent = await formatWorkspaceFileContent(
      file.language,
      file.content,
    );

    return {
      ...updateWorkspaceFileContent(workspace, fileId, formattedContent),
      error: null,
    };
  } catch (error) {
    return {
      workspace,
      changed: false,
      file,
      error:
        error instanceof Error
          ? error.message
          : "The formatter failed for this file.",
    };
  }
}

export function closeWorkspaceTab(
  workspace: WorkspaceState,
  fileId: string,
) {
  if (!workspace.openFileIds.includes(fileId)) {
    return { workspace, changed: false };
  }

  const closedTabIndex = workspace.openFileIds.indexOf(fileId);
  const nextOpenFileIds = workspace.openFileIds.filter((id) => id !== fileId);
  let nextActiveFileId = workspace.activeFileId;

  if (workspace.activeFileId === fileId) {
    nextActiveFileId =
      nextOpenFileIds[closedTabIndex] ??
      nextOpenFileIds[closedTabIndex - 1] ??
      "";
  }

  return {
    workspace: {
      ...workspace,
      activeFileId: nextActiveFileId,
      openFileIds: nextOpenFileIds,
    },
    changed: true,
  };
}
