import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceFileNode } from "../types.js";
import { ExecutionRouter } from "./execution-router.js";
import { CExecutionService } from "./services/c-execution-service.js";
import { HtmlPreviewExecutionService } from "./services/html-preview-execution-service.js";
import { JavaScriptExecutionService } from "./services/javascript-execution-service.js";
import { PythonExecutionService } from "./services/python-execution-service.js";
import { CppExecutionService } from "./services/cpp-execution-service.js";

const router = new ExecutionRouter([
  new JavaScriptExecutionService(),
  new PythonExecutionService(),
  new CExecutionService(),
  new CppExecutionService(),
  new HtmlPreviewExecutionService(),
]);

function file(path: string): WorkspaceFileNode {
  return {
    id: `file-${path}`,
    kind: "file",
    name: path.split("/").at(-1) ?? path,
    parentId: null,
    path,
    language: "plaintext",
    content: "",
  };
}

test("routes .js files to the JavaScript runner", () => {
  const result = router.route(file("src/index.js"));

  assert.equal(result.kind, "service");
  assert.equal(result.extension, ".js");
  assert.equal(result.service.id, "javascript-runner");
});

test("routes .py files to the Python runner", () => {
  const result = router.route(file("src/main.py"));

  assert.equal(result.kind, "service");
  assert.equal(result.extension, ".py");
  assert.equal(result.service.id, "python-runner");
});

test("routes .cpp files to the C++ runner", () => {
  const result = router.route(file("src/main.cpp"));

  assert.equal(result.kind, "service");
  assert.equal(result.extension, ".cpp");
  assert.equal(result.service.id, "cpp-runner");
});

test("routes .c files to the C runner", () => {
  const result = router.route(file("src/main.c"));

  assert.equal(result.kind, "service");
  assert.equal(result.extension, ".c");
  assert.equal(result.service.id, "c-runner");
});

test("routes .html files to the preview service", () => {
  const result = router.route(file("public/index.html"));

  assert.equal(result.kind, "service");
  assert.equal(result.extension, ".html");
  assert.equal(result.service.id, "html-preview");
});

test("reports unsupported extensions as system-routeable errors", () => {
  const result = router.route(file("README.md"));

  assert.equal(result.kind, "unsupported");
  assert.match(result.message, /Unsupported file type \.md/);
});
