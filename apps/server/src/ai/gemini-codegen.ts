import type {
  AiBlockApplyMode,
  AiEditChangeType,
  AiSuggestionMode,
  WorkspaceFileNode,
  WorkspaceState,
} from "../types.js";
import { listWorkspaceFiles } from "../workspace.js";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_AI_LINE_CHANGES = 12;

type GeminiSuggestion = {
  explanation: string;
  code: string;
  insertAfterLine: number;
  mode: AiSuggestionMode;
  applyMode: AiBlockApplyMode;
};

type GeminiStructuredLineChange = {
  type: AiEditChangeType;
  lineNumber: number;
  oldText: string;
  newText: string;
  summary: string;
};

type GeminiEditProposal = {
  explanation: string;
  changes: GeminiStructuredLineChange[];
};

type GenerateGeminiSuggestionOptions = {
  prompt: string;
  file: WorkspaceFileNode;
  workspace: WorkspaceState;
  mode: AiSuggestionMode;
  cursorLine?: number | null;
};

type GenerateGeminiEditProposalOptions = {
  prompt: string;
  file: WorkspaceFileNode;
  workspace: WorkspaceState;
};

function lineNumberedContent(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line, index) => `${index + 1}: ${line}`)
    .join("\n");
}

function workspaceSummary(workspace: WorkspaceState, activeFileId: string) {
  return listWorkspaceFiles(workspace)
    .slice(0, 24)
    .map(
      (file) =>
        `- ${file.path} (${file.language})${file.id === activeFileId ? " [active]" : ""}`,
    )
    .join("\n");
}

function lineCount(content: string) {
  return Math.max(1, content.replace(/\r\n/g, "\n").split("\n").length);
}

function clampInsertAfterLine(insertAfterLine: number, fileContent: string) {
  const totalLines = lineCount(fileContent);
  return Math.min(Math.max(1, Math.trunc(insertAfterLine)), totalLines);
}

function clampLineNumber(
  lineNumber: number,
  fileContent: string,
  type: AiEditChangeType,
) {
  const totalLines = lineCount(fileContent);
  const maxLine = type === "insert" ? totalLines + 1 : totalLines;
  return Math.min(Math.max(1, Math.trunc(lineNumber)), maxLine);
}

function contentWindowAroundLine(content: string, targetLine: number, radius = 6) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const clampedLine = Math.min(Math.max(1, targetLine), Math.max(1, lines.length));
  const startIndex = Math.max(0, clampedLine - 1 - radius);
  const endIndex = Math.min(lines.length, clampedLine + radius);

  return lines
    .slice(startIndex, endIndex)
    .map((line, index) => `${startIndex + index + 1}: ${line}`)
    .join("\n");
}

function suggestionSystemInstruction(mode: AiSuggestionMode) {
  if (mode === "next-line") {
    return [
      "You are a senior software engineer assisting inside a collaborative browser IDE.",
      "Generate a likely next-line or short next-step continuation for the active file at the user's current cursor location.",
      "Keep the suggestion local, syntactically valid, and short enough to be reviewed quickly.",
      "Do not rewrite the whole file. Do not include markdown fences.",
      "Return only valid JSON matching the schema.",
    ].join(" ");
  }

  if (mode === "optimize") {
    return [
      "You are a senior software engineer assisting inside a collaborative browser IDE.",
      "Generate a full-file optimized rewrite for the active file.",
      "Improve structure, readability, and obvious performance or correctness issues without changing the intended behavior unless a bug fix is clearly needed.",
      "Return the complete rewritten file contents as raw source code, not a patch and not markdown.",
      "Return only valid JSON matching the schema.",
    ].join(" ");
  }

  return [
    "You are a senior software engineer assisting inside a collaborative browser IDE.",
    "Generate one small, practical code suggestion for the active file.",
    "Return only valid JSON matching the schema.",
    "The code must be raw source code without markdown fences.",
  ].join(" ");
}

