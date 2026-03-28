"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  getMonacoThemeName,
  registerMonacoThemes,
  type IdeThemeId,
} from "@/lib/ide-theme";
import type { CursorPosition, RemoteCursor } from "@/lib/socket";
import type { editor as MonacoEditorNamespace } from "monaco-editor";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-[var(--editor-shell)] text-sm text-[var(--text-muted)]">
      Loading editor...
    </div>
  ),
});

type MonacoModule = typeof import("monaco-editor");

type CollaborativeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onCursorChange: (position: CursorPosition) => void;
  remoteCursors: RemoteCursor[];
  language?: string;
  readOnly?: boolean;
  ideTheme: IdeThemeId;
};

const cursorThemes = [
  {
    cursorClass: "remote-cursor-cyan",
    labelClass: "remote-cursor-label-cyan",
  },
  {
    cursorClass: "remote-cursor-amber",
    labelClass: "remote-cursor-label-amber",
  },
  {
    cursorClass: "remote-cursor-rose",
    labelClass: "remote-cursor-label-rose",
  },
  {
    cursorClass: "remote-cursor-violet",
    labelClass: "remote-cursor-label-violet",
  },
  {
    cursorClass: "remote-cursor-blue",
    labelClass: "remote-cursor-label-blue",
  },
];

function cursorThemeFor(socketId: string) {
  const hash = Array.from(socketId).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  return cursorThemes[hash % cursorThemes.length];
}

function languageLabel(language: string) {
  if (language === "javascript") {
    return "JavaScript";
  }

  if (language === "typescript") {
    return "TypeScript";
  }

  if (language === "python") {
    return "Python";
  }

  if (language === "c") {
    return "C";
  }

  if (language === "cpp") {
    return "C++";
  }

  if (language === "html") {
    return "HTML";
  }

  if (language === "css") {
    return "CSS";
  }

  if (language === "json") {
    return "JSON";
  }

  if (language === "markdown") {
    return "Markdown";
  }

  return "text";
}

export function CollaborativeEditor({
  value,
  onChange,
  onCursorChange,
  remoteCursors,
  language = "javascript",
  readOnly = false,
  ideTheme,
}: CollaborativeEditorProps) {
  const showEmptyState = value.trim().length === 0;
  const editorRef = useRef<MonacoEditorNamespace.IStandaloneCodeEditor | null>(
    null,
  );
  const monacoRef = useRef<MonacoModule | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco) {
      return;
    }

    const decorations = remoteCursors.map((cursor) => {
      const theme = cursorThemeFor(cursor.socketId);

      return {
        range: new monaco.Range(
          cursor.position.lineNumber,
          cursor.position.column,
          cursor.position.lineNumber,
          cursor.position.column,
        ),
        options: {
          className: theme.cursorClass,
          after: {
            content: ` ${cursor.name} `,
            inlineClassName: theme.labelClass,
            inlineClassNameAffectsLetterSpacing: true,
          },
        },
      };
    });

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      decorations,
    );
  }, [remoteCursors]);

  useEffect(() => {
    return () => {
      const editor = editorRef.current;

      if (editor && decorationIdsRef.current.length > 0) {
        editor.deltaDecorations(decorationIdsRef.current, []);
      }
    };
  }, []);

  function handleMount(
    editor: MonacoEditorNamespace.IStandaloneCodeEditor,
    monaco: MonacoModule,
  ) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onDidChangeCursorPosition((event) => {
      if (readOnly) {
        return;
      }

      onCursorChange({
        lineNumber: event.position.lineNumber,
        column: event.position.column,
      });
    });

    const position = editor.getPosition();

    if (position) {
      if (readOnly) {
        return;
      }

      onCursorChange({
        lineNumber: position.lineNumber,
        column: position.column,
      });
    }
  }

  return (
    <div className="relative h-full min-h-0">
      <MonacoEditor
        height="100%"
        language={language}
        beforeMount={registerMonacoThemes}
        theme={getMonacoThemeName(ideTheme)}
        value={value}
        onMount={handleMount}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          automaticLayout: true,
          readOnly,
          domReadOnly: readOnly,
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
      {showEmptyState ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-sm border border-[var(--line)] bg-[var(--empty-overlay)] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Empty Editor
          </p>
          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
            Start typing {languageLabel(language)} or switch files. The shared
            workspace syncs per file as soon as content appears.
          </p>
        </div>
      ) : null}
      <style jsx global>{`
        .monaco-editor .remote-cursor-cyan,
        .monaco-editor .remote-cursor-amber,
        .monaco-editor .remote-cursor-rose,
        .monaco-editor .remote-cursor-violet,
        .monaco-editor .remote-cursor-blue {
          margin-left: -1px;
          border-left-width: 2px;
          border-left-style: solid;
        }

        .monaco-editor .remote-cursor-cyan {
          border-left-color: #52c7b8;
        }

        .monaco-editor .remote-cursor-amber {
          border-left-color: #f59e0b;
        }

        .monaco-editor .remote-cursor-rose {
          border-left-color: #fb7185;
        }

        .monaco-editor .remote-cursor-violet {
          border-left-color: #a78bfa;
        }

        .monaco-editor .remote-cursor-blue {
          border-left-color: #60a5fa;
        }

        .monaco-editor .remote-cursor-label-cyan,
        .monaco-editor .remote-cursor-label-amber,
        .monaco-editor .remote-cursor-label-rose,
        .monaco-editor .remote-cursor-label-violet,
        .monaco-editor .remote-cursor-label-blue {
          margin-left: 6px;
          border-radius: 999px;
          padding: 2px 6px;
          font-family: var(--font-ibm-plex-mono), monospace;
          font-size: 11px;
          font-weight: 600;
        }

        .monaco-editor .remote-cursor-label-cyan {
          background: rgba(82, 199, 184, 0.16);
          color: #7ce5d8;
        }

        .monaco-editor .remote-cursor-label-amber {
          background: rgba(245, 158, 11, 0.16);
          color: #fbbf24;
        }

        .monaco-editor .remote-cursor-label-rose {
          background: rgba(251, 113, 133, 0.16);
          color: #fda4af;
        }

        .monaco-editor .remote-cursor-label-violet {
          background: rgba(167, 139, 250, 0.16);
          color: #c4b5fd;
        }

        .monaco-editor .remote-cursor-label-blue {
          background: rgba(96, 165, 250, 0.16);
          color: #93c5fd;
        }
      `}</style>
    </div>
  );
}
