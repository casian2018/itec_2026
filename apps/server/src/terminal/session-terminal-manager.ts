import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { spawn as spawnChildProcess } from "node:child_process";
import { spawn, type IPty } from "node-pty";
import type { RoomStore } from "../room-store.js";
import type { RunOutputPayload, WorkspaceState } from "../types.js";
import { RoomTerminal } from "./room-terminal.js";

type SessionTerminal = {
  roomId: string;
  pty: IPty;
  containerName: string;
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
const CONTAINER_WORKDIR = "/workspace";
const CONTAINER_HOME = "/home/dev";
const CONTAINER_USER = "10001:10001";
const TERMINAL_MEMORY_LIMIT = process.env.ITECIFY_TERMINAL_MEMORY_LIMIT?.trim() || "512m";
const TERMINAL_CPU_LIMIT = process.env.ITECIFY_TERMINAL_CPU_LIMIT?.trim() || "1";
const TERMINAL_PIDS_LIMIT = process.env.ITECIFY_TERMINAL_PIDS_LIMIT?.trim() || "128";
const TERMINAL_NETWORK_MODE = process.env.ITECIFY_TERMINAL_NETWORK_MODE?.trim() || "none";
const TERMINAL_IMAGE = process.env.ITECIFY_TERMINAL_IMAGE?.trim() || "itecify-terminal-sandbox:local";
const TERMINAL_BUILD_CONTEXT = process.env.ITECIFY_TERMINAL_BUILD_CONTEXT?.trim() || process.cwd();
const TERMINAL_DOCKERFILE =
  process.env.ITECIFY_TERMINAL_DOCKERFILE?.trim() ||
  join(TERMINAL_BUILD_CONTEXT, "apps/server/Dockerfile.terminal");
const TERMINAL_IMAGE_BUILD_TIMEOUT_MS = 5 * 60_000;
const TERMINAL_TMP_ROOT =
  process.env.ITECIFY_TERMINAL_TMP_ROOT?.trim() ||
  process.env.ITECIFY_EXECUTION_TMP_ROOT?.trim() ||
  tmpdir();
const TERMINAL_TOOLCHAIN_LABEL =
  "node, npm, pnpm, yarn, python, pip, gcc, g++, make, git, curl, wget, ripgrep, jq, zip/unzip";

const preparedImages = new Set<string>();
const inflightImagePreparations = new Map<string, Promise<void>>();

function helperBootstrap(roomId: string) {
  return [
    `export ITECIFY_SESSION="${roomId}"`,
    "export PS1='\\[\\e[1;36m\\]itecify\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]$ '",
    "export HISTFILE=/dev/null",
    "ithelp() {",
    "  cat <<'EOF'",
    "iTECify terminal helpers",
    "- pwd / ls / tree: inspect the shared workspace",
    "- node <file>, python <file>, gcc/g++ <file>: run directly in the sandbox shell",
    "- clear: clear the terminal screen",
    "- Network access is disabled by default in this shell sandbox",
    "- The shell runs as an unprivileged user in a locked-down container",
    "- Use the IDE Run button for language-aware execution tied to the active file",
    "EOF",
    "}",
    "alias help='ithelp'",
    "alias ll='ls -la'",
    "alias sudo='echo sudo is unavailable in this sandbox'",
    "",
  ].join("\n");
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

function normalizeContainerName(roomId: string) {
  return `itecify-term-${roomId}`.toLowerCase().replace(/[^a-z0-9_.-]/g, "-");
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

async function runDockerCommand(args: string[]) {
  const child = spawnChildProcess("docker", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk: Buffer | string) => {
    stdout += chunk.toString("utf8");
  });

  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString("utf8");
  });

  const [exitCode] = (await once(child, "close")) as [number | null];

  return {
    exitCode: exitCode ?? 1,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function safeForceRemoveContainer(containerName: string | null) {
  if (!containerName) {
    return;
  }

  try {
    const removeProcess = spawnChildProcess("docker", ["rm", "-f", containerName], {
      stdio: "ignore",
    });

    await once(removeProcess, "close");
  } catch {
    // Best-effort container cleanup.
  }
}

async function ensureTerminalImageAvailable(
  roomId: string,
  terminal: RoomTerminal,
) {
  if (preparedImages.has(TERMINAL_IMAGE)) {
    return;
  }

  const inflightPreparation = inflightImagePreparations.get(TERMINAL_IMAGE);

  if (inflightPreparation) {
    await inflightPreparation;
    return;
  }

  const preparation = (async () => {
    const inspectResult = await runDockerCommand(["image", "inspect", TERMINAL_IMAGE]);

    if (inspectResult.exitCode === 0) {
      preparedImages.add(TERMINAL_IMAGE);
      return;
    }

    if (!existsSync(TERMINAL_DOCKERFILE)) {
      throw new Error(
        `Terminal sandbox image ${TERMINAL_IMAGE} is missing and ${TERMINAL_DOCKERFILE} was not found.`,
      );
    }

    terminal.appendText(
      roomId,
      "system",
      `Building secure terminal image ${TERMINAL_IMAGE}. First boot may take a little longer.`,
    );

    const buildProcess = spawnChildProcess(
      "docker",
      ["build", "-t", TERMINAL_IMAGE, "-f", TERMINAL_DOCKERFILE, TERMINAL_BUILD_CONTEXT],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stderr = "";
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timedOut = true;
      buildProcess.kill("SIGTERM");
    }, TERMINAL_IMAGE_BUILD_TIMEOUT_MS);
    timeout.unref();

    buildProcess.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString("utf8");
    });

    const [exitCode] = (await once(buildProcess, "close")) as [number | null];

    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }

    if (timedOut) {
      throw new Error(
        `Terminal sandbox image build timed out after ${
          TERMINAL_IMAGE_BUILD_TIMEOUT_MS / 1000
        } seconds.`,
      );
    }

    if ((exitCode ?? 1) !== 0) {
      throw new Error(
        stderr.trim() ||
          `Unable to build secure terminal image ${TERMINAL_IMAGE}.`,
      );
    }

    preparedImages.add(TERMINAL_IMAGE);
    terminal.appendText(
      roomId,
      "system",
      `Secure terminal image ${TERMINAL_IMAGE} is ready.`,
    );
  })();

  inflightImagePreparations.set(TERMINAL_IMAGE, preparation);

  try {
    await preparation;
  } finally {
    inflightImagePreparations.delete(TERMINAL_IMAGE);
  }
}

