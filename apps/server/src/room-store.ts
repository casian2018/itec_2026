import type {
  AiBlock,
  AiBlockStatus,
  Participant,
  RoomState,
} from "./types.js";

type StoredRoom = {
  roomId: string;
  code: string;
  participants: Map<string, Participant>;
  aiBlocks: Map<string, AiBlock>;
};

type AiBlockMutationResult = {
  block: AiBlock;
  room: RoomState;
  changed: boolean;
  inserted: boolean;
};

export type LeaveRoomResult = {
  roomId: string | null;
  room: RoomState | null;
  participant: Participant | null;
  deletedRoom: boolean;
};

export type JoinRoomResult = {
  room: RoomState;
  participant: Participant;
  createdRoom: boolean;
  previousRoomId: string | null;
  previousRoom: RoomState | null;
  previousParticipant: Participant | null;
  deletedPreviousRoom: boolean;
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

  joinRoom(roomId: string, socketId: string, name: string): JoinRoomResult {
    const previousMembership = this.leaveRoomBySocket(socketId);
    const { room, createdRoom } = this.ensureRoom(roomId);
    const participant = { socketId, name };

    room.participants.set(socketId, participant);
    this.socketToRoom.set(socketId, roomId);

    return {
      room: this.toRoomState(room),
      participant,
      createdRoom,
      previousRoomId: previousMembership.roomId,
      previousRoom: previousMembership.room,
      previousParticipant: previousMembership.participant,
      deletedPreviousRoom: previousMembership.deletedRoom,
    };
  }

  updateCode(roomId: string, code: string) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    room.code = code;

    return this.toRoomState(room);
  }

  addAiBlock(roomId: string, block: AiBlock) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    room.aiBlocks.set(block.id, block);

    return block;
  }

  acceptAiBlock(roomId: string, blockId: string): AiBlockMutationResult | null {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const existingBlock = room.aiBlocks.get(blockId);

    if (!existingBlock) {
      return null;
    }

    if (existingBlock.status === "accepted") {
      return {
        block: existingBlock,
        room: this.toRoomState(room),
        changed: false,
        inserted: false,
      };
    }

    if (existingBlock.status === "rejected") {
      return {
        block: existingBlock,
        room: this.toRoomState(room),
        changed: false,
        inserted: false,
      };
    }

    room.code = insertCodeAfterLine(
      room.code,
      existingBlock.code,
      existingBlock.insertAfterLine,
    );

    const updatedBlock: AiBlock = {
      ...existingBlock,
      status: "accepted",
    };

    room.aiBlocks.set(blockId, updatedBlock);

    return {
      block: updatedBlock,
      room: this.toRoomState(room),
      changed: true,
      inserted: true,
    };
  }

  rejectAiBlock(roomId: string, blockId: string): AiBlockMutationResult | null {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const existingBlock = room.aiBlocks.get(blockId);

    if (!existingBlock) {
      return null;
    }

    if (existingBlock.status !== "pending") {
      return {
        block: existingBlock,
        room: this.toRoomState(room),
        changed: false,
        inserted: false,
      };
    }

    const updatedBlock: AiBlock = {
      ...existingBlock,
      status: "rejected",
    };

    room.aiBlocks.set(blockId, updatedBlock);

    return {
      block: updatedBlock,
      room: this.toRoomState(room),
      changed: true,
      inserted: false,
    };
  }

  leaveRoomBySocket(socketId: string): LeaveRoomResult {
    const roomId = this.socketToRoom.get(socketId);

    if (!roomId) {
      return {
        roomId: null,
        room: null,
        participant: null,
        deletedRoom: false,
      };
    }

    this.socketToRoom.delete(socketId);

    const room = this.rooms.get(roomId);

    if (!room) {
      return {
        roomId,
        room: null,
        participant: null,
        deletedRoom: false,
      };
    }

    const participant = room.participants.get(socketId) ?? null;
    room.participants.delete(socketId);

    if (room.participants.size === 0) {
      this.rooms.delete(roomId);

      return {
        roomId,
        room: null,
        participant,
        deletedRoom: true,
      };
    }

    return {
      roomId,
      room: this.toRoomState(room),
      participant,
      deletedRoom: false,
    };
  }

  private ensureRoom(roomId: string) {
    const existingRoom = this.rooms.get(roomId);

    if (existingRoom) {
      return {
        room: existingRoom,
        createdRoom: false,
      };
    }

    const room: StoredRoom = {
      roomId,
      code: DEFAULT_CODE,
      participants: new Map(),
      aiBlocks: new Map(),
    };

    this.rooms.set(roomId, room);

    return {
      room,
      createdRoom: true,
    };
  }

  private toRoomState(room: StoredRoom): RoomState {
    return {
      roomId: room.roomId,
      code: room.code,
      participants: Array.from(room.participants.values()),
      aiBlocks: Array.from(room.aiBlocks.values()).sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      ),
    };
  }
}

function insertCodeAfterLine(
  documentCode: string,
  blockCode: string,
  insertAfterLine: number,
) {
  const normalizedDocument = documentCode.replace(/\r\n/g, "\n");
  const normalizedBlock = blockCode.replace(/\r\n/g, "\n").trimEnd();
  const documentLines =
    normalizedDocument.length > 0 ? normalizedDocument.split("\n") : [];
  const insertionIndex = Math.max(
    0,
    Math.min(insertAfterLine, documentLines.length),
  );
  const blockLines = normalizedBlock.split("\n");

  return [
    ...documentLines.slice(0, insertionIndex),
    ...blockLines,
    ...documentLines.slice(insertionIndex),
  ].join("\n");
}
