import type { WorkspaceFileNode, WorkspaceState } from "../types.js";
import { listWorkspaceFiles } from "../workspace.js";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiSuggestion = {
  explanation: string;
  code: string;
  insertAfterLine: number;
};

type GenerateGeminiSuggestionOptions = {
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

function clampInsertAfterLine(insertAfterLine: number, fileContent: string) {
  const totalLines = Math.max(1, fileContent.replace(/\r\n/g, "\n").split("\n").length);
  return Math.min(Math.max(1, Math.trunc(insertAfterLine)), totalLines);
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

function validateSuggestion(raw: any, fileContent: string): GeminiSuggestion {
  if (
    typeof raw?.explanation !== "string" ||
    typeof raw?.code !== "string" ||
    typeof raw?.insertAfterLine !== "number"
  ) {
    throw new Error("Gemini returned an invalid structured suggestion.");
  }

  const explanation = raw.explanation.trim();
  const code = raw.code.replace(/\r\n/g, "\n").trim();

  if (!explanation) {
    throw new Error("Gemini returned an empty explanation.");
  }

  if (!code) {
    throw new Error("Gemini returned an empty code patch.");
  }

  return {
    explanation,
    code,
    insertAfterLine: clampInsertAfterLine(raw.insertAfterLine, fileContent),
  };
}

export async function generateGeminiSuggestion({
  prompt,
  file,
  workspace,
}: GenerateGeminiSuggestionOptions) {
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
          parts: [
            {
              text:
                "You are a senior software engineer assisting inside a collaborative browser IDE. Generate one small, practical code suggestion for the active file. Return only valid JSON matching the schema. The code must be raw source code without markdown fences.",
            },
          ],
        },
        contents: [
          {
            parts: [
              {
                text: [
                  `User request: ${prompt.trim() || "Suggest a practical next improvement for this file."}`,
                  `Active file: ${file.path}`,
                  `Language: ${file.language}`,
                  "Workspace files:",
                  workspaceSummary(workspace, file.id),
                  "Active file contents with 1-based line numbers:",
                  lineNumberedContent(file.content),
                  "Return a minimal code patch that can be inserted into the active file.",
                ].join("\n\n"),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
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
                  "The 1-based line number after which the code should be inserted.",
              },
            },
            required: ["explanation", "code", "insertAfterLine"],
            additionalProperties: false,
          },
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
  const rawSuggestion = JSON.parse(rawText);

  return validateSuggestion(rawSuggestion, file.content);
}