async function createTerminalWorkspaceDirectory(roomId: string) {
  await mkdir(TERMINAL_TMP_ROOT, { recursive: true, mode: 0o777 });
  const workingDirectory = await mkdtemp(join(TERMINAL_TMP_ROOT, `itecify-shell-${roomId}-`));
  await chmod(workingDirectory, 0o777);
  return workingDirectory;
}

export class SessionTerminalManager {
  private readonly terminals = new Map<string, SessionTerminal>();

  constructor(private readonly dependencies: SessionTerminalManagerDependencies) {}

  async ensureRoomTerminal(roomId: string, workspace: WorkspaceState) {
    const existingTerminal = this.terminals.get(roomId);

    if (existingTerminal) {
      await this.syncWorkspace(roomId, workspace);
      return existingTerminal;
    }

    await ensureTerminalImageAvailable(roomId, this.dependencies.terminal);

    const workingDirectory = await createTerminalWorkspaceDirectory(roomId);
    const containerName = normalizeContainerName(roomId);

    await safeForceRemoveContainer(containerName);

    const pty = spawn("docker", [
      "run",
      "--rm",
      "--init",
      "--name",
      containerName,
      "--hostname",
      `term-${roomId.slice(0, 12).toLowerCase()}`,
      "--interactive",
      "--tty",
      "--user",
      CONTAINER_USER,
      "--network",
      TERMINAL_NETWORK_MODE,
      "--memory",
      TERMINAL_MEMORY_LIMIT,
      "--cpus",
      TERMINAL_CPU_LIMIT,
      "--pids-limit",
      TERMINAL_PIDS_LIMIT,
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--read-only",
      "--tmpfs",
      `/tmp:rw,noexec,nosuid,nodev,size=64m`,
      "--tmpfs",
      `${CONTAINER_HOME}:rw,nosuid,nodev,size=64m`,
      "--tmpfs",
      `/var/tmp:rw,noexec,nosuid,nodev,size=32m`,
      "--workdir",
      CONTAINER_WORKDIR,
      "--volume",
      `${workingDirectory}:${CONTAINER_WORKDIR}:rw`,
      "--env",
      `TERM=${TERM_NAME}`,
      "--env",
      "COLORTERM=truecolor",
      "--env",
      `HOME=${CONTAINER_HOME}`,
      "--env",
      "HISTFILE=/dev/null",
      "--env",
      "HISTSIZE=0",
      "--env",
      `ITECIFY_SESSION=${roomId}`,
      TERMINAL_IMAGE,
      "bash",
      "--noprofile",
      "--norc",
      "-i",
    ], {
      name: TERM_NAME,
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      cwd: workingDirectory,
      env: {
        TERM: TERM_NAME,
      },
    });

    const terminal: SessionTerminal = {
      roomId,
      pty,
      containerName,
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
        `Secure session shell exited${signal ? ` on signal ${signal}` : ""} with code ${exitCode}. Reopen the terminal or reconnect to start a fresh sandbox.`,
      );
      void safeForceRemoveContainer(containerName);
      void removeDirectorySafe(workingDirectory);
    });

    await this.syncWorkspace(roomId, workspace);
    pty.write(`${helperBootstrap(roomId)}\r`);

    this.dependencies.terminal.appendText(
      roomId,
      "system",
      `Secure shared terminal ready for session ${roomId}. Workspace mount: ${workingDirectory}`,
    );
    this.dependencies.terminal.appendText(
      roomId,
      "system",
      `Sandbox defaults: non-persistent container, network=${TERMINAL_NETWORK_MODE}, read-only base image, dropped Linux capabilities, no-new-privileges, and per-room resource limits.`,
    );
    this.dependencies.terminal.appendText(
      roomId,
      "system",
      `Toolchain available in the sandbox image: ${TERMINAL_TOOLCHAIN_LABEL}`,
    );
    this.dependencies.terminal.appendText(
      roomId,
      "system",
      'Run "help" for terminal helpers. Use the IDE Run button for the active file runner.',
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
          const folderPath = join(terminal.workingDirectory, relativePath);
          await mkdir(folderPath, {
            recursive: true,
            mode: 0o777,
          });
          await chmod(folderPath, 0o777).catch(() => undefined);
        }

        for (const file of files) {
          const relativePath = sanitizeWorkspacePath(file.path);

          if (!relativePath) {
            continue;
          }

          nextManagedPaths.add(relativePath);

          const absolutePath = join(terminal.workingDirectory, relativePath);
          await mkdir(dirname(absolutePath), { recursive: true, mode: 0o777 });
          await writeFile(absolutePath, file.content, "utf8");
          await chmod(absolutePath, 0o666).catch(() => undefined);
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

    await safeForceRemoveContainer(terminal.containerName);
    await removeDirectorySafe(terminal.workingDirectory);
  }
}
