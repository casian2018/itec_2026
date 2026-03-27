"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-[#0b1220] text-sm text-[var(--text-muted)]">
      Loading editor...
    </div>
  ),
});

type CollaborativeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language?: string;
};

export function CollaborativeEditor({
  value,
  onChange,
  language = "javascript",
}: CollaborativeEditorProps) {
  return (
    <div className="h-full min-h-0">
      <MonacoEditor
        height="100%"
        language={language}
        theme="vs-dark"
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 15,
          fontFamily: "var(--font-ibm-plex-mono)",
          smoothScrolling: true,
          scrollBeyondLastLine: false,
          tabSize: 2,
          padding: {
            top: 16,
          },
          cursorSmoothCaretAnimation: "on",
          roundedSelection: false,
          renderLineHighlight: "gutter",
          wordWrap: "on",
        }}
      />
    </div>
  );
}
