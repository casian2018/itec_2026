import { io, type Socket } from "socket.io-client";
import { socketUrl } from "./env";

export type Participant = {
  socketId: string;
  name: string;
  userId?: string;
};

export type CursorPosition = {
  lineNumber: number;
  column: number;
};

export type WorkspaceFileLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "c"
  | "html"
  | "css"
  | "cpp"
  | "json"
  | "markdown"
  | "plaintext";

export type ExecutionRuntime = "javascript" | "python" | "c" | "cpp";
export type WorkspaceTemplateKind =
  | "python-starter"
  | "cpp-starter"
  | "html-css-starter"
  | "readme-starter"
  | "json-config-starter";

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

export type WorkspacePreviewState = {
  isVisible: boolean;
  targetFileId: string | null;
};

export type WorkspaceUiState = {
  preview: WorkspacePreviewState;
  theme?: string;
};

export type AiBlockStatus = "pending" | "accepted" | "rejected";
export type AiSuggestionMode = "assist" | "next-line" | "optimize";
export type AiBlockApplyMode = "insert" | "replace";

export type AiBlock = {
  id: string;
  roomId: string;
  fileId: string;
  mode: AiSuggestionMode;
  applyMode: AiBlockApplyMode;
  code: string;
  explanation?: string;
  insertAfterLine: number;
  status: AiBlockStatus;
  createdAt: string;
};

export type AiEditChangeType = "insert" | "replace" | "delete";
export type AiEditChangeStatus = "pending" | "approved" | "rejected";
export type AiEditProposalStatus = "pending" | "applied" | "discarded";

export type AiEditLineChange = {
  id: string;
  type: AiEditChangeType;
  lineNumber: number;
  oldText: string;
  newText: string;
  summary: string;
  status: AiEditChangeStatus;
};

export type AiEditProposal = {
  id: string;
  roomId: string;
  fileId: string;
  filePath: string;
  requesterUserId: string;
  requesterName: string;
  prompt: string;
  explanation: string;
  baseContent: string;
  status: AiEditProposalStatus;
  changes: AiEditLineChange[];
  createdAt: string;
  appliedAt?: string | null;
};

export type ChatChannel = "shared" | "private";
export type ChatAuthorType = "user" | "ai" | "system";
export type AiAssistantIntent = "edit" | "explain" | "generate-files" | "summarize";

