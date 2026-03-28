import type { RoomStore } from "../room-store.js";
import type {
  ExecutionRunPayload,
  RoomSnapshot,
  RunDonePayload,
  RunOutputPayload,
  WorkspacePreviewState,
} from "../types.js";
import { getWorkspaceFile } from "../workspace.js";
import { ExecutionRouter } from "./execution-router.js";
import { InMemoryExecutionState } from "./in-memory-execution-state.js";
import { RoomTerminal } from "../terminal/room-terminal.js";

type ExecutionRunnerDependencies = {
  roomStore: Pick<RoomStore, "getRoom" | "updateFileContent" | "updateWorkspacePreview">;
  terminal: RoomTerminal;
  router: ExecutionRouter;
  executionState: InMemoryExecutionState;
  emitExecutionOutput: (roomId: string, payload: RunOutputPayload) => void;
  emitExecutionDone: (roomId: string, payload: RunDonePayload) => void;
  emitWorkspacePreview: (roomId: string, preview: WorkspacePreviewState) => void;
  emitSnapshotCreated: (roomId: string, snapshot: RoomSnapshot) => void;
  createRunId: () => string;
};

function buildDonePayload(
  roomId: string,
  runId: string,
  status: RunDonePayload["status"],
  exitCode: number,
): RunDonePayload {
  return {
    roomId,
    runId,
    status,
    exitCode,
    finishedAt: new Date().toISOString(),
  };
}

export function createExecutionRunner({
  roomStore,
  terminal,
  router,
  executionState,
  emitExecutionOutput,
  emitExecutionDone,
  emitWorkspacePreview,
  emitSnapshotCreated,
  createRunId,
}: ExecutionRunnerDependencies) {
  async function handleExecutionRun({ roomId, fileId }: ExecutionRunPayload) {
    const normalizedFileId = fileId?.trim();
    const room = roomStore.getRoom(roomId);

    if (!room) {
      return;
    }

    const targetFile = getWorkspaceFile(
      room.workspace,
      normalizedFileId ?? room.workspace.activeFileId,
    );

    if (!targetFile) {
      terminal.appendText(
        roomId,
        "stderr",
        "stderr: no runnable file was selected for execution",
      );
      return;
    }

    const route = router.route(targetFile);

    if (route.kind === "unsupported") {
      terminal.appendText(roomId, "system", route.message);
      return;
    }

    if (!route.service.runtime) {
      const previewResult = await route.service.execute({
        roomId,
        runId: createRunId(),
        file: targetFile,
        onOutput: () => {
          // Preview services do not stream runtime output.
        },
      });

      if (previewResult.kind === "preview") {
        const previewUpdate = roomStore.updateWorkspacePreview(roomId, previewResult.preview);

        emitWorkspacePreview(
          roomId,
          previewUpdate?.room.ui.preview ?? previewResult.preview,
        );

        terminal.appendText(roomId, "system", previewResult.message);
      }

      return;
    }

    const runId = createRunId();

    if (!executionState.tryStartRun(roomId, runId)) {
      const blockedRunId = createRunId();
      const donePayload = buildDonePayload(roomId, blockedRunId, "failed", 1);
      const message = "stderr: another run is already active for this room";

      terminal.appendText(roomId, "stderr", message);
      emitExecutionOutput(roomId, {
        roomId,
        runId: blockedRunId,
        stream: "stderr",
        chunk: message,
        timestamp: new Date().toISOString(),
      });
      emitExecutionDone(roomId, donePayload);
      return;
    }

    try {
      const preRunSnapshot = roomStore.updateFileContent(
        roomId,
        targetFile.id,
        targetFile.content,
        {
          snapshotLabel: `Pre-run checkpoint (${targetFile.name})`,
          forceSnapshot: true,
        },
      );

      if (preRunSnapshot?.snapshot) {
        emitSnapshotCreated(roomId, preRunSnapshot.snapshot);
      }

      terminal.appendText(
        roomId,
        "system",
        `▶ Running ${targetFile.path} through ${route.service.label}`,
      );

      const result = await route.service.execute({
        roomId,
        runId,
        file: targetFile,
        onOutput: (payload) => {
          emitExecutionOutput(roomId, payload);
          terminal.appendText(roomId, payload.stream, payload.chunk);
        },
      });

      if (result.kind !== "run") {
        const mismatchPayload = buildDonePayload(roomId, runId, "failed", 1);
        emitExecutionDone(roomId, mismatchPayload);
        terminal.appendText(
          roomId,
          "stderr",
          `✕ ${targetFile.path} resolved to an invalid execution result`,
        );
        return;
      }

      emitExecutionDone(roomId, result.done);
      terminal.appendText(
        roomId,
        result.done.status === "completed" ? "system" : "stderr",
        result.done.status === "completed"
          ? `✓ ${targetFile.path} finished with exit code ${result.done.exitCode}`
          : `✕ ${targetFile.path} failed with exit code ${result.done.exitCode}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? `stderr: execution failed unexpectedly - ${error.message}`
          : "stderr: execution failed unexpectedly";
      const donePayload = buildDonePayload(roomId, runId, "failed", 1);

      terminal.appendText(roomId, "stderr", message);
      emitExecutionOutput(roomId, {
        roomId,
        runId,
        stream: "stderr",
        chunk: message,
        timestamp: new Date().toISOString(),
      });
      emitExecutionDone(roomId, donePayload);
    } finally {
      executionState.finishRun(roomId, runId);
    }
  }

  return {
    handleExecutionRun,
  };
}
