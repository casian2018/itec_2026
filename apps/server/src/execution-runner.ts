import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  ExecutionRuntime,
  RunDonePayload,
  RunOutputPayload,
  RunOutputStream,
} from "./types.js";

type ExecutionOptions = {
  roomId: string;
  runtime: ExecutionRuntime;
  code: string;
  runId: string;
  onOutput: (payload: RunOutputPayload) => void;
};

type ExecutionTarget = {
  image: string;
  entryFileName: string;
  command: string[];
};

const EXECUTION_TIMEOUT_MS = 10_000;
const CONTAINER_WORKDIR = "/workspace";
const DOCKER_MEMORY_LIMIT = "128m";
const DOCKER_CPU_LIMIT = "0.5";
const DOCKER_PIDS_LIMIT = "64";
const EXECUTION_TARGETS: Partial<Record<ExecutionRuntime, ExecutionTarget>> = {
  javascript: {
    image: "node:20-alpine",
    entryFileName: "index.js",
    command: ["node", "index.js"],
  },
  python: {
    image: "python:3.11-alpine",
    entryFileName: "main.py",
    command: ["python", "main.py"],
  },
  cpp: {
    image: "gcc:13-bookworm",
    entryFileName: "main.cpp",
    command: [
      "sh",
      "-lc",
      "cp /workspace/main.cpp /tmp/main.cpp && g++ -std=c++17 -O2 /tmp/main.cpp -o /tmp/app && /tmp/app",
    ],
  },
};

function buildChunk(
  roomId: string,
  runId: string,
  stream: RunOutputStream,
  chunk: string,
): RunOutputPayload {
  return {
    roomId,
    runId,
    stream,
    chunk,
    timestamp: new Date().toISOString(),
  };
}

async function safeRemoveRunDirectory(runDirectory: string | null) {
  if (!runDirectory) {
    return;
  }

  try {
    await rm(runDirectory, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup for hackathon execution paths.
  }
}

async function safeForceRemoveContainer(containerName: string) {
  try {
    const removeProcess = spawn("docker", ["rm", "-f", containerName], {
      stdio: "ignore",
    });

    await once(removeProcess, "close");
  } catch {
    // Best-effort cleanup for hackathon execution paths.
  }
}

function stopDockerRun(child: ChildProcess, containerName: string | null) {
  if (containerName) {
    void safeForceRemoveContainer(containerName);
  }

  child.kill("SIGTERM");

  setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }, 500).unref();
}

async function emitAndCleanupFailure(
  roomId: string,
  runId: string,
  containerName: string | null,
  runDirectory: string | null,
  onOutput: (payload: RunOutputPayload) => void,
  error: unknown,
): Promise<RunDonePayload> {
  const message =
    error instanceof Error
      ? error.message
      : "Execution failed before the process could start.";

  onOutput(
    buildChunk(
      roomId,
      runId,
      "stderr",
      `stderr: failed to prepare Docker execution - ${message}`,
    ),
  );

  if (containerName) {
    await safeForceRemoveContainer(containerName);
  }

  await safeRemoveRunDirectory(runDirectory);

  return {
    roomId,
    runId,
    status: "failed",
    exitCode: 1,
    finishedAt: new Date().toISOString(),
  };
}

export async function runDockerExecution({
  roomId,
  runtime,
  code,
  runId,
  onOutput,
}: ExecutionOptions): Promise<RunDonePayload> {
  const executionTarget = EXECUTION_TARGETS[runtime];

  if (!executionTarget) {
    onOutput(
      buildChunk(
        roomId,
        runId,
        "stderr",
        `stderr: ${runtime} execution is not wired yet in this MVP`,
      ),
    );

    return {
      roomId,
      runId,
      status: "failed",
      exitCode: 1,
      finishedAt: new Date().toISOString(),
    };
  }

  let runDirectory: string | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let containerName: string | null = null;

  try {
    runDirectory = await mkdtemp(join(tmpdir(), "itecify-run-"));
    const entryFilePath = join(runDirectory, executionTarget.entryFileName);
    await writeFile(entryFilePath, code, "utf8");
    containerName = `itecify-${runId}`.replace(/[^a-zA-Z0-9_.-]/g, "-");

    const dockerArgs = [
      "run",
      "--rm",
      "--name",
      containerName,
      "--network",
      "none",
      "--memory",
      DOCKER_MEMORY_LIMIT,
      "--cpus",
      DOCKER_CPU_LIMIT,
      "--pids-limit",
      DOCKER_PIDS_LIMIT,
      "-v",
      `${runDirectory}:${CONTAINER_WORKDIR}:ro`,
      "-w",
      CONTAINER_WORKDIR,
      executionTarget.image,
      ...executionTarget.command,
    ];

    const child = spawn("docker", dockerArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let timedOut = false;

    onOutput(
      buildChunk(
        roomId,
        runId,
        "stdout",
        `runtime: executing ${runtime} inside Docker (${executionTarget.image})`,
      ),
    );

    child.stdout?.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString("utf8").trimEnd();

      if (!text) {
        return;
      }

      onOutput(buildChunk(roomId, runId, "stdout", text));
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString("utf8").trimEnd();

      if (!text) {
        return;
      }

      onOutput(buildChunk(roomId, runId, "stderr", text));
    });

    child.on("error", (error) => {
      onOutput(
        buildChunk(
          roomId,
          runId,
          "stderr",
          `stderr: failed to start Docker process - ${error.message}`,
        ),
      );
    });

    timeout = setTimeout(() => {
      timedOut = true;
      onOutput(
        buildChunk(
          roomId,
          runId,
          "stderr",
          `stderr: execution timed out after ${EXECUTION_TIMEOUT_MS / 1000} seconds`,
        ),
      );
      stopDockerRun(child, containerName);
    }, EXECUTION_TIMEOUT_MS);

    const [exitCode, signal] = (await once(child, "close")) as [
      number | null,
      NodeJS.Signals | null,
    ];

    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }

    if (timedOut) {
      return {
        roomId,
        runId,
        status: "failed",
        exitCode: 124,
        finishedAt: new Date().toISOString(),
      };
    }

    if (signal) {
      onOutput(
        buildChunk(
          roomId,
          runId,
          "stderr",
          `stderr: execution terminated by signal ${signal}`,
        ),
      );

      return {
        roomId,
        runId,
        status: "failed",
        exitCode: 1,
        finishedAt: new Date().toISOString(),
      };
    }

    return {
      roomId,
      runId,
      status: exitCode === 0 ? "completed" : "failed",
      exitCode: exitCode ?? 1,
      finishedAt: new Date().toISOString(),
    };
  } catch (error) {
    return emitAndCleanupFailure(
      roomId,
      runId,
      containerName,
      runDirectory,
      onOutput,
      error,
    );
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }

    if (containerName) {
      await safeForceRemoveContainer(containerName);
    }

    await safeRemoveRunDirectory(runDirectory);
  }
}