function suggestionRequest({
  prompt,
  file,
  workspace,
  mode,
  cursorLine,
}: GenerateGeminiSuggestionOptions) {
  const normalizedPrompt = prompt.trim();
  const effectiveCursorLine = clampInsertAfterLine(
    cursorLine ?? lineCount(file.content),
    file.content,
  );

  if (mode === "next-line") {
    return [
      `User request: ${normalizedPrompt || "Continue the code at the current cursor line with the most likely next step."}`,
      `Active file: ${file.path}`,
      `Language: ${file.language}`,
      `Cursor is on line ${effectiveCursorLine}.`,
      "Workspace files:",
      workspaceSummary(workspace, file.id),
      "Relevant file window around the cursor:",
      contentWindowAroundLine(file.content, effectiveCursorLine),
      "Return only the next line or short continuation to insert after the cursor line.",
      "Prefer 1 to 6 lines unless the file clearly needs a slightly larger continuation.",
    ].join("\n\n");
  }

  if (mode === "optimize") {
    return [
      `User request: ${normalizedPrompt || "Optimize the active file while preserving its intended behavior."}`,
      `Active file: ${file.path}`,
      `Language: ${file.language}`,
      "Workspace files:",
      workspaceSummary(workspace, file.id),
      "Active file contents with 1-based line numbers:",
      lineNumberedContent(file.content),
      "Return the full rewritten file contents as the code field.",
      "Use the explanation to summarize the most important optimizations and fixes.",
    ].join("\n\n");
  }

  return [
    `User request: ${normalizedPrompt || "Suggest a practical next improvement for this file."}`,
    `Active file: ${file.path}`,
    `Language: ${file.language}`,
    "Workspace files:",
    workspaceSummary(workspace, file.id),
    "Active file contents with 1-based line numbers:",
    lineNumberedContent(file.content),
    "Return a minimal code patch that can be inserted into the active file.",
  ].join("\n\n");
}

function editProposalSystemInstruction() {
  return [
    "You are a senior software engineer working inside a collaborative browser IDE.",
    "Return a compact, reviewable set of line-by-line file edits for the active file.",
    "The user must explicitly approve each change before anything is saved.",
    "Prefer the minimum number of changes needed to satisfy the request.",
    `Return at most ${MAX_AI_LINE_CHANGES} changes.`,
    "Each change must be one of: insert, replace, delete.",
    "Do not return markdown fences or prose outside JSON.",
  ].join(" ");
}

function editProposalRequest({
  prompt,
  file,
  workspace,
}: GenerateGeminiEditProposalOptions) {
  return [
    `Developer request: ${prompt.trim()}`,
    `Active file: ${file.path}`,
    `Language: ${file.language}`,
    "Workspace files:",
    workspaceSummary(workspace, file.id),
    "Active file contents with 1-based line numbers:",
    lineNumberedContent(file.content),
    "Generate reviewable line edits, not a full rewritten file.",
    "Use insert with lineNumber = totalLines + 1 only when appending to the end of the file.",
    "For replace/delete, keep oldText aligned with the current file content at that line.",
    "Summaries should be short and specific.",
  ].join("\n\n");
}

function extractTextFromGeminiResponse(payload: any) {
  const parts = payload?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    throw new Error("Gemini did not return any content parts.");
  }

  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty suggestion.");
  }

  return text;
}

function validateSuggestion(
  raw: any,
  fileContent: string,
  mode: AiSuggestionMode,
  cursorLine?: number | null,
): GeminiSuggestion {
  if (typeof raw?.explanation !== "string" || typeof raw?.code !== "string") {
    throw new Error("Gemini returned an invalid structured suggestion.");
  }

  const explanation = raw.explanation.trim();
  const code = raw.code.replace(/\r\n/g, "\n").trim();
  const fallbackInsertAfterLine = clampInsertAfterLine(
    cursorLine ?? lineCount(fileContent),
    fileContent,
  );

  if (!explanation) {
    throw new Error("Gemini returned an empty explanation.");
  }

  if (!code) {
    throw new Error("Gemini returned an empty code patch.");
  }

  return {
    explanation,
    code,
    insertAfterLine:
      mode === "optimize"
        ? fallbackInsertAfterLine
        : clampInsertAfterLine(
            typeof raw?.insertAfterLine === "number"
              ? raw.insertAfterLine
              : fallbackInsertAfterLine,
            fileContent,
          ),
    mode,
    applyMode: mode === "optimize" ? "replace" : "insert",
  };
}

