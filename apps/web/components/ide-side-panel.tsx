"use client";

type SidePanelTab = {
  id: string;
  label: string;
};

type IdeSidePanelProps = {
  title: string;
  subtitle: string;
  /** Hide title row and “Right Panel” badge for compact iTECify-style tabs. */
  hideChromeLabels?: boolean;
  tabs: SidePanelTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  children: React.ReactNode;
};

function tabButtonClasses(active: boolean) {
  return active
    ? "border-b-[var(--accent)] bg-[var(--editor-tab-active-bg)] text-[var(--text-primary)]"
    : "border-b-transparent bg-[var(--editor-tab-bg)] text-[var(--text-muted)] hover:bg-[var(--editor-tab-hover-bg)] hover:text-[var(--text-primary)]";
}

export function IdeSidePanel({
  title,
  subtitle,
  hideChromeLabels = false,
  tabs,
  activeTabId,
  onSelectTab,
  children,
}: IdeSidePanelProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
      <div className="border-b border-[var(--line)]">
        {hideChromeLabels ? null : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {title}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{subtitle}</p>
            </div>
            <span className="m-3 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Right Panel
            </span>
          </div>
        )}

        <div className={`flex ${hideChromeLabels ? "h-[34px]" : ""}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-1 items-center justify-center border-b-2 px-1 py-2 text-[10.5px] font-medium transition ${tabButtonClasses(
                activeTabId === tab.id,
              )}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">{children}</div>
    </aside>
  );
}
