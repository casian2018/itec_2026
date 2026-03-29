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
export type IdeThemeId = "dark" | "light" | "github" | "neon";
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
  theme: IdeThemeId;
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
  ui: WorkspaceUiState;
  participants: Participant[];
  aiBlocks: AiBlock[];
  snapshots: RoomSnapshot[];
  terminalEntries: TerminalEntry[];
  activityFeed: SessionActivityEvent[];
  sessionComments: SessionComment[];
};

export type JoinRoomPayload = {
  roomId: string;
  name: string;
  userId?: string;
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
  mode?: AiSuggestionMode;
  cursorLine?: number | null;
};

export type AiBlockActionPayload = {
  roomId: string;
  blockId: string;
};

export type SharedChatSendPayload = {
  roomId: string;
  content: string;
};

export type PrivateChatSendPayload = {
  roomId: string;
  fileId?: string | null;
  content: string;
  intent?: AiAssistantIntent;
  mode?: AiSuggestionMode;
  cursorLine?: number | null;
  selection?: AiSelectionContext | null;
};

export type AiProposalLineActionPayload = {
  roomId: string;
  proposalId: string;
  changeId: string;
};

export type AiProposalApplyPayload = {
  roomId: string;
  proposalId: string;
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

export type TerminalInputPayload = {
  roomId: string;
  data: string;
};

export type TerminalResizePayload = {
  roomId: string;
  cols: number;
  rows: number;
};

export type TerminalClearPayload = {
  roomId: string;
};

export type WorkspaceCreateFilePayload = {
  roomId: string;
  parentId: string | null;
  name: string;
};

export type WorkspaceCreateFolderPayload = {
  roomId: string;
  parentId: string | null;
  name: string;
};

export type WorkspaceRenamePayload = {
  roomId: string;
  nodeId: string;
  newName: string;
};

export type WorkspaceDeletePayload = {
  roomId: string;
  nodeId: string;
};

export type WorkspaceDuplicatePayload = {
  roomId: string;
  nodeId: string;
};

export type WorkspaceMovePayload = {
  roomId: string;
  nodeId: string;
  targetParentId: string | null;
};

export type WorkspaceFormatPayload = {
  roomId: string;
  fileId: string;
};

export type WorkspaceCloseTabPayload = {
  roomId: string;
  fileId: string;
};

export type WorkspaceCreateTemplatePayload = {
  roomId: string;
  template: WorkspaceTemplateKind;
};

export type SessionCommentAddPayload = {
  roomId: string;
  fileId: string;
  lineNumber: number;
  body: string;
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
  "workspace:create:file": (payload: WorkspaceCreateFilePayload) => void;
  "workspace:create:folder": (payload: WorkspaceCreateFolderPayload) => void;
  "workspace:rename": (payload: WorkspaceRenamePayload) => void;
  "workspace:delete": (payload: WorkspaceDeletePayload) => void;
  "workspace:duplicate": (payload: WorkspaceDuplicatePayload) => void;
  "workspace:move": (payload: WorkspaceMovePayload) => void;
  "workspace:file:format": (payload: WorkspaceFormatPayload) => void;
  "workspace:tab:close": (payload: WorkspaceCloseTabPayload) => void;
  "workspace:create:template": (payload: WorkspaceCreateTemplatePayload) => void;
  "cursor:update": (payload: CursorUpdatePayload) => void;
  "execution:run": (payload: ExecutionRunPayload) => void;
  "code:run": (payload: CodeRunPayload) => void;
  "snapshot:restore": (payload: SnapshotRestorePayload) => void;
  "terminal:command": (payload: TerminalCommandPayload) => void;
  "terminal:input": (payload: TerminalInputPayload) => void;
  "terminal:resize": (payload: TerminalResizePayload) => void;
  "terminal:clear": (payload: TerminalClearPayload) => void;
  "chat:shared:send": (payload: SharedChatSendPayload) => void;
  "chat:private:send": (payload: PrivateChatSendPayload) => void;
  "ai:proposal:approve-line": (payload: AiProposalLineActionPayload) => void;
  "ai:proposal:reject-line": (payload: AiProposalLineActionPayload) => void;
  "ai:proposal:apply": (payload: AiProposalApplyPayload) => void;
  "ai:block:create": (payload: AiBlockCreatePayload) => void;
  "ai:block:accept": (payload: AiBlockActionPayload) => void;
  "ai:block:reject": (payload: AiBlockActionPayload) => void;
  "session:comment:add": (payload: SessionCommentAddPayload) => void;
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
  "workspace:tree": (payload: { workspace: WorkspaceState }) => void;
  "workspace:tab:closed": (payload: {
    fileId: string;
    activeFileId: string;
    openFileIds: string[];
  }) => void;
  "cursor:updated": (payload: CursorUpdatedPayload) => void;
  "cursor:cleared": (payload: { socketId: string }) => void;
  "execution:output": (payload: RunOutputPayload) => void;
  "execution:done": (payload: RunDonePayload) => void;
  "run:output": (payload: RunOutputPayload) => void;
  "run:done": (payload: RunDonePayload) => void;
  "chat:shared:init": (payload: { roomId: string; messages: ChatMessage[] }) => void;
  "chat:shared:message": (payload: { message: ChatMessage }) => void;
  "chat:shared:message:updated": (payload: { message: ChatMessage }) => void;
  "chat:private:init": (payload: { roomId: string; messages: ChatMessage[] }) => void;
  "chat:private:message": (payload: { message: ChatMessage }) => void;
  "chat:private:message:updated": (payload: { message: ChatMessage }) => void;
  "ai:proposal:init": (payload: { roomId: string; proposals: AiEditProposal[] }) => void;
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
  "terminal:clear": (payload: {
    roomId: string;
    clearedBy: string;
  }) => void;
  "terminal:systemMessage": (payload: { entry: TerminalEntry }) => void;
  "session:activity": (payload: SessionActivityEvent) => void;
  "session:comment:created": (payload: { comment: SessionComment }) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  roomId?: string;
  participantName?: string;
  userId?: string;
};
