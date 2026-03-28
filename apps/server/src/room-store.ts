import type {
  AiBlock,
  IdeThemeId,
  Participant,
  RoomSnapshot,
  RoomState,
  TerminalEntry,
  WorkspaceFileLanguage,
  WorkspaceFileNode,
  WorkspacePreviewState,
  WorkspaceUiState,
  WorkspaceState,
} from "./types.js";
import {
  cloneWorkspaceState,
  closeWorkspaceTab,
  createEmptyWorkspace,
  duplicateWorkspaceFile,
  formatWorkspaceFile,
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspaceNode,
  getWorkspaceFile,
  getPreviewFiles,
  insertCodeIntoWorkspaceFile,
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
  inserted: boolean;
  snapshot: RoomSnapshot | null;
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

const MAX_ROOM_SNAPSHOTS = 12;
const MAX_TERMINAL_ENTRIES = 600;
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

    const result = duplicateWorkspaceFile(room.workspace, nodeId);

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
        inserted: false,
        snapshot: null,
      };
    }

    const insertionResult = insertCodeIntoWorkspaceFile(
      room.workspace,
      existingBlock.fileId,
      existingBlock.code,
      existingBlock.insertAfterLine,
    );

    if (!insertionResult.file) {
      return null;
    }

    room.workspace = insertionResult.workspace;

    const updatedBlock: AiBlock = {
      ...existingBlock,
      status: "accepted",
    };

    room.aiBlocks.set(blockId, updatedBlock);
    const snapshot = insertionResult.changed
      ? this.captureSnapshot(room, "AI patch accepted", true)
      : null;

    return {
      block: updatedBlock,
      room: this.toRoomState(room),
      changed: true,
      inserted: insertionResult.changed,
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
        inserted: false,
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
      inserted: false,
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
