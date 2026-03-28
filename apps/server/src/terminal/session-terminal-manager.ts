import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawn, type IPty } from "node-pty";
import type { RoomStore } from "../room-store.js";
import type { WorkspaceState } from "../types.js";
import { RoomTerminal } from "./room-terminal.js";

type SessionTerminal = {
  roomId: string;
  pty: IPty;
  workingDirectory: string;
  managedWorkspacePaths: Set<string>;
  syncQueue: Promise<void>;
};

type SessionTerminalManagerDependencies = {
  roomStore: Pick<RoomStore, "getRoom">;
  terminal: RoomTerminal;
};

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;
const TERM_NAME = "xterm-256color";
const TERMINAL_TOOLCHAIN_LABEL =
  "node, npm, pnpm, yarn, python, pip, gcc, g++, make, git, curl, wget, ripgrep, jq, zip/unzip";

function resolveShell() {
  const candidates = [process.env.SHELL, "/bin/bash", "/bin/zsh", "/bin/sh"];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return "/bin/sh";
}

function shellArgsFor(shellPath: string) {
  const shellName = shellPath.split("/").at(-1) ?? shellPath;

  if (shellName === "bash" || shellName === "zsh" || shellName === "sh") {
    return ["-i"];
  }

  return [];
}

function shellPrompt() {
  return "\\[\\e[1;36m\\]itecify\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]$ ";
}

function sanitizeWorkspacePath(path: string) {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").trim();

  if (!normalized || normalized.includes("..")) {
    return null;
  }

  return normalized;
}

function sortByDepthDescending(paths: Iterable<string>) {
  return [...paths].sort((left, right) => {
    const depthDelta = right.split("/").length - left.split("/").length;
    return depthDelta !== 0 ? depthDelta : right.localeCompare(left);
  });
}

function normalizeTerminalChunk(text: string) {
  return text.replace(/\r?\n/g, "\r\n");
}

async function removeDirectorySafe(path: string | null) {
  if (!path) {
    return;
  }

  try {
    await rm(path, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
}

export class SessionTerminalManager {
  private readonly terminals = new Map<string, SessionTerminal>();
  private readonly shellPath = resolveShell();
  private readonly shellArgs = shellArgsFor(this.shellPath);

  constructor(private readonly dependencies: SessionTerminalManagerDependencies) {}

  async ensureRoomTerminal(roomId: string, workspace: WorkspaceState) {
    const existingTerminal = this.terminals.get(roomId);

    if (existingTerminal) {
      await this.syncWorkspace(roomId, workspace);
      return existingTerminal;
    }

    const workingDirectory = await mkdtemp(join(tmpdir(), `itecify-shell-${roomId}-`));
    const pty = spawn(this.shellPath, this.shellArgs, {
      name: TERM_NAME,
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      cwd: workingDirectory,
      env: {
        ...process.env,
        TERM: TERM_NAME,
        COLORTERM: "truecolor",
        PS1: shellPrompt(),
      },
    });

    const terminal: SessionTerminal = {
      roomId,
      pty,
      workingDirectory,
      managedWorkspacePaths: new Set(),
      syncQueue: Promise.resolve(),
    };

    this.terminals.set(roomId, terminal);

    pty.onData((data) => {
      const normalized = normalizeTerminalChunk(data);

      if (!normalized) {
        return;
      }

      this.dependencies.terminal.appendText(roomId, "stdout", normalized);
    });

    pty.onExit(({ exitCode, signal }) => {
      const stillActive = this.terminals.get(roomId);

      if (stillActive?.pty !== pty) {
        return;
      }

      this.terminals.delete(roomId);
      this.dependencies.terminal.appendText(
        roomId,
        "system",
        `Session shell exited${signal ? ` on signal ${signal}` : ""} with code ${exitCode}. Reopen the terminal or reconnect to start a fresh shell.`,
      );
      void removeDirectorySafe(workingDirectory);
    });

    await this.syncWorkspace(roomId, workspace);
    this.dependencies.terminal.appendText(
      roomId,
      "system",
      `Shared terminal ready for session ${roomId}. Working directory: ${workingDirectory}`,
    );
    this.dependencies.terminal.appendText(
      roomId,
      "system",
      `Toolchain available in the Docker IDE environment: ${TERMINAL_TOOLCHAIN_LABEL}`,
    );

    return terminal;
  }

  async syncWorkspace(roomId: string, workspace: WorkspaceState) {
    const terminal = this.terminals.get(roomId);

    if (!terminal) {
      return;
    }

    terminal.syncQueue = terminal.syncQueue
      .catch(() => undefined)
      .then(async () => {
        const nextManagedPaths = new Set<string>();
        const folders = workspace.nodes.filter((node) => node.kind === "folder");
        const files = workspace.nodes.filter((node) => node.kind === "file");

        for (const folder of folders) {
          const relativePath = sanitizeWorkspacePath(folder.path);

          if (!relativePath) {
            continue;
          }

          nextManagedPaths.add(relativePath);
          await mkdir(join(terminal.workingDirectory, relativePath), {
            recursive: true,
          });
        }

        for (const file of files) {
          const relativePath = sanitizeWorkspacePath(file.path);

          if (!relativePath) {
            continue;
          }

          nextManagedPaths.add(relativePath);

          const absolutePath = join(terminal.workingDirectory, relativePath);
          await mkdir(dirname(absolutePath), { recursive: true });
          await writeFile(absolutePath, file.content, "utf8");
        }

        for (const stalePath of sortByDepthDescending(terminal.managedWorkspacePaths)) {
          if (nextManagedPaths.has(stalePath)) {
            continue;
          }

          await rm(join(terminal.workingDirectory, stalePath), {
            recursive: true,
            force: true,
          });
        }

        terminal.managedWorkspacePaths = nextManagedPaths;
      });

    await terminal.syncQueue;
  }

  async write(roomId: string, data: string) {
    const room = this.dependencies.roomStore.getRoom(roomId);

    if (!room) {
      return;
    }

    const terminal =
      this.terminals.get(roomId) ?? (await this.ensureRoomTerminal(roomId, room.workspace));

    terminal.pty.write(data);
  }

  async runCommand(roomId: string, command: string) {
    if (!command.trim()) {
      return;
    }

    await this.write(roomId, `${command}\r`);
  }

  resize(roomId: string, cols: number, rows: number) {
    const terminal = this.terminals.get(roomId);

    if (!terminal) {
      return;
    }

    const safeCols = Number.isFinite(cols) ? Math.max(40, Math.trunc(cols)) : DEFAULT_COLS;
    const safeRows = Number.isFinite(rows) ? Math.max(8, Math.trunc(rows)) : DEFAULT_ROWS;

    terminal.pty.resize(safeCols, safeRows);
  }

  async clear(roomId: string, clearedBy: string) {
    const roomState = this.dependencies.terminal.clear(roomId, clearedBy);
    const terminal = this.terminals.get(roomId);

    if (terminal) {
      terminal.pty.write("\f");
    }

    return roomState;
  }

  async destroyRoom(roomId: string) {
    const terminal = this.terminals.get(roomId);

    if (!terminal) {
      return;
    }

    this.terminals.delete(roomId);

    try {
      terminal.pty.kill();
    } catch {
      // Best-effort PTY shutdown.
    }

    await removeDirectorySafe(terminal.workingDirectory);
  }
}
