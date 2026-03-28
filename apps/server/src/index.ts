import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import multer from "multer";
import { Server } from "socket.io";
import {
  generateGeminiEditProposal,
  generateGeminiSuggestion,
} from "./ai/gemini-codegen.js";
import { createExecutionRunner } from "./execution/create-execution-runner.js";
import { ExecutionRouter } from "./execution/execution-router.js";
import { InMemoryExecutionState } from "./execution/in-memory-execution-state.js";
import { CExecutionService } from "./execution/services/c-execution-service.js";
import { CppExecutionService } from "./execution/services/cpp-execution-service.js";
import { HtmlPreviewExecutionService } from "./execution/services/html-preview-execution-service.js";
import { JavaScriptExecutionService } from "./execution/services/javascript-execution-service.js";
import {
  importWorkspaceFromZipBuffer,
  MAX_PROJECT_IMPORT_ENTRIES,
  MAX_PROJECT_IMPORT_TEXT_BYTES,
} from "./project-import.js";
import { PythonExecutionService } from "./execution/services/python-execution-service.js";
import { RoomStore, type LeaveRoomResult } from "./room-store.js";
import {
  generateSessionCode,
  isValidSessionCode,
  normalizeSessionCode,
} from "./session-code.js";
import { RoomTerminal } from "./terminal/room-terminal.js";
import { SessionTerminalManager } from "./terminal/session-terminal-manager.js";
import type {
  AiBlock,
  AiBlockActionPayload,
  AiBlockCreatePayload,
  AiEditProposal,
  AiSuggestionMode,
  ChatAuthorType,
  ChatMessage,
  ClientToServerEvents,
  CursorUpdatePayload,
  IdeThemeId,
  InterServerEvents,
  JoinRoomPayload,
  PrivateChatSendPayload,
  Participant,
  RoomSnapshot,
  SharedChatSendPayload,
  ServerToClientEvents,
  SnapshotRestorePayload,
  SocketData,
  AiProposalApplyPayload,
  AiProposalLineActionPayload,
  TerminalCommandPayload,
  TerminalClearPayload,
  TerminalEntry,
  TerminalInputPayload,
  TerminalResizePayload,
  WorkspaceCloseTabPayload,
  WorkspaceCreateFilePayload,
  WorkspaceCreateFolderPayload,
  WorkspaceDeletePayload,
  WorkspaceDuplicatePayload,
  WorkspaceFileLanguage,
  WorkspaceFileLanguagePayload,
  WorkspaceFormatPayload,
  WorkspaceMovePayload,
  WorkspaceFileUpdatePayload,
  WorkspacePreviewState,
  WorkspacePreviewUpdatePayload,
  WorkspaceRenamePayload,
  WorkspaceState,
  WorkspaceThemeUpdatePayload,
  WorkspaceViewUpdatePayload,
} from "./types.js";
import { getWorkspaceFile } from "./workspace.js";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";
const ALLOWED_ORIGINS = [CLIENT_URL, "http://127.0.0.1:3000"];
const SUPPORTED_IDE_THEMES: IdeThemeId[] = [
  "dark",
  "light",
  "github",
  "neon",
];
const MAX_PROJECT_ZIP_UPLOAD_BYTES = 50 * 1024 * 1024;

const app = express();
const httpServer = createServer(app);
const roomStore = new RoomStore();
const executionState = new InMemoryExecutionState();
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROJECT_ZIP_UPLOAD_BYTES,
    files: 1,
  },
});

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

app.post("/sessions", (_request, response) => {
  try {
    const roomId = generateSessionCode((candidate) => roomStore.hasRoom(candidate));
    const createdRoom = roomStore.createRoom(roomId);

    if (!createdRoom) {
      response.status(500).json({
        ok: false,
        error: "Failed to allocate an in-memory session.",
      });
      return;
    }

    response.status(201).json({
      ok: true,
      roomId: createdRoom.room.roomId,
      createdRoom: createdRoom.createdRoom,
      participantCount: createdRoom.room.participants.length,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to create a collaborative session.",
    });
  }
});

