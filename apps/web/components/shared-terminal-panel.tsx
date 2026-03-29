"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useMemo, useRef } from "react";
import type { TerminalEntry } from "@/lib/socket";

type SharedTerminalPanelProps = {
  roomId: string;
  entries: TerminalEntry[];
  canInteract: boolean;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onClear: () => void;
  onCommand: (command: string) => void;
  onRunActiveFile: () => void;
  canRunActiveFile: boolean;
  activeFileLabel?: string | null;
};

function renderTerminalEntry(entry: TerminalEntry) {
  if (entry.kind === "system") {
    return `\r\n\x1b[36m${entry.text}\x1b[0m\r\n`;
  }

  if (entry.kind === "stderr") {
    return `\x1b[31m${entry.text}\x1b[0m`;
  }

  if (entry.kind === "command") {
    return `\x1b[38;5;81m${entry.text}\x1b[0m`;
  }

  return entry.text;
}

export function SharedTerminalPanel({
  roomId,
  entries,
  canInteract,
  onInput,
  onResize,
  onClear,
  onCommand,
  onRunActiveFile,
  canRunActiveFile,
  activeFileLabel,
}: SharedTerminalPanelProps) {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const renderedEntryIdsRef = useRef<string[]>([]);
  const canInteractRef = useRef(canInteract);
  const onInputRef = useRef(onInput);
  const onResizeRef = useRef(onResize);

  const sessionLabel = useMemo(() => roomId.toUpperCase(), [roomId]);

  useEffect(() => {
    canInteractRef.current = canInteract;
    onInputRef.current = onInput;
    onResizeRef.current = onResize;
  }, [canInteract, onInput, onResize]);

  useEffect(() => {
    const container = terminalContainerRef.current;

    if (!container) {
      return;
    }

    const terminal = new Terminal({
      convertEol: false,
      cursorBlink: true,
      scrollback: 4000,
      fontFamily: "var(--font-ibm-plex-mono)",
      fontSize: 13,
      lineHeight: 1.35,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        cursorAccent: "#1e1e1e",
        selectionBackground: "rgba(38, 79, 120, 0.55)",
        black: "#000000",
        red: "#f14c4c",
        green: "#23d18b",
        yellow: "#f5f543",
        blue: "#3b8eea",
        magenta: "#d670d6",
        cyan: "#29b8db",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();
    onResizeRef.current(terminal.cols, terminal.rows);

    const disposeData = terminal.onData((data) => {
      if (!canInteractRef.current) {
        return;
      }

      onInputRef.current(data);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      onResizeRef.current(terminal.cols, terminal.rows);
    });

    resizeObserver.observe(container);

    terminalRef.current = terminal;

    return () => {
      resizeObserver.disconnect();
      disposeData.dispose();
      terminal.dispose();
      terminalRef.current = null;
      renderedEntryIdsRef.current = [];
    };
  }, [roomId]);

  useEffect(() => {
    const terminal = terminalRef.current;

    if (!terminal) {
      return;
    }

    terminal.options.disableStdin = !canInteract;
  }, [canInteract]);

  useEffect(() => {
    const terminal = terminalRef.current;

    if (!terminal) {
      return;
    }

    const previousIds = renderedEntryIdsRef.current;
    const nextIds = entries.map((entry) => entry.id);
    const canAppendIncrementally =
      previousIds.length <= nextIds.length &&
      previousIds.every((id, index) => nextIds[index] === id);

    if (!canAppendIncrementally) {
      terminal.reset();

      for (const entry of entries) {
        terminal.write(renderTerminalEntry(entry));
      }
    } else {
      for (const entry of entries.slice(previousIds.length)) {
        terminal.write(renderTerminalEntry(entry));
      }
    }

    renderedEntryIdsRef.current = nextIds;
  }, [entries]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--panel-bg)]">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#1e1e1e]">
        <div ref={terminalContainerRef} className="h-full w-full px-2 py-2" />
        {!canInteract ? (
          <div className="pointer-events-none absolute right-3 top-3 border border-amber-400/20 bg-amber-400/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300">
            Reconnect to type
          </div>
        ) : null}
      </div>
    </section>
  );
}
