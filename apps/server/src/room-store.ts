import type { Participant, RoomState } from "./types.js";

type StoredRoom = {
  roomId: string;
  code: string;
  participants: Map<string, Participant>;
};

const DEFAULT_CODE = `function startSession() {
  return {
    project: "iTECify",
    mode: "hackathon-mvp",
    collaboration: true,
  };
}
`;

export class RoomStore {
  private rooms = new Map<string, StoredRoom>();
  private socketToRoom = new Map<string, string>();

  getRoom(roomId: string) {
    const room = this.rooms.get(roomId);

    return room ? this.toRoomState(room) : null;
  }

  joinRoom(roomId: string, socketId: string, name: string) {
    const room = this.ensureRoom(roomId);

    room.participants.set(socketId, { socketId, name });
    this.socketToRoom.set(socketId, roomId);

    return this.toRoomState(room);
  }

  updateCode(roomId: string, code: string) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    room.code = code;

    return this.toRoomState(room);
  }

  removeParticipant(socketId: string) {
    const roomId = this.socketToRoom.get(socketId);

    if (!roomId) {
      return { roomId: null, room: null };
    }

    const room = this.rooms.get(roomId);
    this.socketToRoom.delete(socketId);

    if (!room) {
      return { roomId, room: null };
    }

    room.participants.delete(socketId);

    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
      return { roomId, room: null };
    }

    return { roomId, room: this.toRoomState(room) };
  }

  private ensureRoom(roomId: string) {
    const existingRoom = this.rooms.get(roomId);

    if (existingRoom) {
      return existingRoom;
    }

    const room: StoredRoom = {
      roomId,
      code: DEFAULT_CODE,
      participants: new Map(),
    };

    this.rooms.set(roomId, room);

    return room;
  }

  private toRoomState(room: StoredRoom): RoomState {
    return {
      roomId: room.roomId,
      code: room.code,
      participants: Array.from(room.participants.values()),
    };
  }
}