app.get("/sessions/:sessionCode", (request, response) => {
  const roomId = normalizeSessionCode(request.params.sessionCode ?? "");

  if (!isValidSessionCode(roomId)) {
    response.status(400).json({
      ok: false,
      error: "Session codes must be 6 uppercase characters.",
    });
    return;
  }

  const room = roomStore.getRoom(roomId);

  if (!room) {
    response.status(404).json({
      ok: false,
      error: "Session not found or no longer active.",
      roomId,
    });
    return;
  }

  response.json({
    ok: true,
    roomId: room.roomId,
    participantCount: room.participants.length,
    activeFileId: room.workspace.activeFileId,
    openTabCount: room.workspace.openFileIds.length,
    previewVisible: room.ui.preview.isVisible,
    theme: room.ui.theme,
  });
});

app.post("/sessions/:sessionCode/import", (request, response) => {
  const runZipUpload = zipUpload.single("archive") as unknown as (
    req: typeof request,
    res: typeof response,
    callback: (error?: unknown) => void,
  ) => void;

  runZipUpload(request, response, async (error) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({
        ok: false,
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? `ZIP upload exceeds ${Math.round(
                MAX_PROJECT_ZIP_UPLOAD_BYTES / 1024 / 1024,
              )} MB.`
            : "Unable to accept that ZIP upload.",
      });
      return;
    }

    if (error) {
      response.status(400).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to accept that ZIP upload.",
      });
      return;
    }

    const roomId = normalizeSessionCode(request.params.sessionCode ?? "");

    if (!isValidSessionCode(roomId)) {
      response.status(400).json({
        ok: false,
        error: "Session codes must be 6 uppercase characters.",
      });
      return;
    }

    const room = roomStore.getRoom(roomId) ?? roomStore.createRoom(roomId)?.room;

    if (!room) {
      response.status(500).json({
        ok: false,
        error: "Unable to prepare that session for ZIP import.",
      });
      return;
    }

    const archiveFile = (request as typeof request & { file?: Express.Multer.File }).file;

    if (!archiveFile || !archiveFile.originalname.toLowerCase().endsWith(".zip")) {
      response.status(400).json({
        ok: false,
        error: "Upload a .zip archive to import a project.",
      });
      return;
    }

    roomTerminal.appendText(
      roomId,
      "system",
      `Importing project ZIP ${archiveFile.originalname} into this session.`,
    );

    try {
      const importResult = await importWorkspaceFromZipBuffer(archiveFile.buffer, {
        maxEntries: MAX_PROJECT_IMPORT_ENTRIES,
        maxTextBytes: MAX_PROJECT_IMPORT_TEXT_BYTES,
      });
      const replaceResult = roomStore.replaceWorkspace(
        roomId,
        importResult.workspace,
        {
          snapshotLabel: `Imported ${archiveFile.originalname}`,
        },
      );

      if (!replaceResult) {
        response.status(404).json({
          ok: false,
          error: "Session not found while applying the imported project.",
        });
        return;
      }

      await sessionTerminalManager.syncWorkspace(
        roomId,
        replaceResult.room.workspace,
      );
      emitRoomState(replaceResult.room);

      roomTerminal.appendText(
        roomId,
        "system",
        [
          `Project import complete: ${importResult.summary.importedFileCount} files, ${importResult.summary.importedFolderCount} folders.`,
          importResult.summary.skippedCount > 0
            ? `Skipped ${importResult.summary.skippedCount} unsupported entries.`
            : "No entries were skipped.",
          importResult.summary.openedFilePath
            ? `Suggested file: ${importResult.summary.openedFilePath}.`
            : "The session is still empty until you create or upload editable files.",
        ].join(" "),
      );

      if (importResult.summary.warnings.length > 0) {
        const warningPreview = importResult.summary.warnings
          .slice(0, 8)
          .map((warning) => `- ${warning.path}: ${warning.reason}`)
          .join("\n");

        roomTerminal.appendText(
          roomId,
          "system",
          `ZIP import warnings:\n${warningPreview}${
            importResult.summary.warnings.length > 8 ? "\n- ..." : ""
          }`,
        );
      }

      response.status(201).json({
        ok: true,
        roomId,
        importedFileCount: importResult.summary.importedFileCount,
        importedFolderCount: importResult.summary.importedFolderCount,
        skippedCount: importResult.summary.skippedCount,
        openedFilePath: importResult.summary.openedFilePath,
      });
    } catch (importError) {
      const message =
        importError instanceof Error
          ? importError.message
          : "Unable to import that ZIP project.";

      roomTerminal.appendText(roomId, "system", `Project import failed: ${message}`);
      response.status(400).json({
        ok: false,
        error: message,
      });
    }
  });
});

