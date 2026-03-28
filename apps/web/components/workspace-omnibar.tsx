"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type WorkspaceOmnibarMode = "quick-open" | "search" | "command";

export type WorkspaceOmnibarFileItem = {
  id: string;
  fileId: string;
  title: string;
  subtitle: string;
  icon: string;
  badge?: string;
};

export type WorkspaceOmnibarContentItem = {
  id: string;
  fileId: string;
  title: string;
  subtitle: string;
  icon: string;
  lineNumber: number;
  lineText: string;
};

export type WorkspaceOmnibarCommandItem = {
  id: string;
  title: string;
  subtitle: string;
  icon?: string;
  badge?: string;
  shortcut?: string;
  disabled?: boolean;
};

export type WorkspaceCommandPrompt = {
  commandId: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  submitLabel: string;
};

type WorkspaceOmnibarProps = {
  isOpen: boolean;
  mode: WorkspaceOmnibarMode;
  query: string;
  quickOpenItems: WorkspaceOmnibarFileItem[];
  fileSearchItems: WorkspaceOmnibarFileItem[];
  contentSearchItems: WorkspaceOmnibarContentItem[];
  commandItems: WorkspaceOmnibarCommandItem[];
  commandPrompt: WorkspaceCommandPrompt | null;
  onClose: () => void;
  onModeChange: (mode: WorkspaceOmnibarMode) => void;
  onQueryChange: (value: string) => void;
  onSelectQuickOpen: (fileId: string) => void;
  onSelectSearch: (fileId: string, lineNumber?: number) => void;
  onSelectCommand: (commandId: string) => void;
  onSubmitCommandPrompt: (value: string) => void;
  onCancelCommandPrompt: () => void;
};

type SelectableItem =
  | { kind: "quick-open"; item: WorkspaceOmnibarFileItem }
  | { kind: "search-file"; item: WorkspaceOmnibarFileItem }
  | { kind: "search-content"; item: WorkspaceOmnibarContentItem }
  | { kind: "command"; item: WorkspaceOmnibarCommandItem };

function modeLabel(mode: WorkspaceOmnibarMode) {
  if (mode === "quick-open") {
    return "Quick Open";
  }

  if (mode === "search") {
    return "Workspace Search";
  }

  return "Command Palette";
}

function modePlaceholder(mode: WorkspaceOmnibarMode) {
  if (mode === "quick-open") {
    return "Search files by name or path";
  }

  if (mode === "search") {
    return "Search filenames and file contents";
  }

  return "Run a command";
}

function ModeButton({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-2 border px-2.5 text-xs transition ${
        active
          ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--line)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)] hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {hint}
      </span>
    </button>
  );
}

function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="border border-dashed border-[var(--line-strong)] bg-[var(--bg-panel-soft)] px-4 py-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {title}
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

