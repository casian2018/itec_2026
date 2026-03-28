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

export type JoinRoomPayload = {
  roomId: string;
  name: string;
};

export type CodeUpdatePayload = {
  roomId: string;
  code: string;
};

export type CursorUpdatePayload = {
  roomId: string;
  position: CursorPosition;
};

export type CodeUpdatedPayload = {
  code: string;
  updatedBy: string;
};

export type CursorUpdatedPayload = {
  socketId: string;
  name: string;
  position: CursorPosition;
};

export type AiBlockCreatePayload = {
  roomId: string;
  prompt: string;
  code: string;
};

export type AiBlockActionPayload = {
  roomId: string;
  blockId: string;
};

export type ClientToServerEvents = {
  "room:join": (payload: JoinRoomPayload) => void;
  "code:update": (payload: CodeUpdatePayload) => void;
  "cursor:update": (payload: CursorUpdatePayload) => void;
  "ai:block:create": (payload: AiBlockCreatePayload) => void;
  "ai:block:accept": (payload: AiBlockActionPayload) => void;
  "ai:block:reject": (payload: AiBlockActionPayload) => void;
};

export type ServerToClientEvents = {
  "room:state": (room: RoomState) => void;
  "room:participants": (participants: Participant[]) => void;
  "code:updated": (payload: CodeUpdatedPayload) => void;
  "cursor:updated": (payload: CursorUpdatedPayload) => void;
  "cursor:cleared": (payload: { socketId: string }) => void;
  "ai:block:created": (payload: { block: AiBlock }) => void;
  "ai:block:updated": (payload: { block: AiBlock }) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  roomId?: string;
  participantName?: string;
};
