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

export type WorkspaceFileLanguage =
  | "javascript"
  | "python"
  | "html"
  | "css"
  | "cpp"
  | "json"
  | "markdown"
  | "plaintext";

export type ExecutionRuntime = "javascript" | "python" | "cpp";

export type WorkspaceFolderNode = {
  id: string;
  kind: "folder";
  name: string;
  parentId: string | null;
  path: string;
};

export type WorkspaceFileNode = {
  id: string;
  kind: "file";
  name: string;
  parentId: string | null;
  path: string;
  language: WorkspaceFileLanguage;
  content: string;
  executionRuntime?: ExecutionRuntime;
};

export type WorkspaceNode = WorkspaceFolderNode | WorkspaceFileNode;

export type WorkspaceState = {
  nodes: WorkspaceNode[];
  activeFileId: string;
  openFileIds: string[];
};

export type AiBlockStatus = "pending" | "accepted" | "rejected";

export type AiBlock = {
  id: string;
  roomId: string;
  fileId: string;
  code: string;
  explanation?: string;
  insertAfterLine: number;
  status: AiBlockStatus;
  createdAt: string;
};

export type RoomSnapshot = {
  id: string;
  roomId: string;
  workspace: WorkspaceState;
  label: string;
  createdAt: string;
};

export type TerminalEntryKind = "command" | "stdout" | "stderr" | "system";

export type TerminalEntry = {
  id: string;
  roomId: string;
  kind: TerminalEntryKind;
  text: string;
  createdAt: string;
  authorName?: string;
};

export type RoomState = {
  roomId: string;
  workspace: WorkspaceState;
  participants: Participant[];
  aiBlocks: AiBlock[];
  snapshots: RoomSnapshot[];
  terminalEntries: TerminalEntry[];
};

export type RemoteCursor = {
  socketId: string;
  name: string;
  fileId: string;
  position: CursorPosition;
};

export type RunOutputStream = "stdout" | "stderr";

export type RunOutputPayload = {
  roomId: string;
  runId: string;
  stream: RunOutputStream;
  chunk: string;
  timestamp: string;
};

export type RunDonePayload = {
  roomId: string;
  runId: string;
  status: "completed" | "failed";
  exitCode: number;
  finishedAt: string;
};

type ClientToServerEvents = {
  "room:join": (payload: { roomId: string; name: string }) => void;
  "workspace:file:update": (payload: {
    roomId: string;
    fileId: string;
    content: string;
  }) => void;
  "workspace:view:update": (payload: {
    roomId: string;
    activeFileId: string;
    openFileIds: string[];
  }) => void;
  "workspace:file:language": (payload: {
    roomId: string;
    fileId: string;
    language: WorkspaceFileLanguage;
  }) => void;
  "code:run": (payload: { roomId: string; fileId?: string }) => void;
  "snapshot:restore": (payload: { roomId: string; snapshotId: string }) => void;
  "terminal:command": (payload: { roomId: string; command: string }) => void;
  "cursor:update": (payload: {
    roomId: string;
    fileId: string;
    position: CursorPosition;
  }) => void;
  "ai:block:create": (payload: {
    roomId: string;
    fileId: string;
    prompt: string;
    code: string;
  }) => void;
  "ai:block:accept": (payload: { roomId: string; blockId: string }) => void;
  "ai:block:reject": (payload: { roomId: string; blockId: string }) => void;
};

type ServerToClientEvents = {
  "room:state": (room: RoomState) => void;
  "room:participants": (participants: Participant[]) => void;
  "workspace:file:updated": (payload: {
    fileId: string;
    content: string;
    updatedBy: string;
  }) => void;
  "workspace:view": (payload: {
    roomId: string;
    activeFileId: string;
    openFileIds: string[];
  }) => void;
  "workspace:file:language": (payload: {
    roomId: string;
    fileId: string;
    language: WorkspaceFileLanguage;
  }) => void;
  "cursor:updated": (payload: RemoteCursor) => void;
  "cursor:cleared": (payload: { socketId: string }) => void;
  "run:output": (payload: RunOutputPayload) => void;
  "run:done": (payload: RunDonePayload) => void;
  "ai:block:created": (payload: { block: AiBlock }) => void;
  "ai:block:updated": (payload: { block: AiBlock }) => void;
  "snapshot:created": (payload: { snapshot: RoomSnapshot }) => void;
  "terminal:entry": (payload: { entry: TerminalEntry }) => void;
};

export type ItecifySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocketClient() {
  return io(socketUrl, {
    autoConnect: false,
    transports: ["websocket"],
  });
}
