"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AiEditLineChange,
  AiEditProposal,
  ChatMessage,
  WorkspaceFileNode,
} from "@/lib/socket";

type PrivateAiChatPanelProps = {
  activeFile: WorkspaceFileNode | null;
  messages: ChatMessage[];
  proposals: AiEditProposal[];
  isLoading: boolean;
  errorMessage?: string | null;
  canSend: boolean;
  currentUserId: string;
  selectionSummary?: string | null;
  hasSelection: boolean;
  onSendPrompt: (content: string) => void;
  onExplainSelection: () => void;
  onGenerateFunction: () => void;
  onRefactorSelection: () => void;
  onFixBugs: () => void;
  onAddComments: () => void;
  onSummarizeProject: () => void;
  onGenerateFilesFromPrompt: (prompt: string) => void;
  onGenerateFlaskStarter: () => void;
  onGenerateCppStarter: () => void;
  onGenerateLandingPageStarter: () => void;
  onApproveLine: (proposalId: string, changeId: string) => void;
  onRejectLine: (proposalId: string, changeId: string) => void;
  onApplyProposal: (proposalId: string) => void;
};

const QUICK_PROMPTS = [
  "Continue the current function with the most likely next step.",
  "Refactor this file for readability and maintainability without changing behavior.",
  "Fix the most obvious issues in this file with the smallest safe changes.",
];

const STARTER_PROMPTS = [
  {
    id: "flask",
    label: "Flask Starter",
    description: "Create a small Flask starter project with routes, templates, and dependencies.",
  },
  {
    id: "cpp-console",
    label: "C++ Console App",
    description: "Create a minimal C++ console application with a clean project structure.",
  },
  {
    id: "landing-page",
    label: "Static Landing Page",
    description: "Create a static HTML/CSS/JS landing page starter for demos.",
  },
] as const;

