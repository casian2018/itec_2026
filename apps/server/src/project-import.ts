import JSZip from "jszip";
import type {
  WorkspaceFileLanguage,
  WorkspaceFileNode,
  WorkspaceNode,
  WorkspaceState,
} from "./types.js";
import {
  executionRuntimeForLanguage,
  inferLanguageFromExtension,
} from "./workspace.js";

const SUPPORTED_IMPORT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".c",
  ".h",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".cpp",
  ".cc",
  ".cxx",
  ".hpp",
  ".json",
  ".md",
  ".markdown",
  ".txt",
]);

const IGNORED_PATH_SEGMENTS = new Set([
  "__MACOSX",
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
]);

export const MAX_PROJECT_IMPORT_ENTRIES = 600;
export const MAX_PROJECT_IMPORT_TEXT_BYTES = 4 * 1024 * 1024;

export type ProjectImportWarning = {
  path: string;
  reason: string;
};

export type ProjectImportSummary = {
  importedFileCount: number;
  importedFolderCount: number;
  skippedCount: number;
  openedFilePath: string | null;
  warnings: ProjectImportWarning[];
};

export type ProjectImportResult = {
  workspace: WorkspaceState;
  summary: ProjectImportSummary;
};

type ImportProjectZipOptions = {
  maxEntries?: number;
  maxTextBytes?: number;
};

type ImportedTextFile = {
  id: string;
  name: string;
  path: string;
  language: WorkspaceFileLanguage;
  content: string;
};

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeArchivePath(rawPath: string) {
  const normalized = rawPath.replace(/\\/g, "/").trim();

  if (!normalized || normalized.startsWith("/")) {
    return null;
  }

  const segments = normalized.split("/").filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }

  return segments.join("/");
}

function pathDepth(path: string) {
  return path.split("/").length;
}

function parentPathFor(path: string) {
  const segments = path.split("/");
  segments.pop();
  return segments.join("/");
}

function basenameFor(path: string) {
  return path.split("/").at(-1) ?? path;
}

function extensionFor(path: string) {
  const normalized = basenameFor(path).toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex <= 0) {
    return "";
  }

  return normalized.slice(dotIndex);
}

function isIgnoredArchivePath(path: string) {
  return path
    .split("/")
    .some((segment) => IGNORED_PATH_SEGMENTS.has(segment));
}

function isSupportedImportPath(path: string) {
  return SUPPORTED_IMPORT_EXTENSIONS.has(extensionFor(path));
}

function pushWarning(
  warnings: ProjectImportWarning[],
  path: string,
  reason: string,
) {
  warnings.push({ path, reason });
}

function appendParentFolders(folderPaths: Set<string>, path: string) {
  const segments = path.split("/");

  for (let index = 1; index <= segments.length; index += 1) {
    const folderPath = segments.slice(0, index).join("/");

    if (folderPath) {
      folderPaths.add(folderPath);
    }
  }
}

function preferredOpenFilePath(files: ImportedTextFile[]) {
  const candidates = [
    "index.html",
    "readme.md",
    "main.py",
    "main.cpp",
    "src/index.js",
    "src/index.ts",
  ];

  for (const candidate of candidates) {
    const exactMatch = files.find(
      (file) => file.path.toLowerCase() === candidate,
    );

    if (exactMatch) {
      return exactMatch.path;
    }

    const suffixMatch = files.find((file) =>
      file.path.toLowerCase().endsWith(`/${candidate}`),
    );

    if (suffixMatch) {
      return suffixMatch.path;
    }
  }

  return files[0]?.path ?? null;
}

