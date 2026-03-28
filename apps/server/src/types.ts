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
export type IdeThemeId = "dark" | "light" | "github" | "neon";

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
  theme: IdeThemeId;
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
  ui: WorkspaceUiState;
  participants: Participant[];
  aiBlocks: AiBlock[];
  snapshots: RoomSnapshot[];
  terminalEntries: TerminalEntry[];
};

export type JoinRoomPayload = {
  roomId: string;
  name: string;
};

export type WorkspaceFileUpdatePayload = {
  roomId: string;
  fileId: string;
  content: string;
};

export type WorkspaceViewUpdatePayload = {
  roomId: string;
  activeFileId: string;
  openFileIds: string[];
};

export type WorkspaceFileLanguagePayload = {
  roomId: string;
  fileId: string;
  language: WorkspaceFileLanguage;
};

export type WorkspacePreviewUpdatePayload = {
  roomId: string;
  isVisible: boolean;
  targetFileId?: string | null;
};

export type WorkspaceThemeUpdatePayload = {
  roomId: string;
  theme: IdeThemeId;
};

export type CursorUpdatePayload = {
  roomId: string;
  fileId: string;
  position: CursorPosition;
};

export type WorkspaceFileUpdatedPayload = {
  fileId: string;
  content: string;
  updatedBy: string;
};

export type WorkspaceViewPayload = {
  roomId: string;
  activeFileId: string;
  openFileIds: string[];
};

export type WorkspaceFileLanguageUpdatedPayload = {
  roomId: string;
  fileId: string;
  language: WorkspaceFileLanguage;
};

export type WorkspacePreviewPayload = {
  roomId: string;
  preview: WorkspacePreviewState;
};

export type WorkspaceThemePayload = {
  roomId: string;
  theme: IdeThemeId;
};

export type CursorUpdatedPayload = {
  socketId: string;
  name: string;
  fileId: string;
  position: CursorPosition;
};

export type AiBlockCreatePayload = {
  roomId: string;
  fileId: string;
  prompt: string;
  code: string;
};

export type AiBlockActionPayload = {
  roomId: string;
  blockId: string;
};

export type ExecutionRunPayload = {
  roomId: string;
  fileId?: string;
};

export type CodeRunPayload = ExecutionRunPayload;

export type SnapshotRestorePayload = {
  roomId: string;
  snapshotId: string;
};

export type TerminalCommandPayload = {
  roomId: string;
  command: string;
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

export type ClientToServerEvents = {
  "room:join": (payload: JoinRoomPayload) => void;
  "workspace:file:update": (payload: WorkspaceFileUpdatePayload) => void;
  "workspace:view:update": (payload: WorkspaceViewUpdatePayload) => void;
  "workspace:file:language": (payload: WorkspaceFileLanguagePayload) => void;
  "workspace:preview:update": (payload: WorkspacePreviewUpdatePayload) => void;
  "workspace:theme:update": (payload: WorkspaceThemeUpdatePayload) => void;
  "cursor:update": (payload: CursorUpdatePayload) => void;
  "execution:run": (payload: ExecutionRunPayload) => void;
  "code:run": (payload: CodeRunPayload) => void;
  "snapshot:restore": (payload: SnapshotRestorePayload) => void;
  "terminal:command": (payload: TerminalCommandPayload) => void;
  "ai:block:create": (payload: AiBlockCreatePayload) => void;
  "ai:block:accept": (payload: AiBlockActionPayload) => void;
  "ai:block:reject": (payload: AiBlockActionPayload) => void;
};

export type ServerToClientEvents = {
  "room:state": (room: RoomState) => void;
  "room:participants": (participants: Participant[]) => void;
  "workspace:file:updated": (payload: WorkspaceFileUpdatedPayload) => void;
  "workspace:view": (payload: WorkspaceViewPayload) => void;
  "workspace:file:language": (
    payload: WorkspaceFileLanguageUpdatedPayload,
  ) => void;
  "workspace:preview": (payload: WorkspacePreviewPayload) => void;
  "workspace:theme": (payload: WorkspaceThemePayload) => void;
  "cursor:updated": (payload: CursorUpdatedPayload) => void;
  "cursor:cleared": (payload: { socketId: string }) => void;
  "execution:output": (payload: RunOutputPayload) => void;
  "execution:done": (payload: RunDonePayload) => void;
  "run:output": (payload: RunOutputPayload) => void;
  "run:done": (payload: RunDonePayload) => void;
  "ai:block:created": (payload: { block: AiBlock }) => void;
  "ai:block:updated": (payload: { block: AiBlock }) => void;
  "snapshot:created": (payload: { snapshot: RoomSnapshot }) => void;
  "terminal:entry": (payload: { entry: TerminalEntry }) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  roomId?: string;
  participantName?: string;
};
