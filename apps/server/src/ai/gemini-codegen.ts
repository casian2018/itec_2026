import type {
  AiSelectionContext,
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
const MAX_GENERATED_WORKSPACE_FILES = 12;
const NEXT_LINE_MAX_EDIT_CHANGES = 4;

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
  mode?: AiSuggestionMode;
  cursorLine?: number | null;
  selection?: AiSelectionContext | null;
};

type GenerateGeminiExplanationOptions = {
  prompt: string;
  file: WorkspaceFileNode;
  workspace: WorkspaceState;
  selection?: AiSelectionContext | null;
};

type StreamGeminiChatReplyOptions = {
  prompt: string;
  workspace: WorkspaceState;
  file?: WorkspaceFileNode | null;
  mode?: AiSuggestionMode;
  cursorLine?: number | null;
  selection?: AiSelectionContext | null;
  onPartialText: (text: string) => void;
};

type GeminiWorkspaceFileSeed = {
  path: string;
  content: string;
};

type GeminiWorkspaceGeneration = {
  explanation: string;
  files: GeminiWorkspaceFileSeed[];
};

type GenerateGeminiWorkspaceGenerationOptions = {
  prompt: string;
  workspace: WorkspaceState;
  file?: WorkspaceFileNode | null;
  selection?: AiSelectionContext | null;
};

type GeminiExecutionErrorExplanation = {
  explanation: string;
  suggestedFix: string;
};

type GenerateGeminiExecutionErrorExplanationOptions = {
  file: WorkspaceFileNode;
  workspace: WorkspaceState;
  stderr: string;
  stdout?: string;
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

function summarizeSelection(selection?: AiSelectionContext | null) {
  if (!selection || !selection.selectedText.trim()) {
    return "No editor selection was provided. Use the full file context.";
  }

  return [
    `Selection lines: ${selection.startLineNumber}-${selection.endLineNumber}`,
    "Selected code:",
    selection.selectedText.replace(/\r\n/g, "\n"),
  ].join("\n");
}

function summarizeCursorFocus(
  fileContent: string,
  cursorLine?: number | null,
  radius = 8,
) {
  const normalizedCursorLine =
    typeof cursorLine === "number" && Number.isInteger(cursorLine) && cursorLine > 0
      ? cursorLine
      : null;

  if (!normalizedCursorLine) {
    return "No explicit cursor line was provided.";
  }

  const clampedCursorLine = clampInsertAfterLine(normalizedCursorLine, fileContent);

  return [
    `Cursor line: ${clampedCursorLine}`,
    "Focused window around the cursor:",
    contentWindowAroundLine(fileContent, clampedCursorLine, radius),
  ].join("\n");
}

function focusRangeWindow(
  content: string,
  startLine: number,
  endLine: number,
  radius = 4,
) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const clampedStart = Math.min(
    Math.max(1, Math.trunc(startLine)),
    Math.max(1, lines.length),
  );
  const clampedEnd = Math.min(
    Math.max(clampedStart, Math.trunc(endLine)),
    Math.max(1, lines.length),
  );
  const startIndex = Math.max(0, clampedStart - 1 - radius);
  const endIndex = Math.min(lines.length, clampedEnd + radius);

  return lines
    .slice(startIndex, endIndex)
    .map((line, index) => `${startIndex + index + 1}: ${line}`)
    .join("\n");
}

function summarizeEditFocus({
  file,
  selection,
  cursorLine,
}: {
  file: WorkspaceFileNode;
  selection?: AiSelectionContext | null;
  cursorLine?: number | null;
}) {
  if (selection?.selectedText.trim()) {
    return [
      summarizeSelection(selection),
      "Focused file window around the selection:",
      focusRangeWindow(
        file.content,
        selection.startLineNumber,
        selection.endLineNumber,
      ),
      "Keep edits inside the selection unless the request clearly requires a tiny adjacent change.",
    ].join("\n\n");
  }

  return summarizeCursorFocus(file.content, cursorLine);
}