function buildWorkspaceFromImportedFiles(
  folderPaths: Set<string>,
  files: ImportedTextFile[],
) {
  const sortedFolderPaths = Array.from(folderPaths).sort((left, right) => {
    const depthDifference = pathDepth(left) - pathDepth(right);
    return depthDifference !== 0
      ? depthDifference
      : left.localeCompare(right);
  });
  const folderIdByPath = new Map<string, string>();
  const nodes: WorkspaceNode[] = [];

  for (const folderPath of sortedFolderPaths) {
    const parentPath = parentPathFor(folderPath);
    const folderId = createId("folder");
    folderIdByPath.set(folderPath, folderId);
    nodes.push({
      id: folderId,
      kind: "folder",
      name: basenameFor(folderPath),
      parentId: parentPath ? (folderIdByPath.get(parentPath) ?? null) : null,
      path: folderPath,
    });
  }

  const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));

  for (const file of sortedFiles) {
    const parentPath = parentPathFor(file.path);
    const node: WorkspaceFileNode = {
      id: file.id,
      kind: "file",
      name: file.name,
      parentId: parentPath ? (folderIdByPath.get(parentPath) ?? null) : null,
      path: file.path,
      language: file.language,
      content: file.content,
      executionRuntime: executionRuntimeForLanguage(file.language),
    };
    nodes.push(node);
  }

  const openedFilePath = preferredOpenFilePath(sortedFiles);
  const openedFile = openedFilePath
    ? sortedFiles.find((file) => file.path === openedFilePath) ?? null
    : null;

  return {
    workspace: {
      nodes,
      activeFileId: openedFile?.id ?? "",
      openFileIds: openedFile ? [openedFile.id] : [],
    },
    openedFilePath: openedFile?.path ?? null,
  };
}

export async function importWorkspaceFromZipBuffer(
  archiveBuffer: Buffer,
  options: ImportProjectZipOptions = {},
): Promise<ProjectImportResult> {
  const maxEntries = options.maxEntries ?? MAX_PROJECT_IMPORT_ENTRIES;
  const maxTextBytes = options.maxTextBytes ?? MAX_PROJECT_IMPORT_TEXT_BYTES;
  const archive = await JSZip.loadAsync(archiveBuffer);
  const warnings: ProjectImportWarning[] = [];
  const folderPaths = new Set<string>();
  const files: ImportedTextFile[] = [];
  let totalTextBytes = 0;
  let processedEntries = 0;

  for (const zipEntry of Object.values(archive.files)) {
    processedEntries += 1;

    if (processedEntries > maxEntries) {
      throw new Error(
        `ZIP contains too many entries for this MVP. Limit is ${maxEntries}.`,
      );
    }

    const normalizedPath = normalizeArchivePath(zipEntry.name);

    if (!normalizedPath) {
      pushWarning(warnings, zipEntry.name, "Skipped invalid archive path.");
      continue;
    }

    if (isIgnoredArchivePath(normalizedPath)) {
      pushWarning(warnings, normalizedPath, "Skipped generated dependency folder.");
      continue;
    }

    if (zipEntry.dir) {
      appendParentFolders(folderPaths, normalizedPath);
      continue;
    }

    const filePath = normalizedPath;
    const parentPath = parentPathFor(filePath);

    if (parentPath) {
      appendParentFolders(folderPaths, parentPath);
    }

    if (!isSupportedImportPath(filePath)) {
      pushWarning(
        warnings,
        filePath,
        "Skipped unsupported or binary file for the hackathon editor.",
      );
      continue;
    }

    const content = await zipEntry.async("string");
    const nextFileBytes = Buffer.byteLength(content, "utf8");

    if (totalTextBytes + nextFileBytes > maxTextBytes) {
      throw new Error(
        `Imported text content exceeds ${Math.round(
          maxTextBytes / 1024 / 1024,
        )} MB after extraction.`,
      );
    }

    totalTextBytes += nextFileBytes;

    files.push({
      id: createId("file"),
      name: basenameFor(filePath),
      path: filePath,
      language: inferLanguageFromExtension(filePath),
      content: content.replace(/\r\n/g, "\n"),
    });
  }

  const { workspace, openedFilePath } = buildWorkspaceFromImportedFiles(
    folderPaths,
    files,
  );

  return {
    workspace,
    summary: {
      importedFileCount: files.length,
      importedFolderCount: folderPaths.size,
      skippedCount: warnings.length,
      openedFilePath,
      warnings,
    },
  };
}