export type AiSelectionContext = {
  startLineNumber: number;
  endLineNumber: number;
  selectedText: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  channel: ChatChannel;
  authorType: ChatAuthorType;
  authorName: string;
  content: string;
  createdAt: string;
  userId?: string;
  fileId?: string | null;
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

export type SessionActivityEvent = {
  id: string;
  roomId: string;
  kind: "join" | "leave";
  message: string;
  actorName?: string;
  createdAt: string;
};

export type SessionComment = {
  id: string;
  roomId: string;
  fileId: string;
  lineNumber: number;
  body: string;
  authorName: string;
  userId: string;
  createdAt: string;
};

export type RoomState = {
  roomId: string;
  workspace: WorkspaceState;
  ui?: WorkspaceUiState;
  participants: Participant[];
  aiBlocks: AiBlock[];
  snapshots: RoomSnapshot[];
  terminalEntries: TerminalEntry[];
  activityFeed: SessionActivityEvent[];
  sessionComments: SessionComment[];
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
  "room:join": (payload: { roomId: string; name: string; userId?: string }) => void;
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
  "workspace:preview:update": (payload: {
    roomId: string;
    isVisible: boolean;
    targetFileId: string | null;
  }) => void;
  "workspace:theme:update": (payload: {
    roomId: string;
    theme: string;
  }) => void;
  "workspace:create:file": (payload: {
    roomId: string;
    parentId: string | null;
    name: string;
  }) => void;
  "workspace:create:folder": (payload: {
    roomId: string;
    parentId: string | null;
    name: string;
  }) => void;
  "workspace:rename": (payload: {
    roomId: string;
    nodeId: string;
    newName: string;
  }) => void;
  "workspace:delete": (payload: {
    roomId: string;
    nodeId: string;
  }) => void;
  "workspace:duplicate": (payload: {
    roomId: string;
    nodeId: string;
  }) => void;
  "workspace:move": (payload: {
    roomId: string;
    nodeId: string;
    targetParentId: string | null;
  }) => void;
  "workspace:file:format": (payload: {
    roomId: string;
    fileId: string;
  }) => void;
  "workspace:tab:close": (payload: {
    roomId: string;
    fileId: string;
  }) => void;
  "workspace:create:template": (payload: {
    roomId: string;
    template: WorkspaceTemplateKind;
  }) => void;
  "code:run": (payload: { roomId: string; fileId?: string }) => void;
  "snapshot:restore": (payload: { roomId: string; snapshotId: string }) => void;
  "terminal:command": (payload: { roomId: string; command: string }) => void;
  "terminal:input": (payload: { roomId: string; data: string }) => void;
  "terminal:resize": (payload: {
    roomId: string;
    cols: number;
    rows: number;
  }) => void;
  "terminal:clear": (payload: { roomId: string }) => void;
  "chat:shared:send": (payload: { roomId: string; content: string }) => void;
  "chat:private:send": (payload: {
    roomId: string;
    fileId?: string | null;
    content: string;
    intent?: AiAssistantIntent;
    mode?: AiSuggestionMode;
    cursorLine?: number | null;
    selection?: AiSelectionContext | null;
  }) => void;
  "ai:proposal:approve-line": (payload: {
    roomId: string;
    proposalId: string;
    changeId: string;
  }) => void;
  "ai:proposal:reject-line": (payload: {
    roomId: string;
    proposalId: string;
    changeId: string;
  }) => void;
  "ai:proposal:apply": (payload: {
    roomId: string;
    proposalId: string;
  }) => void;
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
    mode?: AiSuggestionMode;
    cursorLine?: number | null;
  }) => void;
  "ai:block:accept": (payload: { roomId: string; blockId: string }) => void;
  "ai:block:reject": (payload: { roomId: string; blockId: string }) => void;
  "session:comment:add": (payload: {
    roomId: string;
    fileId: string;
    lineNumber: number;
    body: string;
  }) => void;
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
  "workspace:preview": (payload: {
    roomId: string;
    preview: WorkspacePreviewState;
  }) => void;
  "workspace:theme": (payload: {
    roomId: string;
    theme: string;
  }) => void;
  "workspace:tree": (payload: { workspace: WorkspaceState }) => void;
  "workspace:tab:closed": (payload: {
    fileId: string;
    activeFileId: string;
    openFileIds: string[];
  }) => void;
  "cursor:updated": (payload: RemoteCursor) => void;
  "cursor:cleared": (payload: { socketId: string }) => void;
  "run:output": (payload: RunOutputPayload) => void;
  "run:done": (payload: RunDonePayload) => void;
  "chat:shared:init": (payload: {
    roomId: string;
    messages: ChatMessage[];
  }) => void;
  "chat:shared:message": (payload: { message: ChatMessage }) => void;
  "chat:shared:message:updated": (payload: { message: ChatMessage }) => void;
  "chat:private:init": (payload: {
    roomId: string;
    messages: ChatMessage[];
  }) => void;
  "chat:private:message": (payload: { message: ChatMessage }) => void;
  "chat:private:message:updated": (payload: { message: ChatMessage }) => void;
  "ai:proposal:init": (payload: {
    roomId: string;
    proposals: AiEditProposal[];
  }) => void;
  "ai:proposal:created": (payload: { proposal: AiEditProposal }) => void;
  "ai:proposal:updated": (payload: { proposal: AiEditProposal }) => void;
  "ai:proposal:error": (payload: { roomId: string; message: string }) => void;
  "ai:block:created": (payload: { block: AiBlock }) => void;
  "ai:block:updated": (payload: { block: AiBlock }) => void;
  "ai:block:error": (payload: { roomId: string; message: string }) => void;
  "snapshot:created": (payload: { snapshot: RoomSnapshot }) => void;
  "terminal:history:init": (payload: {
    roomId: string;
    entries: TerminalEntry[];
  }) => void;
  "terminal:entry": (payload: { entry: TerminalEntry }) => void;
  "terminal:clear": (payload: { roomId: string; clearedBy: string }) => void;
  "terminal:systemMessage": (payload: { entry: TerminalEntry }) => void;
  "session:activity": (payload: SessionActivityEvent) => void;
  "session:comment:created": (payload: { comment: SessionComment }) => void;
};

export type ItecifySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocketClient() {
  return io(socketUrl, {
    autoConnect: false,
    transports: ["websocket"],
  });
}
