import { io, type Socket } from "socket.io-client";
import { socketUrl } from "./env";

export type Participant = {
  socketId: string;
  name: string;
};

export type CursorPosition = {
  lineNumber: number;
  column: number;
};

export type AiBlockStatus = "pending" | "accepted" | "rejected";

export type AiBlock = {
  id: string;
  roomId: string;
  code: string;
  explanation?: string;
  insertAfterLine: number;
  status: AiBlockStatus;
  createdAt: string;
};

export type RoomState = {
  roomId: string;
  code: string;
  participants: Participant[];
  aiBlocks: AiBlock[];
};

export type RemoteCursor = {
  socketId: string;
  name: string;
  position: CursorPosition;
};

type ClientToServerEvents = {
  "room:join": (payload: { roomId: string; name: string }) => void;
  "code:update": (payload: { roomId: string; code: string }) => void;
  "cursor:update": (payload: {
    roomId: string;
    position: CursorPosition;
  }) => void;
  "ai:block:create": (payload: {
    roomId: string;
    prompt: string;
    code: string;
  }) => void;
  "ai:block:accept": (payload: { roomId: string; blockId: string }) => void;
  "ai:block:reject": (payload: { roomId: string; blockId: string }) => void;
};

type ServerToClientEvents = {
  "room:state": (room: RoomState) => void;
  "room:participants": (participants: Participant[]) => void;
  "code:updated": (payload: { code: string; updatedBy: string }) => void;
  "cursor:updated": (payload: RemoteCursor) => void;
  "cursor:cleared": (payload: { socketId: string }) => void;
  "ai:block:created": (payload: { block: AiBlock }) => void;
  "ai:block:updated": (payload: { block: AiBlock }) => void;
};

export type ItecifySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocketClient() {
  return io(socketUrl, {
    autoConnect: false,
    transports: ["websocket"],
  });
}
