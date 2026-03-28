export type ConsoleEntryKind = "stdout" | "stderr" | "system";

export type ConsoleEntry = {
  id: string;
  kind: ConsoleEntryKind;
  text: string;
};

export type RunCodeStatus = "idle" | "running" | "completed" | "error";

export function createConsoleEntry(
  kind: ConsoleEntryKind,
  text: string,
  id: string,
): ConsoleEntry {
  return {
    id,
    kind,
    text,
  };
}
