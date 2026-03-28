import type {
  ExecutionRuntime,
  WorkspaceFileLanguage,
  WorkspaceFileNode,
  WorkspaceNode,
  WorkspaceState,
} from "./socket";

const FALLBACK_WORKSPACE: WorkspaceState = {
  nodes: [
    {
      id: "folder-src",
      kind: "folder",
      name: "src",
      parentId: null,
      path: "src",
    },
    {
      id: "folder-public",
      kind: "folder",
      name: "public",
      parentId: null,
      path: "public",
    },
    {
      id: "file-js-entry",
      kind: "file",
      name: "index.js",
      parentId: "folder-src",
      path: "src/index.js",
      language: "javascript",
      executionRuntime: "javascript",
      content: `export function createWorkspaceSummary() {
  console.log("iTECify workspace ready.");
}

createWorkspaceSummary();
`,
    },
    {
      id: "file-html-entry",
      kind: "file",
      name: "index.html",
      parentId: "folder-public",
      path: "public/index.html",
      language: "html",
      content: `<!doctype html>
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
`,
    },
    {
      id: "file-css-entry",
      kind: "file",
      name: "style.css",
      parentId: "folder-public",
      path: "public/style.css",
      language: "css",
      content: `:root {
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
`,
    },
    {
      id: "file-preview-script",
      kind: "file",
      name: "script.js",
      parentId: "folder-public",
      path: "public/script.js",
      language: "javascript",
      content: `const button = document.querySelector("#preview-button");
const output = document.querySelector("#preview-output");

if (button && output) {
  button.addEventListener("click", () => {
    output.textContent = "Live preview JavaScript executed successfully.";
  });
}
`,
    },
  ],
  activeFileId: "file-js-entry",
  openFileIds: ["file-js-entry", "file-html-entry", "file-css-entry"],
};

export function createFallbackWorkspace(): WorkspaceState {
  return cloneWorkspace(FALLBACK_WORKSPACE);
}

export function cloneWorkspace(workspace: WorkspaceState): WorkspaceState {
  return {
    activeFileId: workspace.activeFileId,
    openFileIds: [...workspace.openFileIds],
    nodes: workspace.nodes.map((node) => ({ ...node })),
  };
}

export function isWorkspaceFile(node: WorkspaceNode): node is WorkspaceFileNode {
  return node.kind === "file";
}

export function getWorkspaceFiles(workspace: WorkspaceState) {
  return workspace.nodes.filter(isWorkspaceFile);
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

export function getWorkspaceFileByPath(
  workspace: WorkspaceState,
  path: string,
): WorkspaceFileNode | null {
  const normalizedPath = path.trim().toLowerCase();

  return (
    getWorkspaceFiles(workspace).find(
      (file) => file.path.toLowerCase() === normalizedPath,
    ) ?? null
  );
}

export function getWorkspaceLanguageLabel(language: WorkspaceFileLanguage) {
  if (language === "javascript") {
    return "JavaScript";
  }

  if (language === "python") {
    return "Python";
  }

  if (language === "cpp") {
    return "C++";
  }

  if (language === "html") {
    return "HTML";
  }

  if (language === "css") {
    return "CSS";
  }

  if (language === "json") {
    return "JSON";
  }

  if (language === "markdown") {
    return "Markdown";
  }

  return "Plain Text";
}

export function toMonacoLanguage(language: WorkspaceFileLanguage) {
  if (language === "cpp") {
    return "cpp";
  }

  if (language === "plaintext") {
    return "text";
  }

  return language;
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

export function getRuntimeLabel(runtime: ExecutionRuntime | undefined) {
  if (!runtime) {
    return "Preview only";
  }

  if (runtime === "cpp") {
    return "C++";
  }

  return getWorkspaceLanguageLabel(runtime);
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
    getWorkspaceFiles(workspace).find((file) => file.language === "html") ??
    null;
  const cssFile =
    preferredPreviewFile(workspace, [
      "public/style.css",
      "public/styles.css",
      "style.css",
      "styles.css",
    ]) ??
    getWorkspaceFiles(workspace).find((file) => file.language === "css") ??
    null;
  const jsFile =
    preferredPreviewFile(workspace, [
      "public/script.js",
      "public/index.js",
      "script.js",
      "index.js",
    ]) ??
    getWorkspaceFiles(workspace).find(
      (file) =>
        file.language === "javascript" &&
        !file.executionRuntime,
    ) ??
    null;

  return {
    htmlFile,
    cssFile,
    jsFile,
  };
}

function stripPreviewLinks(html: string) {
  return html
    .replace(
      /<link[^>]+rel=["']stylesheet["'][^>]*href=["'][^"']+["'][^>]*>/gi,
      "",
    )
    .replace(/<script[^>]+src=["'][^"']+["'][^>]*>\s*<\/script>/gi, "");
}

export function buildWorkspacePreviewDocument(workspace: WorkspaceState) {
  const { htmlFile, cssFile, jsFile } = getPreviewFiles(workspace);

  if (!htmlFile) {
    return null;
  }

  const sanitizedHtml = stripPreviewLinks(htmlFile.content);
  const styleTag = cssFile ? `<style>\n${cssFile.content}\n</style>` : "";
  const scriptTag = jsFile ? `<script>\n${jsFile.content}\n</script>` : "";

  let nextDocument = sanitizedHtml;

  if (styleTag) {
    if (nextDocument.includes("</head>")) {
      nextDocument = nextDocument.replace("</head>", `${styleTag}\n</head>`);
    } else {
      nextDocument = `${styleTag}\n${nextDocument}`;
    }
  }

  if (scriptTag) {
    if (nextDocument.includes("</body>")) {
      nextDocument = nextDocument.replace("</body>", `${scriptTag}\n</body>`);
    } else {
      nextDocument = `${nextDocument}\n${scriptTag}`;
    }
  }

  return nextDocument;
}

export function updateWorkspaceFileContent(
  workspace: WorkspaceState,
  fileId: string,
  content: string,
) {
  return {
    ...workspace,
    nodes: workspace.nodes.map((node) =>
      node.kind === "file" && node.id === fileId
        ? {
            ...node,
            content,
          }
        : node,
    ),
  };
}

export function updateWorkspaceFileLanguage(
  workspace: WorkspaceState,
  fileId: string,
  language: WorkspaceFileLanguage,
) {
  return {
    ...workspace,
    nodes: workspace.nodes.map((node) =>
      node.kind === "file" && node.id === fileId
        ? {
            ...node,
            language,
            executionRuntime: executionRuntimeForLanguage(language),
          }
        : node,
    ),
  };
}

export function updateWorkspaceView(
  workspace: WorkspaceState,
  activeFileId: string,
  openFileIds: string[],
) {
  const validFileIds = new Set(getWorkspaceFiles(workspace).map((file) => file.id));
  const nextOpenFileIds = openFileIds.filter(
    (openFileId, index) =>
      validFileIds.has(openFileId) && openFileIds.indexOf(openFileId) === index,
  );

  if (validFileIds.has(activeFileId) && !nextOpenFileIds.includes(activeFileId)) {
    nextOpenFileIds.unshift(activeFileId);
  }

  return {
    ...workspace,
    activeFileId,
    openFileIds: nextOpenFileIds,
  };
}

export function serializeWorkspace(workspace: WorkspaceState) {
  return JSON.stringify(workspace);
}