function buildAiBlock(
  roomId: string,
  fileId: string,
  suggestion: {
    code: string;
    explanation: string;
    insertAfterLine: number;
    mode: AiSuggestionMode;
    applyMode: "insert" | "replace";
  },
): AiBlock {
  const suffix = Math.random().toString(36).slice(2, 8);

  return {
    id: `aiblock_${Date.now()}_${suffix}`,
    roomId,
    fileId,
    mode: suggestion.mode,
    applyMode: suggestion.applyMode,
    code: suggestion.code,
    explanation: suggestion.explanation,
    insertAfterLine: suggestion.insertAfterLine,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

function buildChatMessage({
  roomId,
  channel,
  authorType,
  authorName,
  content,
  userId,
  fileId,
}: {
  roomId: string;
  channel: ChatMessage["channel"];
  authorType: ChatAuthorType;
  authorName: string;
  content: string;
  userId?: string;
  fileId?: string | null;
}): ChatMessage {
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    channel,
    authorType,
    authorName,
    content,
    createdAt: new Date().toISOString(),
    userId,
    fileId: fileId ?? null,
  };
}

function buildAiEditProposal(
  roomId: string,
  userId: string,
  requesterName: string,
  file: NonNullable<ReturnType<typeof getWorkspaceFile>>,
  prompt: string,
  suggestion: Awaited<ReturnType<typeof generateGeminiEditProposal>>,
): AiEditProposal {
  const createdAt = new Date().toISOString();

  return {
    id: `aiproposal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    fileId: file.id,
    filePath: file.path,
    requesterUserId: userId,
    requesterName,
    prompt,
    explanation: suggestion.explanation,
    baseContent: file.content,
    status: "pending",
    changes: suggestion.changes.map((change) => ({
      id: `aichange_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...change,
      status: "pending",
    })),
    createdAt,
    appliedAt: null,
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

function normalizeUserId(userId: string | undefined, socketId: string) {
  return userId?.trim() || socketId;
}

function normalizeCode(code: string) {
  return code.replace(/\r\n/g, "\n");
}

