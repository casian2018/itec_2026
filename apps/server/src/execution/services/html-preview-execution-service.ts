import type { ExecutionService, ExecutionServiceContext, PreviewExecutionResult } from "../contracts.js";

export class HtmlPreviewExecutionService implements ExecutionService {
  readonly id = "html-preview";
  readonly label = "Live Preview";
  readonly supportedExtensions = [".html"] as const;

  async execute({
    file,
  }: ExecutionServiceContext): Promise<PreviewExecutionResult> {
    return {
      kind: "preview",
      preview: {
        isVisible: true,
        targetFileId: file.id,
      },
      message: `Live Preview focused for ${file.path}.`,
    };
  }
}
