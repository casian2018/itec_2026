import assert from "node:assert/strict";
import test from "node:test";
import { geminiCodegenTesting } from "./gemini-codegen.js";
import type { WorkspaceFileNode, WorkspaceState } from "../types.js";

const file: WorkspaceFileNode = {
  id: "file-1",
  kind: "file",
  name: "demo.ts",
  parentId: null,
  path: "src/demo.ts",
  language: "typescript",
  content: [
    "export function greet(name: string) {",
    "  const normalized = name.trim();",
    "",
    "  if (!normalized) {",
    '    return "Hello";',
    "  }",
    "",
    "  return `Hello, ${normalized}`;",
    "}",
    "",
    'console.log(greet("team"));',
  ].join("\n"),
};

const workspace: WorkspaceState = {
  nodes: [file],
  activeFileId: file.id,
  openFileIds: [file.id],
};

test("next-line edit prompts stay cursor-local and copilot-like", () => {
  const systemInstruction =
    geminiCodegenTesting.editProposalSystemInstruction("next-line");
  const requestText = geminiCodegenTesting.editProposalRequest({
    prompt: "Continue the current function with the most likely next step.",
    file,
    workspace,
    mode: "next-line",
    cursorLine: 7,
  });

  assert.match(systemInstruction, /GitHub Copilot/i);
  assert.match(requestText, /Assistant mode: next-line/);
  assert.match(requestText, /Cursor line: 7/);
  assert.match(
    requestText,
    /Prefer a single insert at or just after the cursor line/i,
  );
  assert.match(requestText, /Focused window around the cursor:/);
});

test("selection-aware edit prompts keep Gemini anchored to the selected region", () => {
  const requestText = geminiCodegenTesting.editProposalRequest({
    prompt: "Refactor the selected code.",
    file,
    workspace,
    mode: "assist",
    selection: {
      startLineNumber: 4,
      endLineNumber: 8,
      selectedText: [
        "  if (!normalized) {",
        '    return "Hello";',
        "  }",
        "",
        "  return `Hello, ${normalized}`;",
      ].join("\n"),
    },
  });

  assert.match(requestText, /Selection lines: 4-8/);
  assert.match(requestText, /Focused file window around the selection:/);
  assert.match(
    requestText,
    /Keep edits inside the selection unless the request clearly requires a tiny adjacent change/i,
  );
});

test("chat reply prompts include assistant mode and cursor context", () => {
  const requestText = geminiCodegenTesting.chatReplyRequest({
    prompt: "What would you change here?",
    workspace,
    file,
    mode: "next-line",
    cursorLine: 8,
    selection: null,
  });

  assert.match(requestText, /Assistant mode: next-line/);
  assert.match(requestText, /Cursor line: 8/);
  assert.match(requestText, /Current file: src\/demo\.ts \(typescript\)/);
});