function CommandPromptCard({
  commandPrompt,
  onSubmit,
  onCancel,
}: {
  commandPrompt: WorkspaceCommandPrompt;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(commandPrompt.defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValue(commandPrompt.defaultValue);
  }, [commandPrompt]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [commandPrompt]);

  return (
    <div className="space-y-4">
      <div className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {commandPrompt.title}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          {commandPrompt.description}
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value);
        }}
      >
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {commandPrompt.label}
          </span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={commandPrompt.placeholder}
            className="mt-2 h-11 w-full border border-[var(--line)] bg-[var(--editor-tab-hover-bg)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
          />
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-9 border border-[var(--accent-line)] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-contrast)] transition hover:brightness-110"
          >
            {commandPrompt.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export function WorkspaceOmnibar({
  isOpen,
  mode,
  query,
  quickOpenItems,
  fileSearchItems,
  contentSearchItems,
  commandItems,
  commandPrompt,
  onClose,
  onModeChange,
  onQueryChange,
  onSelectQuickOpen,
  onSelectSearch,
  onSelectCommand,
  onSubmitCommandPrompt,
  onCancelCommandPrompt,
}: WorkspaceOmnibarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectableItems = useMemo<SelectableItem[]>(() => {
    if (mode === "quick-open") {
      return quickOpenItems.map((item) => ({ kind: "quick-open", item }));
    }

    if (mode === "search") {
      return [
        ...fileSearchItems.map((item) => ({ kind: "search-file" as const, item })),
        ...contentSearchItems.map((item) => ({
          kind: "search-content" as const,
          item,
        })),
      ];
    }

    return commandItems
      .filter((item) => !item.disabled)
      .map((item) => ({ kind: "command" as const, item }));
  }, [commandItems, contentSearchItems, fileSearchItems, mode, quickOpenItems]);
  const activeSelectedIndex = Math.min(
    selectedIndex,
    Math.max(selectableItems.length - 1, 0),
  );

  useEffect(() => {
    if (!isOpen || commandPrompt) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [commandPrompt, isOpen, mode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();

        if (commandPrompt) {
          onCancelCommandPrompt();
          return;
        }

        onClose();
        return;
      }

      if (commandPrompt) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((currentIndex) =>
          selectableItems.length === 0
            ? 0
            : (currentIndex + 1) % selectableItems.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((currentIndex) =>
          selectableItems.length === 0
            ? 0
            : (currentIndex - 1 + selectableItems.length) % selectableItems.length,
        );
        return;
      }

      if (event.key !== "Enter") {
        return;
      }

      const selectedItem = selectableItems[activeSelectedIndex];

      if (!selectedItem) {
        return;
      }

      event.preventDefault();

      if (selectedItem.kind === "quick-open") {
        onSelectQuickOpen(selectedItem.item.fileId);
        return;
      }

      if (selectedItem.kind === "search-file") {
        onSelectSearch(selectedItem.item.fileId);
        return;
      }

      if (selectedItem.kind === "search-content") {
        onSelectSearch(selectedItem.item.fileId, selectedItem.item.lineNumber);
        return;
      }

      onSelectCommand(selectedItem.item.id);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    commandPrompt,
    isOpen,
    onCancelCommandPrompt,
    onClose,
    onSelectCommand,
    onSelectQuickOpen,
    onSelectSearch,
    selectableItems,
    activeSelectedIndex,
  ]);

  if (!isOpen) {
    return null;
  }

  const showQuickOpenEmpty = mode === "quick-open" && quickOpenItems.length === 0;
  const showSearchEmpty =
    mode === "search" &&
    fileSearchItems.length === 0 &&
    contentSearchItems.length === 0;
  const showCommandEmpty = mode === "command" && commandItems.length === 0;

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/55 px-4 py-16 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          if (commandPrompt) {
            onCancelCommandPrompt();
          } else {
            onClose();
          }
        }
      }}
    >
      <div className="flex max-h-[min(720px,80vh)] w-full max-w-3xl flex-col overflow-hidden border border-[var(--line-strong)] bg-[var(--panel-bg)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              IDE Omnibar
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {commandPrompt ? commandPrompt.title : modeLabel(mode)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ModeButton
              active={mode === "quick-open"}
              label="Open"
              hint="Ctrl/Cmd + P"
              onClick={() => {
                setSelectedIndex(0);
                onModeChange("quick-open");
              }}
            />
            <ModeButton
              active={mode === "search"}
              label="Search"
              hint="File + Content"
              onClick={() => {
                setSelectedIndex(0);
                onModeChange("search");
              }}
            />
            <ModeButton
              active={mode === "command"}
              label="Palette"
              hint="Ctrl/Cmd + Shift + P"
              onClick={() => {
                setSelectedIndex(0);
                onModeChange("command");
              }}
            />
          </div>
        </div>

        <div className="border-b border-[var(--line)] px-4 py-3">
          {!commandPrompt ? (
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setSelectedIndex(0);
                onQueryChange(event.target.value);
              }}
              placeholder={modePlaceholder(mode)}
              className="h-12 w-full border border-[var(--line)] bg-[var(--editor-tab-hover-bg)] px-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
            />
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {commandPrompt ? (
            <CommandPromptCard
              commandPrompt={commandPrompt}
              onSubmit={onSubmitCommandPrompt}
              onCancel={onCancelCommandPrompt}
            />
          ) : null}

          {!commandPrompt && showQuickOpenEmpty ? (
            <EmptyState
              title="No Matching Files"
              detail="Try a shorter query or create/import more files into this session."
            />
          ) : null}

          {!commandPrompt && showSearchEmpty ? (
            <EmptyState
              title="No Search Results"
              detail="Search filenames directly or use at least two characters for content matches."
            />
          ) : null}

          {!commandPrompt && showCommandEmpty ? (
            <EmptyState
              title="No Commands Available"
              detail="This workspace does not expose any command-palette actions right now."
            />
          ) : null}

          {!commandPrompt && mode === "quick-open" && quickOpenItems.length > 0 ? (
            <div className="space-y-1">
              {quickOpenItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectQuickOpen(item.fileId)}
                  className={`flex w-full items-start gap-3 border px-3 py-3 text-left transition ${
                    index === activeSelectedIndex
                      ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                      : "border-transparent bg-[var(--bg-panel-soft)] hover:border-[var(--line)] hover:bg-[var(--editor-tab-hover-bg)]"
                  }`}
                >
                  <span className="inline-flex h-6 min-w-8 items-center justify-center border border-[var(--line)] bg-[var(--bg-panel)] px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {item.title}
                    </p>
                    <p className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">
                      {item.subtitle}
                    </p>
                  </div>
                  {item.badge ? (
                    <span className="border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {!commandPrompt && mode === "search" ? (
            <div className="space-y-5">
              {fileSearchItems.length > 0 ? (
                <section>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Files
                  </p>
                  <div className="space-y-1">
                    {fileSearchItems.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectSearch(item.fileId)}
                        className={`flex w-full items-start gap-3 border px-3 py-3 text-left transition ${
                          index === activeSelectedIndex
                            ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                            : "border-transparent bg-[var(--bg-panel-soft)] hover:border-[var(--line)] hover:bg-[var(--editor-tab-hover-bg)]"
                        }`}
                      >
                        <span className="inline-flex h-6 min-w-8 items-center justify-center border border-[var(--line)] bg-[var(--bg-panel)] px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {item.title}
                          </p>
                          <p className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">
                            {item.subtitle}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {contentSearchItems.length > 0 ? (
                <section>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Content Matches
                  </p>
                  <div className="space-y-1">
                    {contentSearchItems.map((item, index) => {
                      const visualIndex = fileSearchItems.length + index;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectSearch(item.fileId, item.lineNumber)}
                          className={`flex w-full items-start gap-3 border px-3 py-3 text-left transition ${
                            visualIndex === activeSelectedIndex
                              ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                              : "border-transparent bg-[var(--bg-panel-soft)] hover:border-[var(--line)] hover:bg-[var(--editor-tab-hover-bg)]"
                          }`}
                        >
                          <span className="inline-flex h-6 min-w-8 items-center justify-center border border-[var(--line)] bg-[var(--bg-panel)] px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                            {item.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                                {item.title}
                              </p>
                              <span className="border border-[var(--line)] bg-[var(--bg-panel)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                L{item.lineNumber}
                              </span>
                            </div>
                            <p className="mt-1 truncate font-mono text-[11px] text-[var(--text-muted)]">
                              {item.subtitle}
                            </p>
                            <p className="mt-2 truncate text-xs text-[var(--text-secondary)]">
                              {item.lineText}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {!commandPrompt && mode === "command" && commandItems.length > 0 ? (
            <div className="space-y-1">
              {commandItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => onSelectCommand(item.id)}
                  className={`flex w-full items-start gap-3 border px-3 py-3 text-left transition ${
                    index === activeSelectedIndex
                      ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                      : "border-transparent bg-[var(--bg-panel-soft)] hover:border-[var(--line)] hover:bg-[var(--editor-tab-hover-bg)]"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="inline-flex h-6 min-w-8 items-center justify-center border border-[var(--line)] bg-[var(--bg-panel)] px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {item.icon ?? "CMD"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      {item.badge ? (
                        <span className="border border-[var(--line)] bg-[var(--bg-panel)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                      {item.subtitle}
                    </p>
                  </div>
                  {item.shortcut ? (
                    <span className="border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      {item.shortcut}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-[11px] text-[var(--text-muted)]">
          <p>{commandPrompt ? "Enter saves the command input. Escape cancels." : "Arrow keys navigate. Enter selects. Escape closes."}</p>
          <div className="flex flex-wrap items-center gap-2 font-mono uppercase tracking-[0.08em]">
            <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1">
              Quick Open
            </span>
            <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1">
              Search
            </span>
            <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1">
              Palette
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
