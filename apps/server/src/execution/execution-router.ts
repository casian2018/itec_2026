import type { WorkspaceFileNode } from "../types.js";
import type { ExecutionService } from "./contracts.js";
import { detectFileExtension } from "./detect-file-extension.js";

export type RoutedExecution =
  | {
      kind: "service";
      extension: string;
      service: ExecutionService;
    }
  | {
      kind: "unsupported";
      extension: string | null;
      message: string;
    };

export class ExecutionRouter {
  private readonly servicesByExtension = new Map<string, ExecutionService>();

  constructor(private readonly services: readonly ExecutionService[]) {
    for (const service of services) {
      for (const extension of service.supportedExtensions) {
        this.servicesByExtension.set(extension.toLowerCase(), service);
      }
    }
  }

  route(file: WorkspaceFileNode): RoutedExecution {
    const extension = detectFileExtension(file);

    if (!extension) {
      return {
        kind: "unsupported",
        extension: null,
        message: `No runnable extension found for ${file.path}. Supported: .js, .py, .c, .cpp, .html.`,
      };
    }

    const service = this.servicesByExtension.get(extension);

    if (!service) {
      return {
        kind: "unsupported",
        extension,
        message: `Unsupported file type ${extension} for ${file.path}. Supported: .js, .py, .c, .cpp, .html.`,
      };
    }

    return {
      kind: "service",
      extension,
      service,
    };
  }
}