function normalizeAiSuggestionMode(mode?: string): AiSuggestionMode {
  if (mode === "next-line" || mode === "optimize") {
    return mode;
  }

  return "assist";
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
    language === "typescript" ||
    language === "python" ||
    language === "c" ||
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

function emitParticipants(roomId: string, participants: Participant[]) {
  io.to(roomId).emit("room:participants", participants);
}

function emitSnapshotCreated(roomId: string, snapshot: RoomSnapshot) {
  io.to(roomId).emit("snapshot:created", { snapshot });
}

function emitTerminalEntry(roomId: string, entry: TerminalEntry) {
  io.to(roomId).emit("terminal:entry", { entry });
}

function emitTerminalHistoryInit(roomId: string, entries: TerminalEntry[]) {
  io.to(roomId).emit("terminal:history:init", {
    roomId,
    entries,
  });
}

function emitTerminalClear(roomId: string, clearedBy: string) {
  io.to(roomId).emit("terminal:clear", {
    roomId,
    clearedBy,
  });
}

function emitTerminalSystemMessage(roomId: string, entry: TerminalEntry) {
  io.to(roomId).emit("terminal:systemMessage", { entry });
}

function emitRoomState(room: Parameters<ServerToClientEvents["room:state"]>[0]) {
  io.to(room.roomId).emit("room:state", room);
}

function emitToUserInRoom<EventName extends keyof ServerToClientEvents>(
  roomId: string,
  userId: string,
  eventName: EventName,
  payload: Parameters<ServerToClientEvents[EventName]>[0],
) {
  const room = roomStore.getRoom(roomId);

  if (!room) {
    return;
  }

  const emittedSocketIds = new Set<string>();

  for (const participant of room.participants) {
    if (participant.userId !== userId || emittedSocketIds.has(participant.socketId)) {
      continue;
    }

    emittedSocketIds.add(participant.socketId);
    (io.to(participant.socketId).emit as (...args: unknown[]) => void)(
      eventName,
      payload,
    );
  }
}

function emitSharedChatMessage(roomId: string, message: ChatMessage) {
  io.to(roomId).emit("chat:shared:message", { message });
}

function emitPrivateChatInit(roomId: string, userId: string, messages: ChatMessage[]) {
  emitToUserInRoom(roomId, userId, "chat:private:init", {
    roomId,
    messages,
  });
}

function emitPrivateChatMessage(roomId: string, userId: string, message: ChatMessage) {
  emitToUserInRoom(roomId, userId, "chat:private:message", { message });
}

function emitAiProposalInit(roomId: string, userId: string, proposals: AiEditProposal[]) {
  emitToUserInRoom(roomId, userId, "ai:proposal:init", {
    roomId,
    proposals,
  });
}

function emitAiProposalCreated(roomId: string, userId: string, proposal: AiEditProposal) {
  emitToUserInRoom(roomId, userId, "ai:proposal:created", { proposal });
}

function emitAiProposalUpdated(roomId: string, userId: string, proposal: AiEditProposal) {
  emitToUserInRoom(roomId, userId, "ai:proposal:updated", { proposal });
}

function emitAiProposalError(roomId: string, userId: string, message: string) {
  emitToUserInRoom(roomId, userId, "ai:proposal:error", {
    roomId,
    message,
  });
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

function emitWorkspaceTree(
  roomId: string,
  workspace: WorkspaceState,
) {
  io.to(roomId).emit("workspace:tree", {
    workspace,
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

const roomTerminal = new RoomTerminal({
  roomStore,
  emitEntry: emitTerminalEntry,
  emitSystemMessage: emitTerminalSystemMessage,
  emitClear: emitTerminalClear,
});
const sessionTerminalManager = new SessionTerminalManager({
  roomStore,
  terminal: roomTerminal,
});

const executionRouter = new ExecutionRouter([
  new JavaScriptExecutionService(),
  new PythonExecutionService(),
  new CExecutionService(),
  new CppExecutionService(),
  new HtmlPreviewExecutionService(),
]);

const { handleExecutionRun } = createExecutionRunner({
  roomStore,
  terminal: roomTerminal,
  router: executionRouter,
  executionState,
  emitExecutionOutput,
  emitExecutionDone,
  emitWorkspacePreview,
  emitSnapshotCreated,
  createRunId,
});

function broadcastDeparture(result: LeaveRoomResult, socketId: string) {
  if (!result.roomId) {
    return;
  }

  clearCursorPresence(result.roomId, socketId);

  if (result.room) {
    emitParticipants(result.roomId, result.room.participants);
  }
}

io.on("connection", (socket) => {
  socket.on("room:join", async (payload: JoinRoomPayload) => {
    const roomId = normalizeRoomId(payload.roomId);
    const participantName = normalizeParticipantName(payload.name, socket.id);
    const userId = normalizeUserId(payload.userId, socket.id);

    if (!roomId) {
      return;
    }

    const joinResult = roomStore.joinRoom(roomId, socket.id, participantName, userId);

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

      if (joinResult.deletedPreviousRoom) {
        await sessionTerminalManager.destroyRoom(joinResult.previousRoomId);
      }
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.participantName = participantName;
    socket.data.userId = userId;

    await sessionTerminalManager.ensureRoomTerminal(roomId, joinResult.room.workspace);
    const hydratedRoom = roomStore.getRoom(roomId) ?? joinResult.room;

    socket.emit("room:state", hydratedRoom);
    socket.emit("chat:shared:init", {
      roomId,
      messages: roomStore.getSharedChatMessages(roomId),
    });
    emitPrivateChatInit(
      roomId,
      userId,
      roomStore.getPrivateChatMessages(roomId, userId),
    );
    emitAiProposalInit(
      roomId,
      userId,
      roomStore.getPrivateAiProposals(roomId, userId),
    );
    socket.emit("terminal:history:init", {
      roomId,
      entries: hydratedRoom.terminalEntries,
    });
    emitParticipants(roomId, hydratedRoom.participants);
  });

  socket.on(
    "workspace:file:update",
    async ({ roomId, fileId, content }: WorkspaceFileUpdatePayload) => {
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

      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        updateResult.room.workspace,
      );

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
        !isSocketInRoom(socket.data.roomId, normalizedRoomId)
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

  socket.on("execution:run", async ({ roomId, fileId }) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    const normalizedFileId = fileId?.trim();

    if (!isSocketInRoom(socket.data.roomId, normalizedRoomId)) {
      return;
    }

    await handleExecutionRun({
      roomId: normalizedRoomId,
      fileId: normalizedFileId,
    });
  });
  socket.on("code:run", async ({ roomId, fileId }) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    const normalizedFileId = fileId?.trim();

    if (!isSocketInRoom(socket.data.roomId, normalizedRoomId)) {
      return;
    }

    await handleExecutionRun({
      roomId: normalizedRoomId,
      fileId: normalizedFileId,
    });
  });

  socket.on("chat:shared:send", ({ roomId, content }: SharedChatSendPayload) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    const normalizedContent = content.trim();

    if (
      !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
      !normalizedContent
    ) {
      return;
    }

    const message = buildChatMessage({
      roomId: normalizedRoomId,
      channel: "shared",
      authorType: "user",
      authorName: socket.data.participantName ?? socket.id,
      content: normalizedContent,
      userId: socket.data.userId,
    });

    const createdMessage = roomStore.addSharedChatMessage(normalizedRoomId, message);

    if (!createdMessage) {
      return;
    }

    emitSharedChatMessage(normalizedRoomId, createdMessage);
  });

  socket.on(
    "chat:private:send",
    async ({ roomId, fileId, content }: PrivateChatSendPayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedFileId = fileId.trim();
      const normalizedContent = content.trim();
      const userId = socket.data.userId?.trim() ?? socket.id;

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedFileId ||
        !normalizedContent
      ) {
        return;
      }

      const room = roomStore.getRoom(normalizedRoomId);

      if (!room) {
        return;
      }

      const targetFile = getWorkspaceFile(room.workspace, normalizedFileId);

      if (!targetFile) {
        emitAiProposalError(
          normalizedRoomId,
          userId,
          "The active file was not found in this session.",
        );
        return;
      }

      const userMessage = buildChatMessage({
        roomId: normalizedRoomId,
        channel: "private",
        authorType: "user",
        authorName: socket.data.participantName ?? socket.id,
        content: normalizedContent,
        userId,
        fileId: targetFile.id,
      });

      roomStore.addPrivateChatMessage(normalizedRoomId, userId, userMessage);
      emitPrivateChatMessage(normalizedRoomId, userId, userMessage);

      try {
        const suggestion = await generateGeminiEditProposal({
          prompt: normalizedContent,
          file: targetFile,
          workspace: room.workspace,
        });
        const proposal = buildAiEditProposal(
          normalizedRoomId,
          userId,
          socket.data.participantName ?? socket.id,
          targetFile,
          normalizedContent,
          suggestion,
        );
        const createdProposal = roomStore.addPrivateAiProposal(
          normalizedRoomId,
          userId,
          proposal,
        );

        if (!createdProposal) {
          emitAiProposalError(
            normalizedRoomId,
            userId,
            "Unable to store the AI proposal for this session.",
          );
          return;
        }

        const aiMessage = buildChatMessage({
          roomId: normalizedRoomId,
          channel: "private",
          authorType: "ai",
          authorName: "Gemini",
          content: `I prepared ${createdProposal.changes.length} reviewable line changes for ${createdProposal.filePath}. Approve the changes you want, then apply them to the shared file.`,
          userId,
          fileId: targetFile.id,
        });

        roomStore.addPrivateChatMessage(normalizedRoomId, userId, aiMessage);
        emitPrivateChatMessage(normalizedRoomId, userId, aiMessage);
        emitAiProposalCreated(normalizedRoomId, userId, createdProposal);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Gemini failed to prepare a reviewable edit proposal.";
        const aiErrorMessage = buildChatMessage({
          roomId: normalizedRoomId,
          channel: "private",
          authorType: "system",
          authorName: "AI System",
          content: message,
          userId,
          fileId: normalizedFileId,
        });

        roomStore.addPrivateChatMessage(normalizedRoomId, userId, aiErrorMessage);
        emitPrivateChatMessage(normalizedRoomId, userId, aiErrorMessage);
        emitAiProposalError(normalizedRoomId, userId, message);
      }
    },
  );

  socket.on(
    "ai:proposal:approve-line",
    ({ roomId, proposalId, changeId }: AiProposalLineActionPayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedProposalId = proposalId.trim();
      const normalizedChangeId = changeId.trim();
      const userId = socket.data.userId?.trim() ?? socket.id;

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedProposalId ||
        !normalizedChangeId
      ) {
        return;
      }

      const result = roomStore.updatePrivateAiProposalLineStatus(
        normalizedRoomId,
        userId,
        normalizedProposalId,
        normalizedChangeId,
        "approved",
      );

      if (!result) {
        return;
      }

      emitAiProposalUpdated(normalizedRoomId, userId, result.proposal);
    },
  );

  socket.on(
    "ai:proposal:reject-line",
    ({ roomId, proposalId, changeId }: AiProposalLineActionPayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedProposalId = proposalId.trim();
      const normalizedChangeId = changeId.trim();
      const userId = socket.data.userId?.trim() ?? socket.id;

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedProposalId ||
        !normalizedChangeId
      ) {
        return;
      }

      const result = roomStore.updatePrivateAiProposalLineStatus(
        normalizedRoomId,
        userId,
        normalizedProposalId,
        normalizedChangeId,
        "rejected",
      );

      if (!result) {
        return;
      }

      emitAiProposalUpdated(normalizedRoomId, userId, result.proposal);
    },
  );

  socket.on(
    "ai:proposal:apply",
    async ({ roomId, proposalId }: AiProposalApplyPayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedProposalId = proposalId.trim();
      const userId = socket.data.userId?.trim() ?? socket.id;

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedProposalId
      ) {
        return;
      }

      const result = roomStore.applyPrivateAiProposal(
        normalizedRoomId,
        userId,
        normalizedProposalId,
      );

      if (!result) {
        return;
      }

      if (result.error) {
        const systemMessage = buildChatMessage({
          roomId: normalizedRoomId,
          channel: "private",
          authorType: "system",
          authorName: "AI System",
          content: result.error,
          userId,
          fileId: result.proposal.fileId,
        });

        roomStore.addPrivateChatMessage(normalizedRoomId, userId, systemMessage);
        emitPrivateChatMessage(normalizedRoomId, userId, systemMessage);
        emitAiProposalError(normalizedRoomId, userId, result.error);
        return;
      }

      emitAiProposalUpdated(normalizedRoomId, userId, result.proposal);

      if (result.snapshot) {
        emitSnapshotCreated(normalizedRoomId, result.snapshot);
      }

      if (!result.applied) {
        return;
      }

      const targetFile = getWorkspaceFile(
        result.room.workspace,
        result.proposal.fileId,
      );

      if (targetFile) {
        io.to(normalizedRoomId).emit("workspace:file:updated", {
          fileId: targetFile.id,
          content: targetFile.content,
          updatedBy: socket.data.participantName ?? socket.id,
        });
      }

      const confirmationMessage = buildChatMessage({
        roomId: normalizedRoomId,
        channel: "private",
        authorType: "ai",
        authorName: "Gemini",
        content: `Applied the approved AI changes to ${result.proposal.filePath}.`,
        userId,
        fileId: result.proposal.fileId,
      });

      roomStore.addPrivateChatMessage(normalizedRoomId, userId, confirmationMessage);
      emitPrivateChatMessage(normalizedRoomId, userId, confirmationMessage);
      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        result.room.workspace,
      );
    },
  );

  socket.on(
    "ai:block:create",
    async ({
      roomId,
      fileId,
      prompt,
      code,
      mode,
      cursorLine,
    }: AiBlockCreatePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedFileId = fileId.trim();
      const normalizedMode = normalizeAiSuggestionMode(mode);

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedFileId
      ) {
        return;
      }

      const room = roomStore.getRoom(normalizedRoomId);

      if (!room) {
        return;
      }

      const targetFile = getWorkspaceFile(room.workspace, normalizedFileId);

      if (!targetFile) {
        return;
      }

      const normalizedCode = normalizeCode(code);
      const effectiveFile = {
        ...targetFile,
        content: normalizedCode,
      };
      const effectiveWorkspace = {
        ...room.workspace,
        nodes: room.workspace.nodes.map((node) =>
          node.kind === "file" && node.id === effectiveFile.id
            ? effectiveFile
            : node,
        ),
      };

      roomTerminal.appendText(
        normalizedRoomId,
        "system",
        normalizedMode === "optimize"
          ? `Gemini is optimizing ${effectiveFile.path} and drafting a full-file rewrite block.`
          : normalizedMode === "next-line"
            ? `Gemini is predicting the next step for ${effectiveFile.path}.`
            : `Gemini is reviewing ${effectiveFile.path} and drafting a suggestion block.`,
      );

      try {
        const suggestion = await generateGeminiSuggestion({
          prompt: prompt.trim(),
          file: effectiveFile,
          workspace: effectiveWorkspace,
          mode: normalizedMode,
          cursorLine,
        });
        const block = buildAiBlock(
          normalizedRoomId,
          normalizedFileId,
          suggestion,
        );
        const createdBlock = roomStore.addAiBlock(normalizedRoomId, block);

        if (!createdBlock) {
          return;
        }

        io.to(normalizedRoomId).emit("ai:block:created", {
          block: createdBlock,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Gemini failed to generate a suggestion block.";

        roomTerminal.appendText(
          normalizedRoomId,
          "system",
          `AI request failed: ${message}`,
        );
        io.to(normalizedRoomId).emit("ai:block:error", {
          roomId: normalizedRoomId,
          message,
        });
      }
    },
  );

  socket.on("ai:block:accept", async ({ roomId, blockId }: AiBlockActionPayload) => {
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

    if (acceptResult.applied) {
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

      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        acceptResult.room.workspace,
      );
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
    async ({ roomId, snapshotId }: SnapshotRestorePayload) => {
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
      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        restoreResult.room.workspace,
      );

      if (restoreResult.createdSnapshot) {
        emitSnapshotCreated(normalizedRoomId, restoreResult.createdSnapshot);
      }
    },
  );

  socket.on(
    "terminal:command",
    async ({ roomId, command }: TerminalCommandPayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedCommand = command.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedCommand
      ) {
        return;
      }

      await sessionTerminalManager.runCommand(normalizedRoomId, normalizedCommand);
    },
  );

  socket.on("terminal:input", async ({ roomId, data }: TerminalInputPayload) => {
    const normalizedRoomId = normalizeRoomId(roomId);

    if (
      !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
      typeof data !== "string" ||
      data.length === 0
    ) {
      return;
    }

    await sessionTerminalManager.write(normalizedRoomId, data);
  });

  socket.on(
    "terminal:resize",
    ({ roomId, cols, rows }: TerminalResizePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);

      if (!isSocketInRoom(socket.data.roomId, normalizedRoomId)) {
        return;
      }

      sessionTerminalManager.resize(normalizedRoomId, cols, rows);
    },
  );

  socket.on("terminal:clear", async ({ roomId }: TerminalClearPayload) => {
    const normalizedRoomId = normalizeRoomId(roomId);

    if (!isSocketInRoom(socket.data.roomId, normalizedRoomId)) {
      return;
    }

    await sessionTerminalManager.clear(
      normalizedRoomId,
      socket.data.participantName ?? socket.id,
    );
  });

  socket.on(
    "workspace:create:file",
    async ({ roomId, parentId, name }: WorkspaceCreateFilePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedName = name.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedName
      ) {
        return;
      }

      const result = roomStore.createFile(
        normalizedRoomId,
        parentId,
        normalizedName,
      );

      if (!result || !result.changed || !result.file) {
        return;
      }

      emitWorkspaceTree(normalizedRoomId, result.room.workspace);
      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        result.room.workspace,
      );

      if (result.file) {
        emitWorkspaceView(
          normalizedRoomId,
          result.room.workspace.activeFileId,
          result.room.workspace.openFileIds,
        );
      }
    },
  );

  socket.on(
    "workspace:create:folder",
    async ({ roomId, parentId, name }: WorkspaceCreateFolderPayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedName = name.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedName
      ) {
        return;
      }

      const result = roomStore.createFolder(
        normalizedRoomId,
        parentId,
        normalizedName,
      );

      if (!result || !result.changed) {
        return;
      }

      emitWorkspaceTree(normalizedRoomId, result.room.workspace);
      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        result.room.workspace,
      );
    },
  );

  socket.on(
    "workspace:rename",
    async ({ roomId, nodeId, newName }: WorkspaceRenamePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedNodeId = nodeId.trim();
      const normalizedName = newName.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedNodeId ||
        !normalizedName
      ) {
        return;
      }

      const result = roomStore.renameNode(
        normalizedRoomId,
        normalizedNodeId,
        normalizedName,
      );

      if (!result || !result.changed) {
        return;
      }

      emitWorkspaceTree(normalizedRoomId, result.room.workspace);
      emitWorkspaceView(
        normalizedRoomId,
        result.room.workspace.activeFileId,
        result.room.workspace.openFileIds,
      );
      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        result.room.workspace,
      );
    },
  );

  socket.on(
    "workspace:delete",
    async ({ roomId, nodeId }: WorkspaceDeletePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedNodeId = nodeId.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedNodeId
      ) {
        return;
      }

      const result = roomStore.deleteNode(normalizedRoomId, normalizedNodeId);

      if (!result || !result.changed) {
        return;
      }

      emitWorkspaceTree(normalizedRoomId, result.room.workspace);
      emitWorkspaceView(
        normalizedRoomId,
        result.room.workspace.activeFileId,
        result.room.workspace.openFileIds,
      );
      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        result.room.workspace,
      );
    },
  );

  socket.on(
    "workspace:duplicate",
    async ({ roomId, nodeId }: WorkspaceDuplicatePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedNodeId = nodeId.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedNodeId
      ) {
        return;
      }

      const result = roomStore.duplicateNode(normalizedRoomId, normalizedNodeId);

      if (!result || !result.changed) {
        return;
      }

      emitWorkspaceTree(normalizedRoomId, result.room.workspace);
      emitWorkspaceView(
        normalizedRoomId,
        result.room.workspace.activeFileId,
        result.room.workspace.openFileIds,
      );
      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        result.room.workspace,
      );
    },
  );

  socket.on(
    "workspace:move",
    async ({ roomId, nodeId, targetParentId }: WorkspaceMovePayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedNodeId = nodeId.trim();
      const normalizedTargetParentId = targetParentId?.trim() || null;

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedNodeId
      ) {
        return;
      }

      const result = roomStore.moveNode(
        normalizedRoomId,
        normalizedNodeId,
        normalizedTargetParentId,
      );

      if (!result || !result.changed) {
        return;
      }

      emitWorkspaceTree(normalizedRoomId, result.room.workspace);
      emitWorkspaceView(
        normalizedRoomId,
        result.room.workspace.activeFileId,
        result.room.workspace.openFileIds,
      );
      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        result.room.workspace,
      );
    },
  );

  socket.on(
    "workspace:file:format",
    async ({ roomId, fileId }: WorkspaceFormatPayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedFileId = fileId.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedFileId
      ) {
        return;
      }

      const result = await roomStore.formatFile(
        normalizedRoomId,
        normalizedFileId,
      );

      if (!result) {
        return;
      }

      if (result.error) {
        roomTerminal.appendText(
          normalizedRoomId,
          "system",
          `Format failed for ${result.file.name}: ${result.error}`,
        );
        return;
      }

      if (!result.changed) {
        return;
      }

      emitWorkspaceTree(normalizedRoomId, result.room.workspace);
      io.to(normalizedRoomId).emit("workspace:file:updated", {
        fileId: normalizedFileId,
        content: result.file.content,
        updatedBy: socket.data.participantName ?? socket.id,
      });
      await sessionTerminalManager.syncWorkspace(
        normalizedRoomId,
        result.room.workspace,
      );
    },
  );

  socket.on(
    "workspace:tab:close",
    ({ roomId, fileId }: WorkspaceCloseTabPayload) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const normalizedFileId = fileId.trim();

      if (
        !isSocketInRoom(socket.data.roomId, normalizedRoomId) ||
        !normalizedFileId
      ) {
        return;
      }

      const result = roomStore.closeTab(normalizedRoomId, normalizedFileId);

      if (!result || !result.changed) {
        return;
      }

      io.to(normalizedRoomId).emit("workspace:tab:closed", {
        fileId: normalizedFileId,
        activeFileId: result.room.workspace.activeFileId,
        openFileIds: result.room.workspace.openFileIds,
      });
    },
  );

  socket.on("disconnect", () => {
    const leaveResult = roomStore.leaveRoomBySocket(socket.id);
    broadcastDeparture(leaveResult, socket.id);

    if (leaveResult.deletedRoom && leaveResult.roomId) {
      void sessionTerminalManager.destroyRoom(leaveResult.roomId);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`iTECify server listening on http://localhost:${PORT}`);
});
