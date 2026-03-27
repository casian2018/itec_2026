export type Participant = {
  socketId: string;
  name: string;
};

export type RoomState = {
  roomId: string;
  code: string;
  participants: Participant[];
};

export type JoinRoomPayload = {
  roomId: string;
  name: string;
};

export type CodeUpdatePayload = {
  roomId: string;
  code: string;
};

export type CodeUpdatedPayload = {
  code: string;
  updatedBy: string;
};

export type ClientToServerEvents = {
  "room:join": (payload: JoinRoomPayload) => void;
  "code:update": (payload: CodeUpdatePayload) => void;
};

export type ServerToClientEvents = {
  "room:state": (room: RoomState) => void;
  "room:participants": (participants: Participant[]) => void;
  "code:updated": (payload: CodeUpdatedPayload) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  roomId?: string;
  participantName?: string;
};
