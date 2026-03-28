import type {
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

  if (language === "cpp") {
    return "cpp";
  }

  return undefined;
}

export function createDefaultWorkspace(): WorkspaceState {
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

export function updateWorkspaceView(
  workspace: WorkspaceState,
  activeFileId: string,
  openFileIds: string[],
) {
  const validFileIds = listWorkspaceFiles(workspace).map((file) => file.id);
  const normalizedOpenFileIds = normalizeOpenFileIds(workspace, openFileIds);
  const nextActiveFileId = validFileIds.includes(activeFileId)
    ? activeFileId
    : validFileIds[0] ?? workspace.activeFileId;

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
