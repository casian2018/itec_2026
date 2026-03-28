import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { runDockerExecution } from "./execution-runner.js";
import { RoomStore, type LeaveRoomResult } from "./room-store.js";
import type {
  AiBlock,
  AiBlockActionPayload,
  AiBlockCreatePayload,
  ClientToServerEvents,
  CursorUpdatePayload,
  ExecutionRunPayload,
  IdeThemeId,
  InterServerEvents,
  JoinRoomPayload,
  Participant,
  RoomSnapshot,
  ServerToClientEvents,
  SnapshotRestorePayload,
  SocketData,
  TerminalCommandPayload,
  TerminalEntry,
  WorkspaceFileLanguage,
  WorkspaceFileLanguagePayload,
  WorkspaceFileNode,
  WorkspaceFileUpdatePayload,
  WorkspaceNode,
  WorkspacePreviewState,
  WorkspacePreviewUpdatePayload,
  WorkspaceThemeUpdatePayload,
  WorkspaceViewUpdatePayload,
} from "./types.js";
import {
  executionRuntimeForLanguage,
  getWorkspaceFile,
  listWorkspaceFiles,
} from "./workspace.js";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";
const ALLOWED_ORIGINS = [CLIENT_URL, "http://127.0.0.1:3000"];
const SUPPORTED_IDE_THEMES: IdeThemeId[] = [
  "dark",
  "light",
  "github",
  "neon",
];

const app = express();
const httpServer = createServer(app);
const roomStore = new RoomStore();
const activeRunsByRoom = new Map<string, string>();

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
});

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "itecify-server",
    timestamp: new Date().toISOString(),
  });
});