function suggestionSystemInstruction(mode: AiSuggestionMode) {
  if (mode === "next-line") {
    return [
      "You are a senior software engineer assisting inside a collaborative browser IDE.",
      "Behave like an inline completion model similar to GitHub Copilot.",
      "Generate a likely next-line or short next-step continuation for the active file at the user's current cursor location.",
      "Keep the suggestion local, syntactically valid, and short enough to be reviewed quickly.",
      "Match the existing indentation, naming, APIs, and surrounding code style.",
      "Do not repeat surrounding lines or rewrite unrelated code.",
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
    "Behave like a cautious Copilot-style editing assistant.",
    "Generate one small, practical code suggestion for the active file.",
    "Prefer a single local improvement over a broad rewrite.",
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
      "Behave like a local inline completion. Continue from the cursor without rewriting unrelated code.",
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

function editProposalSystemInstruction(mode: AiSuggestionMode) {
  const maxChanges =
    mode === "next-line" ? NEXT_LINE_MAX_EDIT_CHANGES : MAX_AI_LINE_CHANGES;
  const instructions = [
    "You are a senior software engineer working inside a collaborative browser IDE.",
    "Return a compact, reviewable set of line-by-line file edits for the active file.",
    "The user must explicitly approve each change before anything is saved.",
    "Prefer the minimum number of changes needed to satisfy the request.",
    `Return at most ${maxChanges} changes.`,
    "Each change must be one of: insert, replace, delete.",
    "Do not return markdown fences or prose outside JSON.",
  ];

  if (mode === "next-line") {
    instructions.push(
      "Behave like an inline completion model similar to GitHub Copilot.",
      "Prefer one small insertion or replacement near the cursor over scattered edits.",
      "Do not rewrite imports, file headers, or distant functions unless the request explicitly requires it.",
    );
  } else if (mode === "optimize") {
    instructions.push(
      "Behave like a cautious optimization assistant.",
      "Preserve behavior and favor a compact diff over broad refactors.",
    );
  } else {
    instructions.push(
      "Behave like a Copilot-style editing assistant.",
      "Favor a single contiguous local edit over multiple distant edits.",
    );
  }

  return instructions.join(" ");
}

function editProposalRequest({
  prompt,
  file,
  workspace,
  mode = "assist",
  cursorLine,
  selection,
}: GenerateGeminiEditProposalOptions) {
  const focusSummary = summarizeEditFocus({
    file,
    selection,
    cursorLine,
  });
  const modeGuidance =
    mode === "next-line"
      ? [
          "Assistant mode: next-line",
          "Goal: produce the smallest useful continuation at the cursor.",
          "Prefer a single insert at or just after the cursor line. Avoid unrelated edits.",
        ].join("\n")
      : mode === "optimize"
        ? [
            "Assistant mode: optimize",
            "Goal: improve readability, structure, and obvious correctness issues with a minimal diff.",
          ].join("\n")
        : [
            "Assistant mode: assist",
            "Goal: act like Copilot Chat editing. Keep the diff local unless the prompt clearly requires otherwise.",
          ].join("\n");

  return [
    `Developer request: ${prompt.trim()}`,
    `Active file: ${file.path}`,
    `Language: ${file.language}`,
    modeGuidance,
    "Workspace files:",
    workspaceSummary(workspace, file.id),
    focusSummary,
    "Active file contents with 1-based line numbers:",
    lineNumberedContent(file.content),
    "Generate reviewable line edits, not a full rewritten file.",
    "Use insert with lineNumber = totalLines + 1 only when appending to the end of the file.",
    "For replace/delete, keep oldText aligned with the current file content at that line.",
    "Match the surrounding formatting and naming style.",
    "Summaries should be short and specific.",
  ].join("\n\n");
}

function explanationSystemInstruction() {
  return [
    "You are a senior software engineer inside a collaborative browser IDE.",
    "Explain code clearly for a developer.",
    "Be concise, practical, and specific to the selected code or active file.",
    "When useful, mention bugs, intent, tradeoffs, and the next safe change.",
    "Return plain text only. No markdown fences.",
  ].join(" ");
}

function explanationRequest({
  prompt,
  file,
  workspace,
  selection,
}: GenerateGeminiExplanationOptions) {
  return [
    `Developer request: ${prompt.trim()}`,
    `Active file: ${file.path}`,
    `Language: ${file.language}`,
    "Workspace files:",
    workspaceSummary(workspace, file.id),
    summarizeSelection(selection),
    "Relevant file contents with 1-based line numbers:",
    selection?.selectedText?.trim()
      ? lineNumberedContent(selection.selectedText)
      : lineNumberedContent(file.content),
    "Respond in plain language for a developer using the IDE.",
  ].join("\n\n");
}

function chatReplySystemInstruction(mode?: AiSuggestionMode) {
  const instructions = [
    "You are Gemini inside a collaborative browser IDE.",
    "Reply like a strong senior engineer working live with the developer.",
    "Be direct, practical, and concise.",
    "If the user asks for code changes, explain the exact approach and likely edits before implementation happens.",
    "If there is file context, stay grounded in that file and the current workspace.",
    "Return plain text only. No markdown fences.",
  ];

  if (mode === "next-line") {
    instructions.push(
      "For continuation requests, answer like Copilot Chat: brief, local, and focused on the next few lines near the cursor.",
    );
  }

  return instructions.join(" ");
}

function chatReplyRequest({
  prompt,
  workspace,
  file,
  mode,
  cursorLine,
  selection,
}: Omit<StreamGeminiChatReplyOptions, "onPartialText">) {
  return [
    `Developer request: ${prompt.trim()}`,
    `Assistant mode: ${mode ?? "assist"}`,
    file
      ? `Current file: ${file.path} (${file.language})`
      : "Current file: none",
    "Workspace files:",
    workspaceSummary(workspace, file?.id ?? workspace.activeFileId),
    file
      ? summarizeEditFocus({
          file,
          selection,
          cursorLine,
        })
      : summarizeSelection(selection),
    file
      ? "Current file contents with 1-based line numbers:\n" +
        lineNumberedContent(file.content)
      : "No active file contents were provided.",
    "Answer in a way that can be shown live in a collaborative chat thread.",
  ].join("\n\n");
}

function workspaceGenerationSystemInstruction() {
  return [
    "You are a senior software engineer inside a collaborative browser IDE.",
    "Generate a small, runnable, hackathon-friendly project or supporting file set.",
    `Return at most ${MAX_GENERATED_WORKSPACE_FILES} text files.`,
    "Prefer conventional filenames and simple folder structures.",
    "Do not return binary assets.",
    "Return only valid JSON matching the schema.",
  ].join(" ");
}

function workspaceGenerationRequest({
  prompt,
  workspace,
  file,
  selection,
}: GenerateGeminiWorkspaceGenerationOptions) {
  return [
    `Developer request: ${prompt.trim()}`,
    file
      ? `Current file context: ${file.path} (${file.language})`
      : "Current file context: none",
    "Workspace files:",
    workspaceSummary(workspace, file?.id ?? workspace.activeFileId),
    summarizeSelection(selection),
    file
      ? "Current file contents with 1-based line numbers:\n" +
        lineNumberedContent(file.content)
      : "The workspace may be empty. Generate the minimum file set needed.",
    "If the request is for README, tests, documentation, or starter files, create or update the relevant files directly in the files array.",
  ].join("\n\n");
}

function executionErrorSystemInstruction() {
  return [
    "You are a senior software engineer helping explain a failed code run in a browser IDE.",
    "Summarize the error in plain language and suggest one practical next fix.",
    "Be concise and specific to the stderr or compiler output.",
    "Return only valid JSON matching the schema.",
  ].join(" ");
}

function executionErrorRequest({
  file,
  workspace,
  stderr,
  stdout,
}: GenerateGeminiExecutionErrorExplanationOptions) {
  return [
    `Failed file: ${file.path}`,
    `Language: ${file.language}`,
    "Workspace files:",
    workspaceSummary(workspace, file.id),
    "File contents:",
    lineNumberedContent(file.content),
    "stderr:",
    stderr.trim() || "<empty>",
    "stdout:",
    stdout?.trim() || "<empty>",
    "Explain the failure and suggest the most likely next fix.",
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

function extractStreamingTextFromGeminiResponse(payload: any) {
  const parts = payload?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("");
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

function validateEditProposal(
  raw: any,
  file: WorkspaceFileNode,
  mode: AiSuggestionMode,
): GeminiEditProposal {
  if (typeof raw?.explanation !== "string" || !Array.isArray(raw?.changes)) {
    throw new Error("Gemini returned an invalid edit proposal.");
  }

  const explanation = raw.explanation.trim();

  if (!explanation) {
    throw new Error("Gemini returned an empty explanation for the edit proposal.");
  }

  const changes = raw.changes
    .slice(0, mode === "next-line" ? NEXT_LINE_MAX_EDIT_CHANGES : MAX_AI_LINE_CHANGES)
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

async function requestGeminiText({
  systemInstruction,
  requestText,
}: {
  systemInstruction: string;
  requestText: string;
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
      "Gemini returned an error while generating the response.";
    throw new Error(message);
  }

  return extractTextFromGeminiResponse(payload);
}

async function requestGeminiTextStream({
  systemInstruction,
  requestText,
  onPartialText,
}: {
  systemInstruction: string;
  requestText: string;
  onPartialText: (text: string) => void;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set on the server.");
  }

  const response = await fetch(
    `${GEMINI_API_URL}/${encodeURIComponent(DEFAULT_GEMINI_MODEL)}:streamGenerateContent?alt=sse`,
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
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.error?.message ??
      payload?.error ??
      "Gemini returned an error while streaming the response.";
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Gemini did not return a readable stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventLines: string[] = [];
  let fullText = "";

  const flushEvent = () => {
    if (eventLines.length === 0) {
      return;
    }

    const eventData = eventLines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();

    eventLines = [];

    if (!eventData || eventData === "[DONE]") {
      return;
    }

    const payload = JSON.parse(eventData);
    const message =
      payload?.error?.message ??
      payload?.error ??
      null;

    if (message) {
      throw new Error(String(message));
    }

    const textChunk = extractStreamingTextFromGeminiResponse(payload);

    if (!textChunk) {
      return;
    }

    if (textChunk.startsWith(fullText)) {
      fullText = textChunk;
    } else if (!fullText.endsWith(textChunk)) {
      fullText += textChunk;
    }

    onPartialText(fullText);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const rawLine = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const line = rawLine.replace(/\r$/, "");

      if (line.length === 0) {
        flushEvent();
      } else {
        eventLines.push(line);
      }

      newlineIndex = buffer.indexOf("\n");
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim().length > 0) {
    eventLines.push(buffer.replace(/\r$/, ""));
  }

  flushEvent();

  const normalizedText = fullText.trim();

  if (!normalizedText) {
    throw new Error("Gemini returned an empty response.");
  }

  return normalizedText;
}

function sanitizeGeneratedWorkspacePath(path: string) {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").trim();

  if (!normalized || normalized.includes("..")) {
    return null;
  }

  return normalized;
}

function validateWorkspaceGeneration(raw: any): GeminiWorkspaceGeneration {
  if (typeof raw?.explanation !== "string" || !Array.isArray(raw?.files)) {
    throw new Error("Gemini returned an invalid workspace generation response.");
  }

  const explanation = raw.explanation.trim();

  if (!explanation) {
    throw new Error("Gemini returned an empty explanation for the generated files.");
  }

  const files = raw.files
    .slice(0, MAX_GENERATED_WORKSPACE_FILES)
    .map((entry: any) => {
      const path = typeof entry?.path === "string" ? sanitizeGeneratedWorkspacePath(entry.path) : null;
      const content =
        typeof entry?.content === "string"
          ? entry.content.replace(/\r\n/g, "\n")
          : "";

      if (!path || !content.trim()) {
        return null;
      }

      return {
        path,
        content,
      } satisfies GeminiWorkspaceFileSeed;
    })
    .filter((entry: GeminiWorkspaceFileSeed | null): entry is GeminiWorkspaceFileSeed => Boolean(entry));

  if (files.length === 0) {
    throw new Error("Gemini did not generate any usable files.");
  }

  return {
    explanation,
    files,
  };
}

function validateExecutionErrorExplanation(raw: any): GeminiExecutionErrorExplanation {
  if (
    typeof raw?.explanation !== "string" ||
    typeof raw?.suggestedFix !== "string"
  ) {
    throw new Error("Gemini returned an invalid execution error explanation.");
  }

  const explanation = raw.explanation.trim();
  const suggestedFix = raw.suggestedFix.trim();

  if (!explanation || !suggestedFix) {
    throw new Error("Gemini returned an empty execution error explanation.");
  }

  return {
    explanation,
    suggestedFix,
  };
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
  mode = "assist",
  cursorLine,
  selection,
}: GenerateGeminiEditProposalOptions) {
  const rawProposal = await requestGeminiJson({
    systemInstruction: editProposalSystemInstruction(mode),
    requestText: editProposalRequest({
      prompt,
      file,
      workspace,
      mode,
      cursorLine,
      selection,
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

  return validateEditProposal(rawProposal, file, mode);
}

export async function generateGeminiExplanation({
  prompt,
  file,
  workspace,
  selection,
}: GenerateGeminiExplanationOptions) {
  return requestGeminiText({
    systemInstruction: explanationSystemInstruction(),
    requestText: explanationRequest({
      prompt,
      file,
      workspace,
      selection,
    }),
  });
}

export async function streamGeminiChatReply({
  prompt,
  workspace,
  file,
  mode,
  cursorLine,
  selection,
  onPartialText,
}: StreamGeminiChatReplyOptions) {
  return requestGeminiTextStream({
    systemInstruction: chatReplySystemInstruction(mode),
    requestText: chatReplyRequest({
      prompt,
      workspace,
      file,
      mode,
      cursorLine,
      selection,
    }),
    onPartialText,
  });
}

export const geminiCodegenTesting = {
  editProposalSystemInstruction,
  editProposalRequest,
  suggestionSystemInstruction,
  suggestionRequest,
  chatReplyRequest,
};

export async function generateGeminiWorkspaceGeneration({
  prompt,
  workspace,
  file,
  selection,
}: GenerateGeminiWorkspaceGenerationOptions) {
  const rawGeneration = await requestGeminiJson({
    systemInstruction: workspaceGenerationSystemInstruction(),
    requestText: workspaceGenerationRequest({
      prompt,
      workspace,
      file,
      selection,
    }),
    responseJsonSchema: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
        },
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
            additionalProperties: false,
          },
        },
      },
      required: ["explanation", "files"],
      additionalProperties: false,
    },
  });

  return validateWorkspaceGeneration(rawGeneration);
}

export async function generateGeminiExecutionErrorExplanation({
  file,
  workspace,
  stderr,
  stdout,
}: GenerateGeminiExecutionErrorExplanationOptions) {
  const rawExplanation = await requestGeminiJson({
    systemInstruction: executionErrorSystemInstruction(),
    requestText: executionErrorRequest({
      file,
      workspace,
      stderr,
      stdout,
    }),
    responseJsonSchema: {
      type: "object",
      properties: {
        explanation: {
          type: "string",
        },
        suggestedFix: {
          type: "string",
        },
      },
      required: ["explanation", "suggestedFix"],
      additionalProperties: false,
    },
  });

  return validateExecutionErrorExplanation(rawExplanation);
}
