export class InMemoryExecutionState {
  private readonly activeRunsByRoom = new Map<string, string>();

  getActiveRunId(roomId: string) {
    return this.activeRunsByRoom.get(roomId) ?? null;
  }

  tryStartRun(roomId: string, runId: string) {
    if (this.activeRunsByRoom.has(roomId)) {
      return false;
    }

    this.activeRunsByRoom.set(roomId, runId);
    return true;
  }

  finishRun(roomId: string, runId: string) {
    if (this.activeRunsByRoom.get(roomId) === runId) {
      this.activeRunsByRoom.delete(roomId);
    }
  }
}
