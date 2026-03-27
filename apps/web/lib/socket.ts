import { io, type Socket } from "socket.io-client";
import { socketUrl } from "./env";

export type Participant = {
  socketId: string;
  name: string;
};

export type RoomState = {
  roomId: string;
  code: string;
  participants: Participant[];
};

type ClientToServerEvents = {
  "room:join": (payload: { roomId: string; name: string }) => void;
  "code:update": (payload: { roomId: string; code: string }) => void;
};

type ServerToClientEvents = {
  "room:state": (room: RoomState) => void;
  "room:participants": (participants: Participant[]) => void;
  "code:updated": (payload: { code: string; updatedBy: string }) => void;
};

export type ItecifySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocketClient() {
  return io(socketUrl, {
    autoConnect: false,
    transports: ["websocket"],
  });
}
