import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  ExecutionService,
  ExecutionServiceContext,
  RuntimeExecutionResult,
} from "../contracts.js";
import type { ExecutionRuntime, RunOutputPayload, RunOutputStream } from "../../types.js";

type DockerExecutionConfig = {
  id: string;
  label: string;
  runtime: ExecutionRuntime;
  supportedExtensions: readonly string[];
  image: string;
  entryFileName: string;
  command: string[];
};

const EXECUTION_TIMEOUT_MS = 10_000;
const CONTAINER_WORKDIR = "/workspace";
const DOCKER_MEMORY_LIMIT = "128m";
const DOCKER_CPU_LIMIT = "0.5";
const DOCKER_PIDS_LIMIT = "64";
const EXECUTION_TMP_ROOT =
  process.env.ITECIFY_EXECUTION_TMP_ROOT?.trim() || tmpdir();

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
    // Best-effort temp directory cleanup.
  }
}

async function createRunDirectory() {
  await mkdir(EXECUTION_TMP_ROOT, { recursive: true });
  return mkdtemp(join(EXECUTION_TMP_ROOT, "itecify-run-"));
}

async function safeForceRemoveContainer(containerName: string | null) {
  if (!containerName) {
    return;
  }

  try {
    const removeProcess = spawn("docker", ["rm", "-f", containerName], {
      stdio: "ignore",
    });

    await once(removeProcess, "close");
  } catch {
    // Best-effort container cleanup.
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

export abstract class DockerExecutionService implements ExecutionService {
  readonly id: string;
  readonly label: string;
  readonly runtime: ExecutionRuntime;
  readonly supportedExtensions: readonly string[];
  private readonly image: string;
  private readonly entryFileName: string;
  private readonly command: string[];

  protected constructor(config: DockerExecutionConfig) {
    this.id = config.id;
    this.label = config.label;
    this.runtime = config.runtime;
    this.supportedExtensions = config.supportedExtensions;
    this.image = config.image;
    this.entryFileName = config.entryFileName;
    this.command = config.command;
  }

  async execute({
    roomId,
    runId,
    file,
    onOutput,
  }: ExecutionServiceContext): Promise<RuntimeExecutionResult> {
    let runDirectory: string | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let containerName: string | null = null;

    try {
      runDirectory = await createRunDirectory();
      await writeFile(join(runDirectory, this.entryFileName), file.content, "utf8");

      containerName = `itecify-${runId}`.replace(/[^a-zA-Z0-9_.-]/g, "-");

      const child = spawn(
        "docker",
        [
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
          this.image,
          ...this.command,
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let timedOut = false;

      onOutput(
        buildChunk(
          roomId,
          runId,
          "stdout",
          `runtime: executing ${file.path} with ${this.label} in Docker (${this.image})`,
        ),
      );

      child.stdout?.on("data", (chunk: Buffer | string) => {
        const text = chunk.toString("utf8").trimEnd();

        if (text) {
          onOutput(buildChunk(roomId, runId, "stdout", text));
        }
      });

      child.stderr?.on("data", (chunk: Buffer | string) => {
        const text = chunk.toString("utf8").trimEnd();

        if (text) {
          onOutput(buildChunk(roomId, runId, "stderr", text));
        }
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
      timeout.unref();

      const [exitCode] = (await once(child, "close")) as [number | null];

      if (timeout) {
        clearTimeout(timeout);
      }

      await safeRemoveRunDirectory(runDirectory);

      return {
        kind: "run",
        done: {
          roomId,
          runId,
          status: timedOut || exitCode !== 0 ? "failed" : "completed",
          exitCode: timedOut ? 124 : exitCode ?? 1,
          finishedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
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

      await safeForceRemoveContainer(containerName);
      await safeRemoveRunDirectory(runDirectory);

      return {
        kind: "run",
        done: {
          roomId,
          runId,
          status: "failed",
          exitCode: 1,
          finishedAt: new Date().toISOString(),
        },
      };
    }
  }
}
