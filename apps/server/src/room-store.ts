import type {
  AiBlock,
  AiEditChangeStatus,
  AiEditProposal,
  ChatMessage,
  IdeThemeId,
  Participant,
  RoomSnapshot,
  RoomState,
  SessionActivityEvent,
  SessionComment,
  TerminalEntry,
  WorkspaceFileLanguage,
  WorkspaceFileNode,
  WorkspacePreviewState,
  WorkspaceUiState,
  WorkspaceState,
} from "./types.js";
import {
  applyApprovedLineChangesToWorkspaceFile,
  cloneWorkspaceState,
  closeWorkspaceTab,
  createEmptyWorkspace,
  duplicateWorkspaceNode,
  formatWorkspaceFile,
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspaceNode,
  getWorkspaceFile,
  getPreviewFiles,
  insertCodeIntoWorkspaceFile,
  mergeGeneratedFilesIntoWorkspace,
  moveWorkspaceNode,
  renameWorkspaceNode,
  serializeWorkspace,
  updateWorkspaceFileContent,
  updateWorkspaceFileLanguage,
  updateWorkspaceView,
} from "./workspace.js";

type StoredRoom = {
  roomId: string;
  workspace: WorkspaceState;
  ui: WorkspaceUiState;
  participants: Map<string, Participant>;
  aiBlocks: Map<string, AiBlock>;
  snapshots: RoomSnapshot[];
  terminalEntries: TerminalEntry[];
  sharedChatMessages: ChatMessage[];
  privateChatMessages: Map<string, ChatMessage[]>;
  privateAiProposals: Map<string, AiEditProposal[]>;
  activityFeed: SessionActivityEvent[];
  sessionComments: SessionComment[];
  emptySince: string | null;
};

type RoomMutationResult = {
  room: RoomState;
  snapshot: RoomSnapshot | null;
  changed: boolean;
};

type AiBlockMutationResult = {
  block: AiBlock;
  room: RoomState;
  changed: boolean;
  applied: boolean;
  snapshot: RoomSnapshot | null;
};

type AiEditProposalMutationResult = {
  proposal: AiEditProposal;
  room: RoomState;
  changed: boolean;
  applied: boolean;
  snapshot: RoomSnapshot | null;
  error: string | null;
};

export type RestoreSnapshotResult = {
  room: RoomState;
  sourceSnapshot: RoomSnapshot;
  createdSnapshot: RoomSnapshot | null;
  changed: boolean;
};

export type LeaveRoomResult = {
  roomId: string | null;
  room: RoomState | null;
  participant: Participant | null;
  deletedRoom: boolean;
  roomBecameEmpty: boolean;
};

export type JoinRoomResult = {
  room: RoomState;
  participant: Participant;
  createdRoom: boolean;
  previousRoomId: string | null;
  previousRoom: RoomState | null;
  previousParticipant: Participant | null;
  deletedPreviousRoom: boolean;
  previousRoomBecameEmpty: boolean;
};

const MAX_ROOM_SNAPSHOTS = 12;
const MAX_TERMINAL_ENTRIES = 600;
const MAX_SESSION_ACTIVITY = 80;
const MAX_SESSION_COMMENTS = 200;
const MAX_SHARED_CHAT_MESSAGES = 200;
const MAX_PRIVATE_CHAT_MESSAGES = 120;
const MAX_PRIVATE_AI_PROPOSALS = 24;
const AUTO_SNAPSHOT_INTERVAL_MS = 15_000;

export class RoomStore {
  private rooms = new Map<string, StoredRoom>();
  private socketToRoom = new Map<string, string>();

  hasRoom(roomId: string) {
    return this.rooms.has(roomId);
  }

  getRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    return room ? this.toRoomState(room) : null;
  }

  appendActivity(
    roomId: string,
    partial: Omit<SessionActivityEvent, "id" | "roomId" | "createdAt">,
  ): SessionActivityEvent | null {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const event: SessionActivityEvent = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      kind: partial.kind,
      message: partial.message,
      actorName: partial.actorName,
      createdAt: new Date().toISOString(),
    };

    const previousFeed = room.activityFeed ?? [];
    room.activityFeed = [event, ...previousFeed].slice(0, MAX_SESSION_ACTIVITY);
    return event;
  }

  addSessionComment(
    roomId: string,
    input: {
      fileId: string;
      lineNumber: number;
      body: string;
      authorName: string;
      userId: string;
    },
  ): SessionComment | null {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const file = getWorkspaceFile(room.workspace, input.fileId);

    if (!file) {
      return null;
    }

    const body = input.body.trim().slice(0, 4000);

    if (!body) {
      return null;
    }

    const comment: SessionComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      fileId: input.fileId,
      lineNumber: Math.max(0, Math.floor(input.lineNumber)),
      body,
      authorName: input.authorName,
      userId: input.userId,
      createdAt: new Date().toISOString(),
    };

    const previousComments = room.sessionComments ?? [];
    room.sessionComments = [comment, ...previousComments].slice(
      0,
      MAX_SESSION_COMMENTS,
    );
    return comment;
  }

  createRoom(roomId: string) {
    const normalizedRoomId = roomId.trim();

    if (!normalizedRoomId) {
      return null;
    }

    const { room, createdRoom } = this.ensureRoom(normalizedRoomId);

    return {
      room: this.toRoomState(room),
      createdRoom,
    };
  }

  joinRoom(
    roomId: string,
    socketId: string,
    name: string,
    userId?: string,
  ): JoinRoomResult {
    const previousMembership = this.leaveRoomBySocket(socketId);
    const { room, createdRoom } = this.ensureRoom(roomId);
    const participant = { socketId, name, userId };

    room.emptySince = null;
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
      previousRoomBecameEmpty: previousMembership.roomBecameEmpty,
    };
  }

  deleteRoomIfEmpty(roomId: string) {
    const room = this.rooms.get(roomId);

    if (!room || room.participants.size > 0) {
      return false;
    }

    this.rooms.delete(roomId);
    return true;
  }

  updateFileContent(
    roomId: string,
    fileId: string,
    content: string,
    options?: {
      snapshotLabel?: string;
      forceSnapshot?: boolean;
    },
  ): RoomMutationResult | null {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = updateWorkspaceFileContent(room.workspace, fileId, content);

    if (!result.file) {
      return null;
    }

    room.workspace = result.workspace;

    const snapshot = result.changed
      ? this.captureSnapshot(
          room,
          options?.snapshotLabel ?? "Auto checkpoint",
          options?.forceSnapshot ?? false,
        )
      : null;

    return {
      room: this.toRoomState(room),
      snapshot,
      changed: result.changed,
    };
  }

  updateWorkspaceView(
    roomId: string,
    activeFileId: string,
    openFileIds: string[],
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = updateWorkspaceView(room.workspace, activeFileId, openFileIds);
    room.workspace = result.workspace;

    return {
      room: this.toRoomState(room),
      changed: result.changed,
    };
  }

  updateFileLanguage(
    roomId: string,
    fileId: string,
    language: WorkspaceFileLanguage,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = updateWorkspaceFileLanguage(room.workspace, fileId, language);

    if (!result.file) {
      return null;
    }

    room.workspace = result.workspace;

    return {
      room: this.toRoomState(room),
      changed: result.changed,
      file: result.file,
    };
  }

  updateWorkspacePreview(
    roomId: string,
    preview: WorkspacePreviewState,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const normalizedTargetFileId =
      preview.targetFileId && getWorkspaceFile(room.workspace, preview.targetFileId)
        ? preview.targetFileId
        : null;
    const changed =
      room.ui.preview.isVisible !== preview.isVisible ||
      room.ui.preview.targetFileId !== normalizedTargetFileId;

    if (!changed) {
      return {
        room: this.toRoomState(room),
        changed: false,
      };
    }

    room.ui = {
      ...room.ui,
      preview: {
        isVisible: preview.isVisible,
        targetFileId: normalizedTargetFileId,
      },
    };

    return {
      room: this.toRoomState(room),
      changed: true,
    };
  }

  updateWorkspaceTheme(roomId: string, theme: IdeThemeId) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    if (room.ui.theme === theme) {
      return {
        room: this.toRoomState(room),
        changed: false,
      };
    }

    room.ui = {
      ...room.ui,
      theme,
    };

    return {
      room: this.toRoomState(room),
      changed: true,
    };
  }

  createFile(
    roomId: string,
    parentId: string | null,
    name: string,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = createWorkspaceFile(room.workspace, parentId, name);

    if (!result.changed || !result.file) {
      return {
        room: this.toRoomState(room),
        changed: false,
        file: null,
      };
    }

    room.workspace = result.workspace;

    return {
      room: this.toRoomState(room),
      changed: true,
      file: result.file,
    };
  }

  createFolder(
    roomId: string,
    parentId: string | null,
    name: string,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = createWorkspaceFolder(room.workspace, parentId, name);

    if (!result.changed || !result.folder) {
      return {
        room: this.toRoomState(room),
        changed: false,
        folder: null,
      };
    }

    room.workspace = result.workspace;

    return {
      room: this.toRoomState(room),
      changed: true,
      folder: result.folder,
    };
  }

  renameNode(
    roomId: string,
    nodeId: string,
    newName: string,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = renameWorkspaceNode(room.workspace, nodeId, newName);

    if (!result.changed) {
      return {
        room: this.toRoomState(room),
        changed: false,
      };
    }

    room.workspace = result.workspace;

    return {
      room: this.toRoomState(room),
      changed: true,
    };
  }

  deleteNode(
    roomId: string,
    nodeId: string,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = deleteWorkspaceNode(room.workspace, nodeId);

    if (!result.changed) {
      return {
        room: this.toRoomState(room),
        changed: false,
      };
    }

    room.workspace = result.workspace;

    return {
      room: this.toRoomState(room),
      changed: true,
    };
  }

  duplicateNode(roomId: string, nodeId: string) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = duplicateWorkspaceNode(room.workspace, nodeId);

    if (!result.changed || !result.node) {
      return {
        room: this.toRoomState(room),
        changed: false,
        file: null,
      };
    }

    room.workspace = result.workspace;

    return {
      room: this.toRoomState(room),
      changed: true,
      file: result.node?.kind === "file" ? result.node : null,
    };
  }

  moveNode(
    roomId: string,
    nodeId: string,
    targetParentId: string | null,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = moveWorkspaceNode(room.workspace, nodeId, targetParentId);

    if (!result.changed) {
      return {
        room: this.toRoomState(room),
        changed: false,
      };
    }

    room.workspace = result.workspace;

    return {
      room: this.toRoomState(room),
      changed: true,
    };
  }

  async formatFile(
    roomId: string,
    fileId: string,
  ): Promise<{
    room: RoomState;
    changed: boolean;
    file: WorkspaceFileNode;
    error: string | null;
  } | null> {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = await formatWorkspaceFile(room.workspace, fileId);

    if (!result.file) {
      return null;
    }

    if (result.changed) {
      room.workspace = result.workspace;
    }

    return {
      room: this.toRoomState(room),
      changed: result.changed,
      file: result.file,
      error: result.error,
    };
  }

  closeTab(
    roomId: string,
    fileId: string,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = closeWorkspaceTab(room.workspace, fileId);

    if (!result.changed) {
      return {
        room: this.toRoomState(room),
        changed: false,
      };
    }

    room.workspace = result.workspace;

    return {
      room: this.toRoomState(room),
      changed: true,
    };
  }

  replaceWorkspace(
    roomId: string,
    workspace: WorkspaceState,
    options?: {
      snapshotLabel?: string;
    },
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    room.workspace = cloneWorkspaceState(workspace);
    room.aiBlocks.clear();
    room.privateAiProposals.clear();
    room.snapshots = [];

    const previewHtmlFile = getPreviewFiles(room.workspace).htmlFile;
    room.ui = {
      ...room.ui,
      preview: {
        isVisible: Boolean(previewHtmlFile),
        targetFileId: previewHtmlFile?.id ?? null,
      },
    };

    const snapshot =
      room.workspace.nodes.length > 0
        ? this.captureSnapshot(
            room,
            options?.snapshotLabel ?? "Imported project",
            true,
          )
        : null;

    return {
      room: this.toRoomState(room),
      changed: true,
      snapshot,
    };
  }

  mergeGeneratedFiles(
    roomId: string,
    files: Array<{ path: string; content: string }>,
    options?: {
      snapshotLabel?: string;
    },
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const result = mergeGeneratedFilesIntoWorkspace(room.workspace, files);

    if (!result.changed) {
      return {
        room: this.toRoomState(room),
        changed: false,
        touchedFileIds: [],
        snapshot: null,
      };
    }

    room.workspace = result.workspace;

    const snapshot = this.captureSnapshot(
      room,
      options?.snapshotLabel ?? "AI-generated files",
      true,
    );

    return {
      room: this.toRoomState(room),
      changed: true,
      touchedFileIds: result.touchedFileIds,
      snapshot,
    };
  }

  addAiBlock(roomId: string, block: AiBlock) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    room.aiBlocks.set(block.id, block);

    return block;
  }

  addTerminalEntry(roomId: string, entry: TerminalEntry) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    room.terminalEntries = [entry, ...room.terminalEntries].slice(
      0,
      MAX_TERMINAL_ENTRIES,
    );

    return entry;
  }

  getSharedChatMessages(roomId: string) {
    const room = this.rooms.get(roomId);
    return room ? [...room.sharedChatMessages] : [];
  }

  addSharedChatMessage(roomId: string, message: ChatMessage) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    room.sharedChatMessages = [
      ...room.sharedChatMessages,
      message,
    ].slice(-MAX_SHARED_CHAT_MESSAGES);

    return message;
  }

  updateSharedChatMessage(roomId: string, messageId: string, content: string) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    let nextMessage: ChatMessage | null = null;

    room.sharedChatMessages = room.sharedChatMessages.map((message) => {
      if (message.id !== messageId) {
        return message;
      }

      if (message.content === content) {
        nextMessage = message;
        return message;
      }

      nextMessage = {
        ...message,
        content,
      };

      return nextMessage;
    });

    return nextMessage;
  }

  getPrivateChatMessages(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return [];
    }

    return [...(room.privateChatMessages.get(userId) ?? [])];
  }

  addPrivateChatMessage(roomId: string, userId: string, message: ChatMessage) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const nextMessages = [
      ...(room.privateChatMessages.get(userId) ?? []),
      message,
    ].slice(-MAX_PRIVATE_CHAT_MESSAGES);

    room.privateChatMessages.set(userId, nextMessages);

    return message;
  }

  updatePrivateChatMessage(
    roomId: string,
    userId: string,
    messageId: string,
    content: string,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const messages = room.privateChatMessages.get(userId) ?? [];
    let nextMessage: ChatMessage | null = null;

    const nextMessages = messages.map((message) => {
      if (message.id !== messageId) {
        return message;
      }

      if (message.content === content) {
        nextMessage = message;
        return message;
      }

      nextMessage = {
        ...message,
        content,
      };

      return nextMessage;
    });

    room.privateChatMessages.set(userId, nextMessages);

    return nextMessage;
  }

  getPrivateAiProposals(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return [];
    }

    return [...(room.privateAiProposals.get(userId) ?? [])].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  addPrivateAiProposal(roomId: string, userId: string, proposal: AiEditProposal) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const nextProposals = [
      proposal,
      ...(room.privateAiProposals.get(userId) ?? []).filter(
        (currentProposal) => currentProposal.id !== proposal.id,
      ),
    ].slice(0, MAX_PRIVATE_AI_PROPOSALS);

    room.privateAiProposals.set(userId, nextProposals);

    return proposal;
  }

  updatePrivateAiProposalLineStatus(
    roomId: string,
    userId: string,
    proposalId: string,
    changeId: string,
    status: AiEditChangeStatus,
  ) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const proposals = room.privateAiProposals.get(userId) ?? [];
    let nextProposal: AiEditProposal | null = null;
    let changed = false;

    const nextProposals = proposals.map((proposal) => {
      if (proposal.id !== proposalId) {
        return proposal;
      }

      if (proposal.status !== "pending") {
        nextProposal = proposal;
        return proposal;
      }

      const nextChanges = proposal.changes.map((change) => {
        if (change.id !== changeId || change.status === status) {
          return change;
        }

        changed = true;

        return {
          ...change,
          status,
        };
      });

      nextProposal = changed
        ? {
            ...proposal,
            changes: nextChanges,
          }
        : proposal;

      return nextProposal;
    });

    if (!nextProposal) {
      return null;
    }

    if (changed) {
      room.privateAiProposals.set(userId, nextProposals);
    }

    return {
      proposal: nextProposal,
      room: this.toRoomState(room),
      changed,
    };
  }

  applyPrivateAiProposal(
    roomId: string,
    userId: string,
    proposalId: string,
  ): AiEditProposalMutationResult | null {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const proposals = room.privateAiProposals.get(userId) ?? [];
    const proposal = proposals.find((currentProposal) => currentProposal.id === proposalId);

    if (!proposal) {
      return null;
    }

    if (proposal.status !== "pending") {
      return {
        proposal,
        room: this.toRoomState(room),
        changed: false,
        applied: false,
        snapshot: null,
        error: proposal.status === "applied"
          ? "This proposal was already applied."
          : "This proposal is no longer pending.",
      };
    }

    const applicationResult = applyApprovedLineChangesToWorkspaceFile(
      room.workspace,
      proposal.fileId,
      proposal.baseContent,
      proposal.changes,
    );

    if (applicationResult.error || !applicationResult.file) {
      return {
        proposal,
        room: this.toRoomState(room),
        changed: false,
        applied: false,
        snapshot: null,
        error: applicationResult.error ?? "Unable to apply the approved AI changes.",
      };
    }

    room.workspace = applicationResult.workspace;

    const updatedProposal: AiEditProposal = {
      ...proposal,
      status: "applied",
      appliedAt: new Date().toISOString(),
    };

    room.privateAiProposals.set(
      userId,
      proposals.map((currentProposal) =>
        currentProposal.id === proposalId ? updatedProposal : currentProposal,
      ),
    );

    const snapshot = applicationResult.changed
      ? this.captureSnapshot(room, "AI line changes applied", true)
      : null;

    return {
      proposal: updatedProposal,
      room: this.toRoomState(room),
      changed: true,
      applied: applicationResult.changed,
      snapshot,
      error: null,
    };
  }

  clearTerminalEntries(roomId: string) {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    room.terminalEntries = [];

    return this.toRoomState(room);
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

    if (existingBlock.status !== "pending") {
      return {
        block: existingBlock,
        room: this.toRoomState(room),
        changed: false,
        applied: false,
        snapshot: null,
      };
    }

    const applicationResult =
      existingBlock.applyMode === "replace"
        ? updateWorkspaceFileContent(
            room.workspace,
            existingBlock.fileId,
            existingBlock.code,
          )
        : insertCodeIntoWorkspaceFile(
            room.workspace,
            existingBlock.fileId,
            existingBlock.code,
            existingBlock.insertAfterLine,
          );

    if (!applicationResult.file) {
      return null;
    }

    room.workspace = applicationResult.workspace;

    const updatedBlock: AiBlock = {
      ...existingBlock,
      status: "accepted",
    };

    room.aiBlocks.set(blockId, updatedBlock);
    const snapshot = applicationResult.changed
      ? this.captureSnapshot(
          room,
          existingBlock.applyMode === "replace"
            ? "AI optimization accepted"
            : existingBlock.mode === "next-line"
              ? "AI continuation accepted"
              : "AI patch accepted",
          true,
        )
      : null;

    return {
      block: updatedBlock,
      room: this.toRoomState(room),
      changed: true,
      applied: applicationResult.changed,
      snapshot,
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
        applied: false,
        snapshot: null,
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
      applied: false,
      snapshot: null,
    };
  }

  restoreSnapshot(
    roomId: string,
    snapshotId: string,
  ): RestoreSnapshotResult | null {
    const room = this.rooms.get(roomId);

    if (!room) {
      return null;
    }

    const sourceSnapshot = room.snapshots.find(
      (snapshot) => snapshot.id === snapshotId,
    );

    if (!sourceSnapshot) {
      return null;
    }

    const changed =
      serializeWorkspace(room.workspace) !==
      serializeWorkspace(sourceSnapshot.workspace);

    if (changed) {
      room.workspace = cloneWorkspaceState(sourceSnapshot.workspace);
    }

    const createdSnapshot = changed
      ? this.captureSnapshot(room, `Restored ${sourceSnapshot.label}`, true)
      : null;

    return {
      room: this.toRoomState(room),
      sourceSnapshot,
      createdSnapshot,
      changed,
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
        roomBecameEmpty: false,
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
        roomBecameEmpty: false,
      };
    }

    const participant = room.participants.get(socketId) ?? null;
    room.participants.delete(socketId);

    if (room.participants.size === 0) {
      room.emptySince = new Date().toISOString();
      return {
        roomId,
        room: this.toRoomState(room),
        participant,
        deletedRoom: false,
        roomBecameEmpty: true,
      };
    }

    return {
      roomId,
      room: this.toRoomState(room),
      participant,
      deletedRoom: false,
      roomBecameEmpty: false,
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
      workspace: createEmptyWorkspace(),
      ui: {
        preview: {
          isVisible: false,
          targetFileId: null,
        },
        theme: "dark",
      },
      participants: new Map(),
      aiBlocks: new Map(),
      snapshots: [],
      terminalEntries: [],
      sharedChatMessages: [],
      privateChatMessages: new Map(),
      privateAiProposals: new Map(),
      activityFeed: [],
      sessionComments: [],
      emptySince: null,
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
      workspace: cloneWorkspaceState(room.workspace),
      ui: {
        preview: { ...room.ui.preview },
        theme: room.ui.theme,
      },
      participants: Array.from(room.participants.values()),
      aiBlocks: Array.from(room.aiBlocks.values()).sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      ),
      snapshots: room.snapshots.map((snapshot) => ({
        ...snapshot,
        workspace: cloneWorkspaceState(snapshot.workspace),
      })),
      terminalEntries: [...room.terminalEntries].reverse(),
      activityFeed: [...(room.activityFeed ?? [])],
      sessionComments: [...(room.sessionComments ?? [])].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      ),
    };
  }

  private captureSnapshot(
    room: StoredRoom,
    label: string,
    force: boolean,
  ): RoomSnapshot | null {
    const latestSnapshot = room.snapshots[0] ?? null;
    const now = new Date();

    if (latestSnapshot) {
      const matchesLatestState =
        serializeWorkspace(latestSnapshot.workspace) ===
        serializeWorkspace(room.workspace);

      if (matchesLatestState && (!force || latestSnapshot.label === label)) {
        return null;
      }

      if (!force) {
        const lastCreatedAt = Date.parse(latestSnapshot.createdAt);

        if (
          Number.isFinite(lastCreatedAt) &&
          now.getTime() - lastCreatedAt < AUTO_SNAPSHOT_INTERVAL_MS
        ) {
          return null;
        }
      }
    }

    const snapshot: RoomSnapshot = {
      id: `snapshot_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId: room.roomId,
      workspace: cloneWorkspaceState(room.workspace),
      label,
      createdAt: now.toISOString(),
    };

    room.snapshots = [snapshot, ...room.snapshots].slice(0, MAX_ROOM_SNAPSHOTS);

    return snapshot;
  }
}
