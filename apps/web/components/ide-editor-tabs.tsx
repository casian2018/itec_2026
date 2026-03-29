"use client";

type IdeEditorTab = {
  id: string;
  name: string;
  path: string;
  icon?: string;
  extension?: string;
  editable?: boolean;
  isDirty?: boolean;
  isReadOnly?: boolean;
};

type IdeEditorTabsProps = {
  tabs: IdeEditorTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onClose?: (tabId: string) => void;
  disabled?: boolean;
};

export function IdeEditorTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  disabled = false,
}: IdeEditorTabsProps) {
  return (
    <div className="flex items-stretch overflow-x-auto border-b border-[var(--line)] bg-[var(--editor-tab-bg)]">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;

        return (
          <div
            key={tab.id}
            className={`group flex min-w-[170px] max-w-[240px] items-stretch border-r border-[var(--line)] transition ${
              active
                ? "bg-[var(--editor-tab-active-bg)]"
                : "bg-[var(--editor-tab-bg)] hover:bg-[var(--editor-tab-hover-bg)]"
            } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(tab.id)}
              className="flex-1 px-3 py-2 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 min-w-5 items-center justify-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {tab.icon ?? "TXT"}
                </span>
                <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                  {tab.name}
                </span>
                {tab.isDirty ? (
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-300"
                    title="Unsaved changes"
                  />
                ) : null}
                {tab.isReadOnly ? (
                  <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    RO
                  </span>
                ) : null}
                {tab.extension ? (
                  <span className="hidden font-mono text-[10px] text-[var(--text-muted)] md:inline">
                    {tab.extension}
                  </span>
                ) : null}
                {tab.editable ? (
                  <span className="border border-[var(--accent-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--accent)]">
                    Live
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-muted)]">
                {tab.path}
              </p>
            </button>
            {onClose ? (
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className={`mr-1 flex h-full items-center px-1.5 text-[11px] transition ${
                  active
                    ? "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    : "text-transparent group-hover:text-[var(--text-muted)] hover:!text-[var(--text-primary)]"
                } disabled:cursor-not-allowed`}
                title="Close tab"
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
