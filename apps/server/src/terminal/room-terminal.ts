import type { RoomStore } from "../room-store.js";
import type { TerminalEntry } from "../types.js";

type RoomTerminalDependencies = {
  roomStore: Pick<RoomStore, "addTerminalEntry" | "clearTerminalEntries">;
  emitEntry: (roomId: string, entry: TerminalEntry) => void;
  emitSystemMessage: (roomId: string, entry: TerminalEntry) => void;
  emitClear: (roomId: string, clearedBy: string) => void;
};

export class RoomTerminal {
  constructor(private readonly dependencies: RoomTerminalDependencies) {}

  createEntry(
    roomId: string,
    kind: TerminalEntry["kind"],
    text: string,
    authorName?: string,
  ): TerminalEntry {
    return {
      id: `terminal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      kind,
      text,
      createdAt: new Date().toISOString(),
      authorName,
    };
  }

  append(roomId: string, entry: TerminalEntry) {
    const createdEntry = this.dependencies.roomStore.addTerminalEntry(roomId, entry);

    if (!createdEntry) {
      return null;
    }

    if (createdEntry.kind === "system") {
      this.dependencies.emitSystemMessage(roomId, createdEntry);
      return createdEntry;
    }

    this.dependencies.emitEntry(roomId, createdEntry);
    return createdEntry;
  }

  appendText(
    roomId: string,
    kind: TerminalEntry["kind"],
    text: string,
    authorName?: string,
  ) {
    return this.append(roomId, this.createEntry(roomId, kind, text, authorName));
  }

  clear(roomId: string, clearedBy: string) {
    const room = this.dependencies.roomStore.clearTerminalEntries(roomId);

    if (!room) {
      return null;
    }

    this.dependencies.emitClear(roomId, clearedBy);
    return room;
  }
}
