import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { RoomStore, type LeaveRoomResult } from "./room-store.js";
import type {
  AiBlock,
  AiBlockActionPayload,
  AiBlockCreatePayload,
  ClientToServerEvents,
  CodeUpdatePayload,
  CursorUpdatePayload,
  InterServerEvents,
  JoinRoomPayload,
  Participant,
  ServerToClientEvents,
  SocketData,
} from "./types.js";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";
const ALLOWED_ORIGINS = [CLIENT_URL, "http://127.0.0.1:3000"];

const app = express();
const httpServer = createServer(app);
const roomStore = new RoomStore();

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
  prompt: string,
  code: string,
): AiBlock {
  const normalizedPrompt = prompt.trim() || "Review the current workspace.";
  const lines = code.split("\n");
  const insertAfterLine = Math.max(1, Math.min(lines.length, 8));
  const suffix = Math.random().toString(36).slice(2, 8);

  return {
    id: `aiblock_${Date.now()}_${suffix}`,
    roomId,
    code: `function applyAiSuggestion() {
  console.log("Prompt:", ${JSON.stringify(normalizedPrompt)});
}`,
    explanation:
      `Mocked AI block for the MVP. This suggestion adds a small helper stub after line ${insertAfterLine} so the team can review a contained change before wiring real model output.`,
    insertAfterLine,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

function clearCursorPresence(roomId: string, socketId: string) {
  io.to(roomId).emit("cursor:cleared", { socketId });
}

function broadcastParticipants(roomId: string, participants: Participant[]) {
  io.to(roomId).emit("room:participants", participants);
}

function broadcastDeparture(result: LeaveRoomResult, socketId: string) {
  if (!result.roomId) {
    return;
  }

  clearCursorPresence(result.roomId, socketId);

  if (result.room) {
    broadcastParticipants(result.roomId, result.room.participants);
  }
}

function isSocketInRoom(socketRoomId: string | undefined, roomId: string) {
  return Boolean(roomId) && socketRoomId === roomId;
}

io.on("connection", (socket) => {
  socket.on("room:join", (payload: JoinRoomPayload) => {
    const roomId = payload.roomId.trim();
    const participantName =
      payload.name.trim() || `Guest-${socket.id.slice(0, 4)}`;

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
    broadcastParticipants(roomId, joinResult.room.participants);
  });

  socket.on("code:update", ({ roomId, code }: CodeUpdatePayload) => {
    if (!isSocketInRoom(socket.data.roomId, roomId)) {
      return;
    }

    const room = roomStore.updateCode(roomId, code);

    if (!room) {
      return;
    }

    socket.to(roomId).emit("code:updated", {
      code: room.code,
      updatedBy: socket.data.participantName ?? socket.id,
    });
  });

  socket.on("cursor:update", ({ roomId, position }: CursorUpdatePayload) => {
    if (!isSocketInRoom(socket.data.roomId, roomId)) {
      return;
    }

    socket.to(roomId).emit("cursor:updated", {
      socketId: socket.id,
      name: socket.data.participantName ?? socket.id,
      position,
    });
  });

  socket.on("ai:block:create", ({ roomId, prompt, code }: AiBlockCreatePayload) => {
    if (!isSocketInRoom(socket.data.roomId, roomId)) {
      return;
    }

    const block = buildMockAiBlock(roomId, prompt, code);
    const createdBlock = roomStore.addAiBlock(roomId, block);

    if (!createdBlock) {
      return;
    }

    io.to(roomId).emit("ai:block:created", {
      block: createdBlock,
    });
  });

  socket.on("ai:block:accept", ({ roomId, blockId }: AiBlockActionPayload) => {
    if (!isSocketInRoom(socket.data.roomId, roomId)) {
      return;
    }

    const acceptResult = roomStore.acceptAiBlock(roomId, blockId);

    if (!acceptResult) {
      return;
    }

    io.to(roomId).emit("ai:block:updated", {
      block: acceptResult.block,
    });

    if (acceptResult.inserted) {
      io.to(roomId).emit("code:updated", {
        code: acceptResult.room.code,
        updatedBy: socket.data.participantName ?? socket.id,
      });
    }
  });

  socket.on("ai:block:reject", ({ roomId, blockId }: AiBlockActionPayload) => {
    if (!isSocketInRoom(socket.data.roomId, roomId)) {
      return;
    }

    const rejectResult = roomStore.rejectAiBlock(roomId, blockId);

    if (!rejectResult) {
      return;
    }

    io.to(roomId).emit("ai:block:updated", {
      block: rejectResult.block,
    });
  });

  socket.on("disconnect", () => {
    const leaveResult = roomStore.leaveRoomBySocket(socket.id);
    socket.data.roomId = undefined;
    socket.data.participantName = undefined;
    broadcastDeparture(leaveResult, socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`iTECify server listening on http://localhost:${PORT}`);
});