function validateEditProposal(raw: any, file: WorkspaceFileNode): GeminiEditProposal {
  if (typeof raw?.explanation !== "string" || !Array.isArray(raw?.changes)) {
    throw new Error("Gemini returned an invalid edit proposal.");
  }

  const explanation = raw.explanation.trim();

  if (!explanation) {
    throw new Error("Gemini returned an empty explanation for the edit proposal.");
  }

  const changes = raw.changes
    .slice(0, MAX_AI_LINE_CHANGES)
    .map((change: any) => {
      const type = change?.type;

      if (
        type !== "insert" &&
        type !== "replace" &&
        type !== "delete"
      ) {
        throw new Error("Gemini returned an unsupported line change type.");
      }

      const oldText =
        typeof change?.oldText === "string" ? change.oldText.replace(/\r\n/g, "\n") : "";
      const newText =
        typeof change?.newText === "string" ? change.newText.replace(/\r\n/g, "\n") : "";
      const summary =
        typeof change?.summary === "string" ? change.summary.trim() : "";

      if (!summary) {
        throw new Error("Gemini returned a line change without a summary.");
      }

      return {
        type,
        lineNumber: clampLineNumber(
          typeof change?.lineNumber === "number" ? change.lineNumber : 1,
          file.content,
          type,
        ),
        oldText,
        newText,
        summary,
      } satisfies GeminiStructuredLineChange;
    })
    .filter((change: GeminiStructuredLineChange) => {
      if (change.type === "insert") {
        return change.newText.trim().length > 0;
      }

      if (change.type === "delete") {
        return change.oldText.trim().length > 0;
      }

      return (
        change.oldText.trim().length > 0 || change.newText.trim().length > 0
      );
    });

  if (changes.length === 0) {
    throw new Error("Gemini did not propose any concrete line changes.");
  }

  return {
    explanation,
    changes,
  };
}

async function requestGeminiJson({
  systemInstruction,
  requestText,
  responseJsonSchema,
}: {
  systemInstruction: string;
  requestText: string;
  responseJsonSchema: Record<string, unknown>;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set on the server.");
  }

  const response = await fetch(
    `${GEMINI_API_URL}/${encodeURIComponent(DEFAULT_GEMINI_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            parts: [{ text: requestText }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.error ??
      "Gemini returned an error while generating the suggestion.";
    throw new Error(message);
  }

  const rawText = extractTextFromGeminiResponse(payload);

  return JSON.parse(rawText);
}

export async function generateGeminiSuggestion({
  prompt,
  file,
  workspace,
  mode,
  cursorLine,
}: GenerateGeminiSuggestionOptions) {
  const rawSuggestion = await requestGeminiJson({
    systemInstruction: suggestionSystemInstruction(mode),
    requestText: suggestionRequest({
      prompt,
      file,
      workspace,
      mode,
      cursorLine,
    }),
    responseJsonSchema: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description:
            "Two to four concise sentences explaining the suggested change and why it helps the user while coding.",
        },
        code: {
          type: "string",
          description:
            "A raw code snippet to insert into the active file. Do not include markdown fences.",
        },
        insertAfterLine: {
          type: "integer",
          description:
            "The 1-based line number after which the code should be inserted. For whole-file rewrites, return the current cursor line or the nearest relevant line.",
        },
      },
      required: ["explanation", "code", "insertAfterLine"],
      additionalProperties: false,
    },
  });

  return validateSuggestion(rawSuggestion, file.content, mode, cursorLine);
}

export async function generateGeminiEditProposal({
  prompt,
  file,
  workspace,
}: GenerateGeminiEditProposalOptions) {
  const rawProposal = await requestGeminiJson({
    systemInstruction: editProposalSystemInstruction(),
    requestText: editProposalRequest({
      prompt,
      file,
      workspace,
    }),
    responseJsonSchema: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description:
            "A short explanation of the proposed file improvements and the editing strategy.",
        },
        changes: {
          type: "array",
          description:
            "A reviewable list of line edits for the active file.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["insert", "replace", "delete"],
              },
              lineNumber: {
                type: "integer",
              },
              oldText: {
                type: "string",
              },
              newText: {
                type: "string",
              },
              summary: {
                type: "string",
              },
            },
            required: ["type", "lineNumber", "oldText", "newText", "summary"],
            additionalProperties: false,
          },
        },
      },
      required: ["explanation", "changes"],
      additionalProperties: false,
    },
  });

  return validateEditProposal(rawProposal, file);
}