function buildMockAiBlock(
  roomId: string,
  fileId: string,
  prompt: string,
  code: string,
): AiBlock {
  const normalizedPrompt = prompt.trim() || "Review the current workspace file.";
  const lines = code.split("\n");
  const insertAfterLine = Math.max(1, Math.min(lines.length, 8));
  const suffix = Math.random().toString(36).slice(2, 8);

  return {
    id: `aiblock_${Date.now()}_${suffix}`,
    roomId,
    fileId,
    code: `function applyAiSuggestion() {
  console.log("Prompt:", ${JSON.stringify(normalizedPrompt)});
}`,
    explanation:
      `Mocked AI block for the MVP. This suggestion targets the active file and inserts a contained helper after line ${insertAfterLine} so the team can review it like a patch.`,
    insertAfterLine,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

function clearCursorPresence(roomId: string, socketId: string) {
  io.to(roomId).emit("cursor:cleared", { socketId });
}

function normalizeRoomId(roomId: string) {
  return roomId.trim();
}

function normalizeParticipantName(name: string, socketId: string) {
  return name.trim() || `Guest-${socketId.slice(0, 4)}`;
}

function normalizeCode(code: string) {
  return code.replace(/\r\n/g, "\n");
}

function createRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isSocketInRoom(socketRoomId: string | undefined, roomId: string) {
  return Boolean(roomId) && socketRoomId === roomId;
}

function isSupportedWorkspaceLanguage(
  language: string,
): language is WorkspaceFileLanguage {
  return (
    language === "javascript" ||
    language === "python" ||
    language === "html" ||
    language === "css" ||
    language === "cpp" ||
    language === "json" ||
    language === "markdown" ||
    language === "plaintext"
  );
}

function isSupportedIdeTheme(theme: string): theme is IdeThemeId {
  return SUPPORTED_IDE_THEMES.includes(theme as IdeThemeId);
}

function isValidCursorPosition(position: CursorUpdatePayload["position"]) {
  return (
    Number.isInteger(position.lineNumber) &&
    Number.isInteger(position.column) &&
    position.lineNumber > 0 &&
    position.column > 0
  );
}

function createTerminalEntry(
  roomId: string,
  kind: TerminalEntry["kind"],
  text: string,
  authorName?: string,
): TerminalEntry {
  return {
    id: `terminal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    kind,
    text,
    createdAt: new Date().toISOString(),
    authorName,
  };
}

function emitParticipants(roomId: string, participants: Participant[]) {
  io.to(roomId).emit("room:participants", participants);
}

function emitSnapshotCreated(roomId: string, snapshot: RoomSnapshot) {
  io.to(roomId).emit("snapshot:created", { snapshot });
}

function emitTerminalEntry(roomId: string, entry: TerminalEntry) {
  io.to(roomId).emit("terminal:entry", { entry });
}

function emitWorkspaceView(
  roomId: string,
  activeFileId: string,
  openFileIds: string[],
) {
  io.to(roomId).emit("workspace:view", {
    roomId,
    activeFileId,
    openFileIds,
  });
}

function emitWorkspaceFileLanguage(
  roomId: string,
  fileId: string,
  language: WorkspaceFileLanguage,
) {
  io.to(roomId).emit("workspace:file:language", {
    roomId,
    fileId,
    language,
  });
}

function emitWorkspacePreview(roomId: string, preview: WorkspacePreviewState) {
  io.to(roomId).emit("workspace:preview", {
    roomId,
    preview,
  });
}

function emitWorkspaceTheme(roomId: string, theme: IdeThemeId) {
  io.to(roomId).emit("workspace:theme", {
    roomId,
    theme,
  });
}

function emitExecutionOutput(
  roomId: string,
  payload: Parameters<ServerToClientEvents["execution:output"]>[0],
) {
  io.to(roomId).emit("execution:output", payload);
  io.to(roomId).emit("run:output", payload);
}

function emitExecutionDone(
  roomId: string,
  payload: Parameters<ServerToClientEvents["execution:done"]>[0],
) {
  io.to(roomId).emit("execution:done", payload);
  io.to(roomId).emit("run:done", payload);
}

function appendTerminalEntry(roomId: string, entry: TerminalEntry) {
  const createdEntry = roomStore.addTerminalEntry(roomId, entry);

  if (createdEntry) {
    emitTerminalEntry(roomId, createdEntry);
  }
}

function appendExecutionLifecycleEntry(
  roomId: string,
  kind: TerminalEntry["kind"],
  text: string,
) {
  appendTerminalEntry(roomId, createTerminalEntry(roomId, kind, text));
}

function emitExecutionFailure(roomId: string, runId: string, message: string) {
  appendExecutionLifecycleEntry(roomId, "stderr", message);

  emitExecutionOutput(roomId, {
    roomId,
    runId,
    stream: "stderr",
    chunk: message,
    timestamp: new Date().toISOString(),
  });

  emitExecutionDone(roomId, {
    roomId,
    runId,
    status: "failed",
    exitCode: 1,
    finishedAt: new Date().toISOString(),
  });
}

function broadcastDeparture(result: LeaveRoomResult, socketId: string) {
  if (!result.roomId) {
    return;
  }

  clearCursorPresence(result.roomId, socketId);

  if (result.room) {
    emitParticipants(result.roomId, result.room.participants);
  }
}

function workspacePaths(nodes: WorkspaceNode[]) {
  return nodes
    .map((node) => node.path)
    .sort((left, right) => left.localeCompare(right));
}

function buildTerminalResponseEntries(
  room: ReturnType<RoomStore["getRoom"]>,
  roomId: string,
  command: string,
  authorName: string,
): TerminalEntry[] {
  if (!room) {
    return [
      createTerminalEntry(
        roomId,
        "stderr",
        "room state is not available for terminal commands",
      ),
    ];
  }

  const normalizedCommand = command.trim();
  const [baseCommand] = normalizedCommand.split(/\s+/);

  if (!baseCommand) {
    return [];
  }

  if (baseCommand === "help") {
    return [
      createTerminalEntry(
        roomId,
        "system",
        "Available demo commands: help, pwd, ls, whoami, status, participants, snapshots, preview, theme",
      ),
    ];
  }

  if (baseCommand === "pwd") {
    return [createTerminalEntry(roomId, "stdout", `/workspace/${room.roomId}`)];
  }

  if (baseCommand === "ls") {
    return [
      createTerminalEntry(
        roomId,
        "stdout",
        workspacePaths(room.workspace.nodes).join("\n"),
      ),
    ];
  }

  if (baseCommand === "whoami") {
    return [createTerminalEntry(roomId, "stdout", authorName)];
  }

  if (baseCommand === "status") {
    return [
      createTerminalEntry(
        roomId,
        "stdout",
        [
          `room=${room.roomId}`,
          `active_file=${room.workspace.activeFileId}`,
          `open_tabs=${room.workspace.openFileIds.length}`,
          `files=${listWorkspaceFiles(room.workspace).length}`,
          `participants=${room.participants.length}`,
          `ai_blocks=${room.aiBlocks.length}`,
          `snapshots=${room.snapshots.length}`,
          `preview_visible=${room.ui.preview.isVisible}`,
          `preview_target=${room.ui.preview.targetFileId ?? "none"}`,
          `theme=${room.ui.theme}`,
        ].join("\n"),
      ),
    ];
  }

  if (baseCommand === "participants") {
    return room.participants.length > 0
      ? room.participants.map((participant) =>
          createTerminalEntry(roomId, "stdout", participant.name),
        )
      : [createTerminalEntry(roomId, "stdout", "No participants connected.")];
  }

  if (baseCommand === "snapshots") {
    return room.snapshots.length > 0
      ? room.snapshots.slice(0, 6).map((snapshot) =>
          createTerminalEntry(
            roomId,
            "stdout",
            `${snapshot.label} (${new Date(snapshot.createdAt).toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
              },
            )})`,
          ),
        )
      : [createTerminalEntry(roomId, "stdout", "No snapshots available.")];
  }

  if (baseCommand === "preview") {
    return [
      createTerminalEntry(
        roomId,
        "stdout",
        `visible=${room.ui.preview.isVisible}\ntarget=${room.ui.preview.targetFileId ?? "none"}`,
      ),
    ];
  }

  if (baseCommand === "theme") {
    return [createTerminalEntry(roomId, "stdout", room.ui.theme)];
  }

  return [
    createTerminalEntry(
      roomId,
      "stderr",
      `command not allowed: ${normalizedCommand}`,
    ),
    createTerminalEntry(
      roomId,
      "system",
      "Try: help, pwd, ls, whoami, status, participants, snapshots, preview, theme",
    ),
  ];
}

io.on("connection", (socket) => {
  socket.on("room:join", (payload: JoinRoomPayload) => {
    const roomId = normalizeRoomId(payload.roomId);
    const participantName = normalizeParticipantName(payload.name, socket.id);

    if (!roomId) {
      return;
    }

    const joinResult = roomStore.joinRoom(roomId, socket.id, participantName);

    if (joinResult.previousRoomId) {
      socket.leave(joinResult.previousRoomId);
      broadcastDeparture(
        {
          roomId: joinResult.previousRoomId,
          room: joinResult.previousRoom,
          participant: joinResult.previousParticipant,
          deletedRoom: joinResult.deletedPreviousRoom,
        },
        socket.id,
      );
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.participantName = participantName;

    socket.emit("room:state", joinResult.room);
    emitParticipants(roomId, joinResult.room.participants);
  });

  socket.on(
    "workspace:file:update",
    ({ roomId, fileId, content }: WorkspaceFileUpdatePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedFileId = fileId.trim();
      const normalizedContent = normalizeCode(content);

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedFileId
      ) {
        return;
      }

      const updateResult = roomStore.updateFileContent(
        normalizedRoomId,
        normalizedFileId,
        normalizedContent,
      );

      if (!updateResult) {
        return;
      }

      socket.to(normalizedRoomId).emit("workspace:file:updated", {
        fileId: normalizedFileId,
        content: normalizedContent,
        updatedBy: socket.data.participantName ?? socket.id,
      });

      if (updateResult.snapshot) {
        emitSnapshotCreated(normalizedRoomId, updateResult.snapshot);
      }
    },
  );

  socket.on(
    "workspace:view:update",
    ({ roomId, activeFileId, openFileIds }: WorkspaceViewUpdatePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedActiveFileId = activeFileId.trim();
      const normalizedOpenFileIds = openFileIds.map((fileId) => fileId.trim());

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedActiveFileId
      ) {
        return;
      }

      const updateResult = roomStore.updateWorkspaceView(
        normalizedRoomId,
        normalizedActiveFileId,
        normalizedOpenFileIds,
      );

      if (!updateResult || !updateResult.changed) {
        return;
      }

      emitWorkspaceView(
        normalizedRoomId,
        updateResult.room.workspace.activeFileId,
        updateResult.room.workspace.openFileIds,
      );
    },
  );

  socket.on(
    "workspace:file:language",
    ({ roomId, fileId, language }: WorkspaceFileLanguagePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedFileId = fileId.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedFileId ||
        !isSupportedWorkspaceLanguage(language)
      ) {
        return;
      }

      const updateResult = roomStore.updateFileLanguage(
        normalizedRoomId,
        normalizedFileId,
        language,
      );

      if (!updateResult || !updateResult.changed) {
        return;
      }

      emitWorkspaceFileLanguage(normalizedRoomId, normalizedFileId, language);
    },
  );

  socket.on(
    "workspace:preview:update",
    ({ roomId, isVisible, targetFileId }: WorkspacePreviewUpdatePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedTargetFileId = targetFileId?.trim() ?? null;

      if (!isSocketInRoom(socket.data.roomId, normalizedRoomId)) {
        return;
      }

      const updateResult = roomStore.updateWorkspacePreview(normalizedRoomId, {
        isVisible,
        targetFileId: normalizedTargetFileId,
      });

      if (!updateResult || !updateResult.changed) {
        return;
      }

      emitWorkspacePreview(normalizedRoomId, updateResult.room.ui.preview);
    },
  );

  socket.on(
    "workspace:theme:update",
    ({ roomId, theme }: WorkspaceThemeUpdatePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !isSupportedIdeTheme(theme)
      ) {
        return;
      }

      const updateResult = roomStore.updateWorkspaceTheme(
        normalizedRoomId,
        theme,
      );

      if (!updateResult || !updateResult.changed) {
        return;
      }

      emitWorkspaceTheme(normalizedRoomId, updateResult.room.ui.theme);
    },
  );

  socket.on(
    "cursor:update",
    ({ roomId, fileId, position }: CursorUpdatePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedFileId = fileId.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedFileId ||
        !isValidCursorPosition(position)
      ) {
        return;
      }

      socket.to(normalizedRoomId).emit("cursor:updated", {
        socketId: socket.id,
        name: socket.data.participantName ?? socket.id,
        fileId: normalizedFileId,
        position,
      });
    },
  );

  async function handleExecutionRun({ roomId, fileId }: ExecutionRunPayload) {
    const normalizedRoomId = normalizeRoomId(roomId);
    const normalizedFileId = fileId?.trim();

    if (!isSocketInRoom(socket.data.roomId, normalizedRoomId)) {
      return;
    }

    const existingRunId = activeRunsByRoom.get(normalizedRoomId);

    if (existingRunId) {
      emitExecutionFailure(
        normalizedRoomId,
        createRunId(),
        "stderr: another run is already active for this room",
      );
      return;
    }

    const runId = createRunId();
    activeRunsByRoom.set(normalizedRoomId, runId);

    try {
      const room = roomStore.getRoom(normalizedRoomId);

      if (!room) {
        emitExecutionFailure(
          normalizedRoomId,
          runId,
          "stderr: room state was not available for execution",
        );
        return;
      }

      const targetFile = getWorkspaceFile(
        room.workspace,
        normalizedFileId ?? room.workspace.activeFileId,
      );

      if (!targetFile) {
        emitExecutionFailure(
          normalizedRoomId,
          runId,
          "stderr: no runnable file was selected for execution",
        );
        return;
      }

      if (!targetFile.content.trim()) {
        emitExecutionFailure(
          normalizedRoomId,
          runId,
          "stderr: the selected file is empty",
        );
        return;
      }

      const runtime =
        targetFile.executionRuntime ??
        executionRuntimeForLanguage(targetFile.language);

      if (!runtime) {
        emitExecutionFailure(
          normalizedRoomId,
          runId,
          `stderr: ${targetFile.language} files do not have an execution runtime yet`,
        );
        return;
      }

      const preRunSnapshot = roomStore.updateFileContent(
        normalizedRoomId,
        targetFile.id,
        targetFile.content,
        {
          snapshotLabel: `Pre-run checkpoint (${targetFile.name})`,
          forceSnapshot: true,
        },
      );

      if (preRunSnapshot?.snapshot) {
        emitSnapshotCreated(normalizedRoomId, preRunSnapshot.snapshot);
      }

      appendExecutionLifecycleEntry(
        normalizedRoomId,
        "system",
        `▶ Running ${targetFile.path} with ${runtime} runtime`,
      );

      const donePayload = await runDockerExecution({
        roomId: normalizedRoomId,
        runtime,
        code: targetFile.content,
        runId,
        onOutput: (payload) => {
          emitExecutionOutput(normalizedRoomId, payload);
          appendExecutionLifecycleEntry(
            normalizedRoomId,
            payload.stream,
            payload.chunk,
          );
        },
      });

      emitExecutionDone(normalizedRoomId, donePayload);
      appendExecutionLifecycleEntry(
        normalizedRoomId,
        donePayload.status === "completed" ? "system" : "stderr",
        donePayload.status === "completed"
          ? `✓ ${targetFile.path} finished with exit code ${donePayload.exitCode}`
          : `✕ ${targetFile.path} failed with exit code ${donePayload.exitCode}`,
      );
    } finally {
      if (activeRunsByRoom.get(normalizedRoomId) === runId) {
        activeRunsByRoom.delete(normalizedRoomId);
      }
    }
  }

  socket.on("execution:run", handleExecutionRun);
  socket.on("code:run", handleExecutionRun);

  socket.on(
    "ai:block:create",
    ({ roomId, fileId, prompt, code }: AiBlockCreatePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedFileId = fileId.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedFileId
      ) {
        return;
      }

      const block = buildMockAiBlock(
        normalizedRoomId,
        normalizedFileId,
        prompt.trim(),
        normalizeCode(code),
      );
      const createdBlock = roomStore.addAiBlock(normalizedRoomId, block);

      if (!createdBlock) {
        return;
      }

      io.to(normalizedRoomId).emit("ai:block:created", {
        block: createdBlock,
      });
    },
  );

  socket.on("ai:block:accept", ({ roomId, blockId }: AiBlockActionPayload) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    const normalizedBlockId = blockId.trim();

    if (
      !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
      !normalizedBlockId
    ) {
      return;
    }

    const acceptResult = roomStore.acceptAiBlock(
      normalizedRoomId,
      normalizedBlockId,
    );

    if (!acceptResult) {
      return;
    }

    io.to(normalizedRoomId).emit("ai:block:updated", {
      block: acceptResult.block,
    });

    if (acceptResult.snapshot) {
      emitSnapshotCreated(normalizedRoomId, acceptResult.snapshot);
    }

    if (acceptResult.inserted) {
      const targetFile = getWorkspaceFile(
        acceptResult.room.workspace,
        acceptResult.block.fileId,
      );

      if (targetFile) {
        io.to(normalizedRoomId).emit("workspace:file:updated", {
          fileId: targetFile.id,
          content: targetFile.content,
          updatedBy: socket.data.participantName ?? socket.id,
        });
      }
    }
  });

  socket.on("ai:block:reject", ({ roomId, blockId }: AiBlockActionPayload) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    const normalizedBlockId = blockId.trim();

    if (
      !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
      !normalizedBlockId
    ) {
      return;
    }

    const rejectResult = roomStore.rejectAiBlock(
      normalizedRoomId,
      normalizedBlockId,
    );

    if (!rejectResult) {
      return;
    }

    io.to(normalizedRoomId).emit("ai:block:updated", {
      block: rejectResult.block,
    });
  });

  socket.on(
    "snapshot:restore",
    ({ roomId, snapshotId }: SnapshotRestorePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedSnapshotId = snapshotId.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedSnapshotId
      ) {
        return;
      }

      const restoreResult = roomStore.restoreSnapshot(
        normalizedRoomId,
        normalizedSnapshotId,
      );

      if (!restoreResult || !restoreResult.changed) {
        return;
      }

      io.to(normalizedRoomId).emit("room:state", restoreResult.room);

      if (restoreResult.createdSnapshot) {
        emitSnapshotCreated(normalizedRoomId, restoreResult.createdSnapshot);
      }
    },
  );

  socket.on(
    "terminal:command",
    ({ roomId, command }: TerminalCommandPayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedCommand = command.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedCommand
      ) {
        return;
      }

      const room = roomStore.getRoom(normalizedRoomId);
      const authorName = socket.data.participantName ?? socket.id;

      appendTerminalEntry(
        normalizedRoomId,
        createTerminalEntry(
          normalizedRoomId,
          "command",
          `$ ${normalizedCommand}`,
          authorName,
        ),
      );

      const responseEntries = buildTerminalResponseEntries(
        room,
        normalizedRoomId,
        normalizedCommand,
        authorName,
      );

      for (const entry of responseEntries) {
        appendTerminalEntry(normalizedRoomId, entry);
      }
    },
  );

  socket.on("disconnect", () => {
    const leaveResult = roomStore.leaveRoomBySocket(socket.id);
    broadcastDeparture(leaveResult, socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`iTECify server listening on http://localhost:${PORT}`);
});
