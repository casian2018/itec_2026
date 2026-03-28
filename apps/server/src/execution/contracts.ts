import type {
  ExecutionRuntime,
  RunDonePayload,
  RunOutputPayload,
  WorkspaceFileNode,
  WorkspacePreviewState,
} from "../types.js";

export type ExecutionOutputHandler = (payload: RunOutputPayload) => void;

export type ExecutionServiceContext = {
  roomId: string;
  runId: string;
  file: WorkspaceFileNode;
  onOutput: ExecutionOutputHandler;
};

export type RuntimeExecutionResult = {
  kind: "run";
  done: RunDonePayload;
};

export type PreviewExecutionResult = {
  kind: "preview";
  preview: WorkspacePreviewState;
  message: string;
};

export type ExecutionServiceResult =
  | RuntimeExecutionResult
  | PreviewExecutionResult;

export interface ExecutionService {
  readonly id: string;
  readonly label: string;
  readonly supportedExtensions: readonly string[];
  readonly runtime?: ExecutionRuntime;
  execute(context: ExecutionServiceContext): Promise<ExecutionServiceResult>;
}
