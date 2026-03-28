"use client";

type IdeEditorTab = {
  id: string;
  name: string;
  path: string;
  editable?: boolean;
};

type IdeEditorTabsProps = {
  tabs: IdeEditorTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  disabled?: boolean;
};

export function IdeEditorTabs({
  tabs,
  activeTabId,
  onSelect,
  disabled = false,
}: IdeEditorTabsProps) {
  return (
    <div className="flex items-stretch overflow-x-auto border-b border-[var(--line)] bg-[var(--editor-tab-bg)]">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;

        return (
          <button
            key={tab.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(tab.id)}
            className={`min-w-0 border-r border-[var(--line)] px-3 py-2 text-left transition ${
              active
                ? "bg-[var(--editor-tab-active-bg)]"
                : "bg-[var(--editor-tab-bg)] hover:bg-[var(--editor-tab-hover-bg)]"
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                {tab.name}
              </span>
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
        );
      })}
    </div>
  );
}
