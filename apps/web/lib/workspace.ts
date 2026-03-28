import type {
  ExecutionRuntime,
  WorkspaceFileLanguage,
  WorkspaceFileNode,
  WorkspaceNode,
  WorkspaceState,
} from "./socket";

const FALLBACK_WORKSPACE: WorkspaceState = {
  nodes: [],
  activeFileId: "",
  openFileIds: [],
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

  if (language === "typescript") {
    return "TypeScript";
  }

  if (language === "python") {
    return "Python";
  }

  if (language === "c") {
    return "C";
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
  if (language === "c") {
    return "cpp";
  }

  if (language === "cpp") {
    return "cpp";
  }

  if (language === "typescript") {
    return "typescript";
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

  if (language === "typescript") {
    return undefined;
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

export type FileExecutionRoute =
  | "javascript"
  | "python"
  | "c"
  | "cpp"
  | "preview"
  | "unsupported";

export function detectExecutionExtension(
  file: Pick<WorkspaceFileNode, "name" | "path">,
) {
  const source = (file.path || file.name).trim().toLowerCase();
  const lastDotIndex = source.lastIndexOf(".");

  if (lastDotIndex < 0) {
    return null;
  }

  return source.slice(lastDotIndex);
}

export function getFileExecutionRoute(
  file: Pick<WorkspaceFileNode, "name" | "path">,
): FileExecutionRoute {
  const extension = detectExecutionExtension(file);

  if (extension === ".js") {
    return "javascript";
  }

  if (extension === ".py") {
    return "python";
  }

  if (extension === ".c") {
    return "c";
  }

  if (extension === ".cpp" || extension === ".cc" || extension === ".cxx") {
    return "cpp";
  }

  if (extension === ".html") {
    return "preview";
  }

  return "unsupported";
}

export function getRuntimeLabel(runtime: ExecutionRuntime | undefined) {
  if (!runtime) {
    return "Preview only";
  }

  if (runtime === "cpp") {
    return "C++";
  }

  if (runtime === "c") {
    return "C";
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

export function isPreviewWorkspaceFile(
  workspace: WorkspaceState,
  fileId: string,
) {
  const { htmlFile, cssFile, jsFile } = getPreviewFiles(workspace);

  return [htmlFile, cssFile, jsFile].some((file) => file?.id === fileId);
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

export function getFileIcon(language: WorkspaceFileLanguage): string {
  switch (language) {
    case "javascript":
      return "JS";
    case "typescript":
      return "TS";
    case "python":
      return "PY";
    case "c":
      return "C";
    case "html":
      return "HTML";
    case "css":
      return "CSS";
    case "cpp":
      return "C++";
    case "json":
      return "{}";
    case "markdown":
      return "MD";
    default:
      return "TXT";
  }
}

export type WorkspaceFileSearchResult = {
  id: string;
  fileId: string;
  name: string;
  path: string;
  icon: string;
  score: number;
};

export type WorkspaceContentSearchResult = {
  id: string;
  fileId: string;
  name: string;
  path: string;
  icon: string;
  lineNumber: number;
  lineText: string;
  score: number;
};

function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

function fuzzyScore(query: string, candidate: string) {
  const normalizedQuery = normalizeSearchQuery(query);
  const normalizedCandidate = candidate.toLowerCase();

  if (!normalizedQuery) {
    return 1;
  }

  if (normalizedCandidate.includes(normalizedQuery)) {
    const startIndex = normalizedCandidate.indexOf(normalizedQuery);
    const lengthBonus = Math.max(0, 60 - normalizedCandidate.length);

    return 220 - startIndex * 2 + lengthBonus;
  }

  let score = 0;
  let queryIndex = 0;
  let consecutiveBonus = 0;

  for (let candidateIndex = 0; candidateIndex < normalizedCandidate.length; candidateIndex += 1) {
    if (normalizedCandidate[candidateIndex] !== normalizedQuery[queryIndex]) {
      consecutiveBonus = 0;
      continue;
    }

    score += 10;
    score += Math.max(0, 12 - candidateIndex);
    score += consecutiveBonus;
    consecutiveBonus += 5;
    queryIndex += 1;

    if (queryIndex === normalizedQuery.length) {
      return score;
    }
  }

  return null;
}

export function searchWorkspaceFiles(
  workspace: WorkspaceState,
  query: string,
): WorkspaceFileSearchResult[] {
  const files = getWorkspaceFiles(workspace);
  const normalizedQuery = normalizeSearchQuery(query);

  const rankedFiles = files
    .map((file) => {
      const nameScore = fuzzyScore(normalizedQuery, file.name);
      const pathScore = fuzzyScore(normalizedQuery, file.path);
      const score = Math.max(nameScore ?? -1, pathScore ?? -1);

      return {
        id: file.id,
        fileId: file.id,
        name: file.name,
        path: file.path,
        icon: getFileIcon(file.language),
        score,
      };
    })
    .filter((file) => normalizedQuery.length === 0 || file.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.path.localeCompare(right.path);
    });

  return rankedFiles.slice(0, 60);
}

export function searchWorkspaceContents(
  workspace: WorkspaceState,
  query: string,
): WorkspaceContentSearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  const matches: WorkspaceContentSearchResult[] = [];

  for (const file of getWorkspaceFiles(workspace)) {
    const lines = file.content.split(/\r?\n/);

    lines.forEach((line, index) => {
      const normalizedLine = line.toLowerCase();

      if (!normalizedLine.includes(normalizedQuery)) {
        return;
      }

      const startIndex = normalizedLine.indexOf(normalizedQuery);

      matches.push({
        id: `${file.id}:${index + 1}`,
        fileId: file.id,
        name: file.name,
        path: file.path,
        icon: getFileIcon(file.language),
        lineNumber: index + 1,
        lineText: line.trim() || "(empty line)",
        score: 180 - startIndex * 2,
      });
    });
  }

  return matches
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.path !== right.path) {
        return left.path.localeCompare(right.path);
      }

      return left.lineNumber - right.lineNumber;
    })
    .slice(0, 80);
}

export function applyWorkspaceTreeUpdate(
  current: WorkspaceState,
  incoming: WorkspaceState,
): WorkspaceState {
  return {
    ...current,
    activeFileId: incoming.activeFileId,
    openFileIds: [...incoming.openFileIds],
    nodes: incoming.nodes,
  };
}

export function applyTabClose(
  current: WorkspaceState,
  _fileId: string,
  activeFileId: string,
  openFileIds: string[],
): WorkspaceState {
  return {
    ...current,
    activeFileId,
    openFileIds,
  };
}
