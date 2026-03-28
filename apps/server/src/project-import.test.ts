import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { importWorkspaceFromZipBuffer } from "./project-import.js";

test("imports supported text files from a ZIP archive into workspace state", async () => {
  const archive = new JSZip();
  archive.file("src/index.js", 'console.log("hello");\n');
  archive.file("README.md", "# Demo\n");
  archive.file("public/index.html", "<!doctype html><title>Demo</title>");

  const result = await importWorkspaceFromZipBuffer(
    await archive.generateAsync({ type: "nodebuffer" }),
  );

  assert.equal(result.summary.importedFileCount, 3);
  assert.equal(result.summary.importedFolderCount, 2);
  assert.equal(result.summary.skippedCount, 0);
  assert.equal(result.summary.openedFilePath, "public/index.html");
  assert.equal(result.workspace.openFileIds.length, 1);
  assert.ok(
    result.workspace.nodes.some(
      (node) => node.kind === "file" && node.path === "src/index.js",
    ),
  );
});

test("skips unsupported and unsafe archive entries", async () => {
  const archive = new JSZip();
  archive.file("assets/logo.png", "binary");
  archive.file("__MACOSX/metadata.txt", "skip");
  archive.file(".git/config", "skip");
  archive.file("notes/todo.txt", "ship it");

  const result = await importWorkspaceFromZipBuffer(
    await archive.generateAsync({ type: "nodebuffer" }),
  );

  assert.equal(result.summary.importedFileCount, 1);
  assert.equal(result.summary.skippedCount, 5);
  assert.equal(result.summary.openedFilePath, "notes/todo.txt");
  assert.ok(
    result.summary.warnings.some((warning) =>
      warning.reason.includes("unsupported") ||
      warning.reason.includes("generated"),
    ),
  );
});

test("imports common project files used by real web repositories", async () => {
  const archive = new JSZip();
  archive.file("src/App.jsx", "export default function App() { return <main>Hello</main>; }\n");
  archive.file("Dockerfile", "FROM node:20-alpine\n");
  archive.file(".env", "VITE_API_URL=http://localhost:4000\n");
  archive.file("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");

  const result = await importWorkspaceFromZipBuffer(
    await archive.generateAsync({ type: "nodebuffer" }),
  );

  assert.equal(result.summary.importedFileCount, 4);
  assert.ok(
    result.workspace.nodes.some(
      (node) => node.kind === "file" && node.path === "src/App.jsx",
    ),
  );
  assert.ok(
    result.workspace.nodes.some(
      (node) => node.kind === "file" && node.path === "Dockerfile",
    ),
  );
  assert.ok(
    result.workspace.nodes.some(
      (node) => node.kind === "file" && node.path === ".env",
    ),
  );
});