function QuickActionButton({
  label,
  description,
  disabled = false,
  onClick,
}: {
  label: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border border-[var(--line)] bg-[var(--bg-panel-soft)] p-3 text-left transition hover:border-[var(--line-strong)] hover:bg-[var(--editor-tab-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
        {description}
      </p>
    </button>
  );
}

function formatMessageTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function changeStatusClasses(status: AiEditLineChange["status"]) {
  if (status === "approved") {
    return "border-emerald-400/18 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "rejected") {
    return "border-rose-400/18 bg-rose-400/10 text-rose-200";
  }

  return "border-[var(--line)] bg-[var(--bg-panel)] text-[var(--text-secondary)]";
}

function proposalStatusLabel(status: AiEditProposal["status"]) {
  if (status === "applied") {
    return "Applied";
  }

  if (status === "discarded") {
    return "Discarded";
  }

  return "Pending Review";
}

function changeLabel(change: AiEditLineChange) {
  if (change.type === "insert") {
    return `Insert before line ${change.lineNumber}`;
  }

  if (change.type === "delete") {
    return `Delete line ${change.lineNumber}`;
  }

  return `Replace line ${change.lineNumber}`;
}

function MessageCard({
  message,
  currentUserId,
}: {
  message: ChatMessage;
  currentUserId: string;
}) {
  const isCurrentUser = message.userId === currentUserId;
  const toneClasses =
    message.authorType === "system"
      ? "border-amber-400/18 bg-amber-400/10 text-amber-100"
      : message.authorType === "ai"
        ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
        : isCurrentUser
          ? "border-sky-400/16 bg-sky-400/10 text-sky-100"
          : "border-[var(--line)] bg-[var(--bg-panel)] text-[var(--text-secondary)]";

  return (
    <article className={`border p-3 ${toneClasses}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[var(--text-primary)]">
          {message.authorName}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
        {message.content}
      </p>
    </article>
  );
}

function CodeFrame({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </p>
      <pre className="overflow-x-auto border border-[var(--line)] bg-[var(--editor-shell)] px-3 py-2 font-mono text-[12px] leading-6 text-[var(--text-primary)]">
        {value.length > 0 ? value : "<empty>"}
      </pre>
    </div>
  );
}

function ProposalCard({
  proposal,
  onApproveLine,
  onRejectLine,
  onApplyProposal,
}: {
  proposal: AiEditProposal;
  onApproveLine: (proposalId: string, changeId: string) => void;
  onRejectLine: (proposalId: string, changeId: string) => void;
  onApplyProposal: (proposalId: string) => void;
}) {
  const approvedCount = proposal.changes.filter(
    (change) => change.status === "approved",
  ).length;
  const isPending = proposal.status === "pending";

  return (
    <article className="border border-[var(--line)] bg-[var(--bg-panel)]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Private AI Proposal
            </p>
            <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {proposal.filePath}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {proposalStatusLabel(proposal.status)}
            </span>
            <span className="border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent)]">
              {approvedCount}/{proposal.changes.length} approved
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          {proposal.explanation}
        </p>
      </div>

      <div className="space-y-3 p-4">
        {proposal.changes.map((change) => (
          <section
            key={change.id}
            className={`border p-3 ${changeStatusClasses(change.status)}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {changeLabel(change)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  {change.summary}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isPending}
                  onClick={() => onApproveLine(proposal.id, change.id)}
                  className="border border-emerald-400/18 bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-200 transition hover:border-emerald-400/28 hover:bg-emerald-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={!isPending}
                  onClick={() => onRejectLine(proposal.id, change.id)}
                  className="border border-rose-400/18 bg-rose-400/10 px-2 py-1 text-xs font-medium text-rose-200 transition hover:border-rose-400/28 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {change.type !== "insert" ? (
                <CodeFrame label="Current line" value={change.oldText} />
              ) : null}
              {change.type !== "delete" ? (
                <CodeFrame
                  label={change.type === "insert" ? "Inserted code" : "Replacement"}
                  value={change.newText}
                />
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <div className="border-t border-[var(--line)] bg-[var(--bg-panel-soft)] px-4 py-3">
        <button
          type="button"
          disabled={!isPending || approvedCount === 0}
          onClick={() => onApplyProposal(proposal.id)}
          className="h-9 border border-[var(--accent-line)] bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-contrast)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
        >
          Apply Approved Changes
        </button>
      </div>
    </article>
  );
}

export function PrivateAiChatPanel({
  activeFile,
  messages,
  proposals,
  isLoading,
  errorMessage,
  canSend,
  currentUserId,
  selectionSummary,
  hasSelection,
  onSendPrompt,
  onExplainSelection,
  onGenerateFunction,
  onRefactorSelection,
  onFixBugs,
  onAddComments,
  onSummarizeProject,
  onGenerateFilesFromPrompt,
  onGenerateFlaskStarter,
  onGenerateCppStarter,
  onGenerateLandingPageStarter,
  onApproveLine,
  onRejectLine,
  onApplyProposal,
}: PrivateAiChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [fileGenerationPrompt, setFileGenerationPrompt] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, proposals, isLoading]);

  const activeProposal = useMemo(
    () => proposals.find((proposal) => proposal.status === "pending") ?? proposals[0] ?? null,
    [proposals],
  );

  function submitPrompt(content: string) {
    const nextContent = content.trim();

    if (!nextContent || !canSend || !activeFile) {
      return;
    }

    onSendPrompt(nextContent);
    setDraft("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(draft);
  }

  function handleGenerateFiles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = fileGenerationPrompt.trim();

    if (!prompt || !canSend) {
      return;
    }

    onGenerateFilesFromPrompt(prompt);
    setFileGenerationPrompt("");
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
      <div className="border-b border-[var(--line)] px-3 py-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">
          Private AI Editing
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">
          Only you see this thread. Gemini replies stream live here, stay saved in your private history, and can still produce explicit line-by-line edits that you approve before anything changes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {activeFile ? activeFile.path : "Open a file first"}
          </span>
          {activeProposal ? (
            <span className="border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent)]">
              Proposal ready
            </span>
          ) : null}
          {selectionSummary ? (
            <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {selectionSummary}
            </span>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3"
      >
        <section className="border border-[var(--line)] bg-[var(--bg-panel)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                AI Code Assistant
              </p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                Selection-aware editing actions
              </h3>
            </div>
            <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {hasSelection ? "Selection ready" : "Whole file fallback"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <QuickActionButton
              label="Explain Selected Code"
              description="Get a concise plain-language explanation of the selected code or current file."
              disabled={!canSend || !activeFile}
              onClick={onExplainSelection}
            />
            <QuickActionButton
              label="Generate New Function"
              description="Draft a new function that fits the current file and code context."
              disabled={!canSend || !activeFile}
              onClick={onGenerateFunction}
            />
            <QuickActionButton
              label="Refactor Selected Code"
              description="Turn the selection into explicit reviewable edits for readability and maintainability."
              disabled={!canSend || !activeFile}
              onClick={onRefactorSelection}
            />
            <QuickActionButton
              label="Identify And Fix Bugs"
              description="Ask Gemini to find the most likely issues and propose focused line changes."
              disabled={!canSend || !activeFile}
              onClick={onFixBugs}
            />
            <QuickActionButton
              label="Add Explanatory Comments"
              description="Insert comments where the code is difficult to understand without over-commenting."
              disabled={!canSend || !activeFile}
              onClick={onAddComments}
            />
            <QuickActionButton
              label="Summarize project"
              description="Overview of main files and how they work together across the workspace."
              disabled={!canSend}
              onClick={onSummarizeProject}
            />
          </div>
        </section>

        <section className="border border-[var(--line)] bg-[var(--bg-panel)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                AI File Generator
              </p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                Create files and project starters
              </h3>
            </div>
            <span className="border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent)]">
              Shared workspace
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {STARTER_PROMPTS.map((starter) => (
              <QuickActionButton
                key={starter.id}
                label={starter.label}
                description={starter.description}
                disabled={!canSend}
                onClick={() => {
                  if (starter.id === "flask") {
                    onGenerateFlaskStarter();
                    return;
                  }

                  if (starter.id === "cpp-console") {
                    onGenerateCppStarter();
                    return;
                  }

                  onGenerateLandingPageStarter();
                }}
              />
            ))}
          </div>

          <form className="mt-4 space-y-3" onSubmit={handleGenerateFiles}>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Create files from a natural-language prompt
              </span>
              <textarea
                value={fileGenerationPrompt}
                onChange={(event) => setFileGenerationPrompt(event.target.value)}
                rows={3}
                disabled={!canSend}
                placeholder="Create a README and unit test starter for the current file."
                className="mt-2 min-h-[88px] w-full resize-none border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-line)]"
              />
            </label>
            <button
              type="submit"
              disabled={!canSend || fileGenerationPrompt.trim().length === 0}
              className="h-10 border border-[var(--accent-line)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-contrast)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
            >
              Generate Files
            </button>
          </form>
        </section>

        {errorMessage ? (
          <div className="border border-rose-400/18 bg-rose-400/10 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rose-200">
              AI Request Failed
            </p>
            <p className="mt-2 text-sm leading-6 text-rose-100">{errorMessage}</p>
          </div>
        ) : null}

        {messages.length === 0 && !isLoading ? (
          <div className="border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel-soft)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Private AI Thread Is Empty
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Ask for a fix, refactor, optimization, or continuation. Gemini will answer here and generate a reviewable proposal for the active file.
            </p>
          </div>
        ) : null}

        {messages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            currentUserId={currentUserId}
          />
        ))}

        {isLoading ? (
          <div className="border border-[var(--accent-line)] bg-[var(--accent-soft)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
              Gemini is preparing line-level edits
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Reading the latest file snapshot and turning your request into explicit reviewable changes.
            </p>
          </div>
        ) : null}

        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onApproveLine={onApproveLine}
            onRejectLine={onRejectLine}
            onApplyProposal={onApplyProposal}
          />
        ))}
      </div>

      <div className="border-t border-[var(--line)] bg-[var(--bg-panel)] p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={!canSend || !activeFile}
              onClick={() => submitPrompt(prompt)}
              className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {prompt}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              disabled={!canSend || !activeFile}
              placeholder={
                activeFile
                  ? `Ask Gemini to modify ${activeFile.name}...`
                  : "Open a file to start a private AI editing request."
              }
              className="min-h-[96px] flex-1 resize-none border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-line)]"
            />
            <button
              type="submit"
              disabled={!canSend || !activeFile || draft.trim().length === 0}
              className="h-10 border border-[var(--accent-line)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-contrast)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
