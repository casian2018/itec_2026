import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { RoomStore } from "./room-store.js";
import type {
  ClientToServerEvents,
  CodeUpdatePayload,
  InterServerEvents,
  JoinRoomPayload,
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

io.on("connection", (socket) => {
  socket.on("room:join", (payload: JoinRoomPayload) => {
    const roomId = payload.roomId.trim();
    const participantName = payload.name.trim() || `Guest-${socket.id.slice(0, 4)}`;

    if (!roomId) {
      return;
    }

    const previousMembership = roomStore.removeParticipant(socket.id);

    if (previousMembership.roomId) {
      socket.leave(previousMembership.roomId);

      if (previousMembership.room) {
        io.to(previousMembership.roomId).emit(
          "room:participants",
          previousMembership.room.participants,
        );
      }
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.participantName = participantName;

    const room = roomStore.joinRoom(roomId, socket.id, participantName);

    socket.emit("room:state", room);
    io.to(roomId).emit("room:participants", room.participants);
  });

  socket.on("code:update", ({ roomId, code }: CodeUpdatePayload) => {
    if (!roomId || socket.data.roomId !== roomId) {
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

  socket.on("disconnect", () => {
    const removedMembership = roomStore.removeParticipant(socket.id);

    if (removedMembership.roomId && removedMembership.room) {
      io.to(removedMembership.roomId).emit(
        "room:participants",
        removedMembership.room.participants,
      );
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`iTECify server listening on http://localhost:${PORT}`);
});
